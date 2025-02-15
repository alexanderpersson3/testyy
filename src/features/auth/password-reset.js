const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../../middleware/validate-request');
const auth = require('../../middleware/auth');
const passwordResetManager = require('../../services/password-reset');
const rateLimiter = require('../../middleware/rate-limit');

// Validation middleware
const validateForgotPassword = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
];

const validateResetPassword = [
  body('token').isString().trim().notEmpty().withMessage('Reset token is required'),
  body('newPassword')
    .isString()
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'Password must be at least 8 characters and contain uppercase, lowercase, and numbers'
    ),
];

const validateChangePassword = [
  body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isString()
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'Password must be at least 8 characters and contain uppercase, lowercase, and numbers'
    ),
];

// Request password reset
router.post(
  '/forgot-password',
  rateLimiter.auth(),
  validateForgotPassword,
  validateRequest,
  async (req, res) => {
    try {
      await passwordResetManager.generateResetToken(req.body.email);

      // Always return success to prevent email enumeration
      res.json({
        success: true,
        message: 'If an account exists with this email, a reset link will be sent',
      });
    } catch (err) {
      console.error('Error requesting password reset:', err);
      // Still return success to prevent email enumeration
      res.json({
        success: true,
        message: 'If an account exists with this email, a reset link will be sent',
      });
    }
  }
);

// Reset password with token
router.post(
  '/reset-password',
  rateLimiter.auth(),
  validateResetPassword,
  validateRequest,
  async (req, res) => {
    try {
      await passwordResetManager.resetPassword(req.body.token, req.body.newPassword);

      res.json({
        success: true,
        message: 'Password has been reset successfully',
      });
    } catch (err) {
      console.error('Error resetting password:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error resetting password',
      });
    }
  }
);

// Change password (when logged in)
router.put(
  '/change-password',
  auth,
  rateLimiter.auth(),
  validateChangePassword,
  validateRequest,
  async (req, res) => {
    try {
      await passwordResetManager.changePassword(
        req.user.id,
        req.body.currentPassword,
        req.body.newPassword
      );

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (err) {
      console.error('Error changing password:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error changing password',
      });
    }
  }
);

module.exports = router;
