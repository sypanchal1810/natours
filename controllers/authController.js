const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');
const catchAsync = require('../utils/catchAsync');
const appError = require('./../utils/appErrors');
const Email = require('./../utils/email');

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createAndSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);

  res.cookie('jwt', token, {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
  });

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });

  // const newUser = await User.create(req.body);

  const url = `${req.protocol}://${req.get('host')}/me`;
  // console.log(url);
  await new Email(newUser, url).sendWelcome();

  createAndSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) If email and password exits
  if (!email || !password) {
    return next(new appError(`Please provide email and password`, 400));
  }

  // 2) If user exits and password is correct
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new appError(`Incorrect email or password`, 401));
  }

  // 3) If everything is ok, send token to the client
  createAndSendToken(user, 200, req, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({
    status: 'success',
  });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and Check if it is there
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(new appError(`You are not logged in... Please login to get access`, 401));
  }

  // 2) Verification Token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET_KEY);

  // 3) Check if user still exists
  const freshUser = await User.findById(decoded.id);

  if (!freshUser) {
    return next(new appError(`The user belonging to this token is no longer exists`, 401));
  }

  // 4) Check if user changed password after token was issued
  if (freshUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new appError(`The user has recently changed the password. Please login again...`, 401)
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = freshUser;
  res.locals.user = freshUser;

  next();
});

// This is only for logged in users. No errors!
exports.isLoggedIn = async (req, res, next) => {
  try {
    if (req.cookies.jwt) {
      // 1) Verification Token
      const decoded = await promisify(jwt.verify)(req.cookies.jwt, process.env.JWT_SECRET_KEY);
      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // There is a logged in user
      res.locals.user = currentUser;
      return next();
    }
  } catch (err) {
    return next();
  }
  next();
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new appError(`You don't have permission to perform this action...`, 403));
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new appError('There is no user with email address.', 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  try {
    const resetURL = `${req.protocol}://${req.get('host')}/resetPassword/${resetToken}`;

    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new appError('There was an error sending the email. Try again later!', 500));
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get the user based on the token sent
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) If token is not expired and user exists, set the new password
  if (!user) {
    return next(new appError(`Invalid token or Token has been expired`, 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  // 3) Update changedPasswordAt property of the user object
  user.passwordChangedAt = Date.now() - 1000;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Password changed successfully. Please Log into your account...',
  });

  // // 4) Log the user in and send JWT
  // createAndSendToken(user, 200, req, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user._id).select('+password');

  // 2) Check if posted current password is correct or not
  if (!(await user.correctPassword(req.body.oldPassword, user.password))) {
    return next(new appError(`Incorrect Old Password`, 401));
  }

  // 3) If yes then update password
  user.password = req.body.newPassword;
  user.passwordConfirm = req.body.newPasswordConfirm;
  user.passwordChangedAt = Date.now() - 1000;
  await user.save();

  // 4) Log the user in and send JWT
  createAndSendToken(user, 200, req, res);
});

// TODO: Implement maximum 10 login attempts by a user for incorrect credentials
