const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'A user must have a name'],
    lowercase: true,
    trim: true,
    // index: true,
    //   unique: true,
    //   match: [/^[a-zA-Z0-9]+$/, 'is invalid'],
    //   maxlength: [50, 'The user name must have less than or equal to 50 characters'],
    //   minlength: [10, 'The user name must have more than or equal to 10 characters'],
  },
  email: {
    type: String,
    required: [true, 'A user must have a email'],
    lowercase: true,
    trim: true,
    match: [/^[a-zA-Z0-9_.-]+@[a-zA-Z0-9.]+[a-zA-Z]{2,5}$/g, 'Please enter valid email address'],
    unique: true,
    index: true,
  },
  photo: {
    type: String,
    default: `${process.env.DEFAULT_USER_PROFILE_IMAGE_URL}`,
    //   required: [true, 'A user must have a profile photo'],
  },
  role: {
    type: String,
    enum: ['admin', 'lead-guide', 'guide', 'user'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Please provide strong password'],
    minlength: 8,
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      // This only works with .create and .save
      validator: function (el) {
        return el === this.password;
      },
      message: 'Passwords are not same!!',
    },
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  createdAt: {
    type: Date,
    select: false,
  },
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
  updatedAt: {
    type: Date,
    select: false,
  },
});

// Small utility function for checking if email is already exists
userSchema.path('email').validate(async function (value) {
  if (!this.isNew) return;

  const emailCount = await mongoose.models.User.countDocuments({
    email: value,
  });
  return !emailCount;
}, 'Email already exists. Please Login with your existing Email.');

// Encryption of password
userSchema.pre('save', async function (req, res, next) {
  // This func will run when password has been modified
  if (!this.isModified('password')) return next();

  // Hash the password with the cost of 12
  this.password = await bcrypt.hash(this.password, 16);

  // Delete Password Confirm Field
  this.passwordConfirm = undefined;

  next();
});

userSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

/*
userSchema.pre('save', function () {
  // if new document issued
  if (!this.isModified('password') || this.isNew) return next();
  //   console.log(this.isModified('password'), this.isNew);

  // small hack for simply update the password changed time < created token time
  this.passwordChangedAt = Date.now() - 1000;
  next();
});
*/

// Comparing the password given in login and original password
userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  console.log(candidatePassword, userPassword);
  return await bcrypt.compare(candidatePassword, userPassword);
};

// If user has updated the password
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return changedTimestamp > JWTTimestamp;
  }

  // False means password has NOT changed
  return false;
};

// creating the token for the request of reset Password
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
