const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../../middleware/validate-request');
const auth = require('../../middleware/auth');
const accountManager = require('../../services/account-manager');
const rateLimiter = require('../../middleware/rate-limit');

// Validation middleware
const validatePassword = [
  body('password')
    .isString()
    .notEmpty()
    .withMessage('Password is required')
];

// Deactivate account
router.post(
  '/deactivate',
  auth,
  rateLimiter.auth(),
  validatePassword,
  validateRequest,
  async (req, res) => {
    try {
      await accountManager.deactivateAccount(req.user.id, req.body.password);
      
      res.json({
        success: true,
        message: 'Account deactivated successfully'
      });
    } catch (err) {
      console.error('Error deactivating account:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error deactivating account'
      });
    }
  }
);

// Reactivate account
router.post(
  '/reactivate',
  rateLimiter.auth(),
  async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      await accountManager.reactivateAccount(userId);
      
      res.json({
        success: true,
        message: 'Account reactivated successfully'
      });
    } catch (err) {
      console.error('Error reactivating account:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error reactivating account'
      });
    }
  }
);

// Permanently delete account
router.post(
  '/delete',
  auth,
  rateLimiter.auth(),
  validatePassword,
  validateRequest,
  async (req, res) => {
    try {
      await accountManager.permanentlyDeleteAccount(req.user.id, req.body.password);
      
      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (err) {
      console.error('Error deleting account:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error deleting account'
      });
    }
  }
);

// Export user data
router.get(
  '/export',
  auth,
  rateLimiter.auth(),
  async (req, res) => {
    try {
      const data = await accountManager.exportUserData(req.user.id);
      
      res.json({
        success: true,
        data
      });
    } catch (err) {
      console.error('Error exporting user data:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error exporting user data'
      });
    }
  }
);

module.exports = router; 