const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../../middleware/validate-request');
const auth = require('../../middleware/auth');
const twoFactorAuth = require('../../services/two-factor-auth');
const rateLimiter = require('../../middleware/rate-limit');

// Validation middleware
const validateToken = [
  body('token')
    .isString()
    .isLength({ min: 6, max: 6 })
    .matches(/^\d+$/)
    .withMessage('Token must be 6 digits')
];

const validateBackupCode = [
  body('code')
    .isString()
    .isLength({ min: 10, max: 10 })
    .matches(/^[a-f0-9]+$/)
    .withMessage('Invalid backup code format')
];

// Setup 2FA
router.post(
  '/2fa/setup',
  auth,
  rateLimiter.auth(),
  async (req, res) => {
    try {
      const setup = await twoFactorAuth.setup2FA(req.user.id);
      
      res.json({
        success: true,
        data: setup
      });
    } catch (err) {
      console.error('Error setting up 2FA:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error setting up 2FA'
      });
    }
  }
);

// Verify and enable 2FA
router.post(
  '/2fa/verify',
  auth,
  rateLimiter.auth(),
  validateToken,
  validateRequest,
  async (req, res) => {
    try {
      await twoFactorAuth.verify2FA(req.user.id, req.body.token);
      
      res.json({
        success: true,
        message: '2FA enabled successfully'
      });
    } catch (err) {
      console.error('Error verifying 2FA:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error verifying 2FA'
      });
    }
  }
);

// Verify backup code
router.post(
  '/2fa/backup',
  auth,
  rateLimiter.auth(),
  validateBackupCode,
  validateRequest,
  async (req, res) => {
    try {
      await twoFactorAuth.verifyBackupCode(req.user.id, req.body.code);
      
      res.json({
        success: true,
        message: 'Backup code verified successfully'
      });
    } catch (err) {
      console.error('Error verifying backup code:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error verifying backup code'
      });
    }
  }
);

// Disable 2FA
router.post(
  '/2fa/disable',
  auth,
  rateLimiter.auth(),
  validateToken,
  validateRequest,
  async (req, res) => {
    try {
      await twoFactorAuth.disable2FA(req.user.id, req.body.token);
      
      res.json({
        success: true,
        message: '2FA disabled successfully'
      });
    } catch (err) {
      console.error('Error disabling 2FA:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error disabling 2FA'
      });
    }
  }
);

module.exports = router; 