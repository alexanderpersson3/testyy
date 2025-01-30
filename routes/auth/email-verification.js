const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../../middleware/validate-request');
const auth = require('../../middleware/auth');
const emailVerificationManager = require('../../services/email-verification');
const rateLimiter = require('../../middleware/rate-limit');

// Validation middleware
const validateUpdateEmail = [
  body('newEmail')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isString()
    .notEmpty()
    .withMessage('Password is required')
];

// Verify email with token
router.get(
  '/verify',
  rateLimiter.auth(),
  async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
      }

      await emailVerificationManager.verifyEmail(token);
      
      res.json({
        success: true,
        message: 'Email verified successfully'
      });
    } catch (err) {
      console.error('Error verifying email:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error verifying email'
      });
    }
  }
);

// Resend verification email
router.post(
  '/resend',
  auth,
  rateLimiter.auth(),
  async (req, res) => {
    try {
      await emailVerificationManager.resendVerification(req.user.id);
      
      res.json({
        success: true,
        message: 'Verification email sent successfully'
      });
    } catch (err) {
      console.error('Error resending verification:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error resending verification email'
      });
    }
  }
);

// Update email address
router.put(
  '/update-email',
  auth,
  rateLimiter.auth(),
  validateUpdateEmail,
  validateRequest,
  async (req, res) => {
    try {
      await emailVerificationManager.updateEmail(
        req.user.id,
        req.body.newEmail,
        req.body.password
      );
      
      res.json({
        success: true,
        message: 'Verification email sent to new address'
      });
    } catch (err) {
      console.error('Error updating email:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error updating email'
      });
    }
  }
);

module.exports = router; 