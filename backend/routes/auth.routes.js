const express = require('express');
const router  = express.Router();
const {
  register,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  login,
  firebaseSync,
  getMe,
  updateMe,
} = require('../controllers/auth.controller');
const protect = require('../middleware/auth.middleware');

router.post('/register',   register);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/login',          login);
router.post('/firebase-sync',  firebaseSync);
router.get('/me',              protect, getMe);
router.patch('/me',        protect, updateMe);

module.exports = router;