/* eslint-disable */
import '@babel/polyfill';
import axios from 'axios';

import { displayMap } from './mapbox';
import { login, logout } from './login';
import { signup } from './signup';
import { forgotPassword } from './forgotPassword';
import { resetPassword } from './resetPassword';
import { updateSettings } from './updateSettings';
import { bookTour } from './stripe';
import { showAlert } from './alerts';

// DOM ELEMENTS
const mapBox = document.getElementById('map');
const loginForm = document.querySelector('.form--login');

const logOutBtn = document.querySelector('.nav__el--logout');
const userDataForm = document.querySelector('.form-user-data');
const userPasswordForm = document.querySelector('.form-user-password');
const bookBtn = document.getElementById('book-tour');

const signupForm = document.querySelector('.form--signup');
const forgotPasswordForm = document.querySelector('.form--forgotPassword');
const resetPasswordForm = document.querySelector('.form--resetPassword');

const alertMessage = document.querySelector('body').dataset.alert;

// DELEGATION
if (alertMessage) showAlert('success', alertMessage, 20);

if (mapBox) {
  const locations = JSON.parse(mapBox.dataset.locations);
  displayMap(locations);
}

if (signupForm)
  signupForm.addEventListener('submit', e => {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('confirm-password').value;

    signup(name, email, password, passwordConfirm);
  });

if (forgotPasswordForm)
  forgotPasswordForm.addEventListener('submit', e => {
    e.preventDefault();

    const email = document.getElementById('email').value;

    forgotPassword(email);
  });

if (resetPasswordForm)
  resetPasswordForm.addEventListener('submit', e => {
    e.preventDefault();

    const { resetToken } = document.getElementById('change-password').dataset;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('confirm-password').value;

    console.log(resetToken, password, passwordConfirm);
    resetPassword(password, passwordConfirm, resetToken);
  });

if (loginForm)
  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    login(email, password);
  });

if (logOutBtn)
  logOutBtn.addEventListener('click', async e => {
    e.preventDefault();
    try {
      const res = await axios({
        method: 'GET',
        url: '/api/v1/users/logout',
      });
      if ((res.data.status = 'success')) {
        showAlert('success', 'Logging Out...!');
        window.setTimeout(() => {
          location.assign('/');
        }, 2000);
        window.setTimeout(() => {
          location.reload(true);
        }, 4000);
      }
    } catch (err) {
      // console.log(err.response);
      showAlert('error', 'Error while Logging Out! Try again.');
    }
  });

if (userDataForm)
  userDataForm.addEventListener('submit', e => {
    e.preventDefault();

    const form = new FormData();
    form.append('name', document.getElementById('name').value);
    form.append('email', document.getElementById('email').value);
    form.append('photo', document.getElementById('photo').files[0]);
    updateSettings(form, 'data');
  });

if (userPasswordForm)
  userPasswordForm.addEventListener('submit', async e => {
    e.preventDefault();
    document.querySelector('.btn--save-password').textContent = 'Updating...';

    const oldPassword = document.getElementById('password-current').value;
    const newPassword = document.getElementById('password').value;
    const newPasswordConfirm = document.getElementById('password-confirm').value;
    await updateSettings({ oldPassword, newPassword, newPasswordConfirm }, 'password');

    document.querySelector('.btn--save-password').textContent = 'Save password';
    document.getElementById('password-current').value = '';
    document.getElementById('password').value = '';
    document.getElementById('password-confirm').value = '';
  });

if (bookBtn) {
  bookBtn.addEventListener('click', e => {
    e.target.textContent = 'Processing...';
    const { tourId } = e.target.dataset;
    bookTour(tourId);
  });
}
