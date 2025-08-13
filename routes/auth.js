const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, extractDeviceInfo } = require('../middleware/auth');
const {
  validateRegistration,
  validateLogin,
  validateEmailVerification,
  validateForgotPassword,
  validateResetPassword,
  validateRefreshToken,
  validateLogout
} = require('../middleware/validation');

// Apply device info extraction to all routes
router.use(extractDeviceInfo);

// User Registration
router.post('/register', validateRegistration, authController.register);

// User Login
router.post('/login', validateLogin, authController.login);

// Email Verification
router.post('/verify-email', validateEmailVerification, authController.verifyEmail);
router.post('/resend-verification', validateForgotPassword, authController.resendVerification);

// Password Management
router.post('/forgot-password', validateForgotPassword, authController.forgotPassword);
router.post('/reset-password', validateResetPassword, authController.resetPassword);

// Session Management
router.get('/sessions', authenticateToken, authController.getUserSessions);
router.post('/refresh', validateRefreshToken, authController.refreshToken);

// User Profile
router.get('/profile', authenticateToken, authController.getUserProfile);

// Logout
router.post('/logout', authenticateToken, validateLogout, authController.logout);

module.exports = router; 