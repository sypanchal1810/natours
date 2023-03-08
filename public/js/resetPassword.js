/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

export const resetPassword = async (password, passwordConfirm, resetToken) => {
  console.log(resetToken);
  try {
    const res = await axios({
      method: 'PATCH',
      url: `/api/v1/users/resetPassword/${resetToken}`,
      data: {
        password,
        passwordConfirm,
      },
    });

    if (res.data.status === 'success') {
      showAlert('success', 'Password Changed successfully. Please Log into your account.');
      window.setTimeout(() => {
        location.assign('/login');
      }, 2000);
      window.setTimeout(() => {
        location.reload(true);
      }, 4000);
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};
