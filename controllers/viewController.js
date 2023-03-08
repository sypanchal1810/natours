const Tour = require('./../models/toursModel');
const Booking = require('./../models/bookingModel');
const catchAsync = require('./../utils/catchAsync');
const appError = require('./../utils/appErrors');

exports.getOverview = catchAsync(async (req, res, next) => {
  const tours = await Tour.find();

  res.status(200).render('overview', {
    title: 'All tours',
    tours,
  });
});

exports.getTour = catchAsync(async (req, res, next) => {
  const tour = await Tour.findOne({ slug: req.params.slug }).populate({
    path: 'reviews',
    fields: 'review rating user',
  });

  if (!tour) {
    return next(new appError(`No Tour exists with this name`, 404));
  }

  res.status(200).render('tour', {
    title: `${tour.name} Tour`,
    tour,
  });
});

exports.getSignupForm = catchAsync(async (req, res, next) => {
  res.status(200).render('signup', {
    title: `Create your Account`,
  });
});

exports.getLoginForm = catchAsync(async (req, res, next) => {
  res.status(200).render('login', {
    title: `Login to your Account`,
  });
});

exports.getUserAccount = catchAsync(async (req, res, next) => {
  res.status(200).render('account', {
    title: `Your Account`,
  });
});

exports.getMyTours = catchAsync(async (req, res, next) => {
  // 1. Find all bookings of user based on user id
  const bookings = await Booking.find({ user: req.user.id });

  // 2. Find all booked tour of that user
  const tourIds = bookings.map(el => el.tour._id);
  const tours = await Tour.find({ _id: { $in: tourIds } });

  res.status(200).render('overview', {
    title: 'My Tours',
    tours,
  });
});

exports.getForgotPasswordForm = catchAsync(async (req, res, next) => {
  res.status(200).render('forgotPasswordForm', {
    title: 'Forgot Password',
  });
});

exports.getResetPasswordForm = catchAsync(async (req, res, next) => {
  const resetToken = req.params.resetToken;

  res.status(200).render('resetPasswordForm', {
    title: 'Reset Password',
    resetToken,
  });
});

exports.alerts = catchAsync(async (req, res, next) => {
  const { alert } = req.query;

  if (alert === 'booking') {
    res.locals.alert = `Your booking was successful! Please check your email for a confirmation. If your booking doesn't show up here immediately, please come back later.`;
  }

  next();
});
