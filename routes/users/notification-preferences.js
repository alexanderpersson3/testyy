const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../../middleware/validate-request');
const auth = require('../../middleware/auth');
const notificationPreferences = require('../../services/notification-preferences');
const rateLimiter = require('../../middleware/rate-limit');

// Validation middleware
const validatePreferences = [
  body('email').optional().isObject(),
  body('email.*').optional().isBoolean(),
  body('in_app').optional().isObject(),
  body('in_app.*').optional().isBoolean(),
  body('digest_frequency')
    .optional()
    .isIn(['never', 'daily', 'weekly'])
    .withMessage('Invalid digest frequency'),
  body('quiet_hours').optional().isObject(),
  body('quiet_hours.enabled').optional().isBoolean(),
  body('quiet_hours.start')
    .optional()
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Invalid time format (HH:mm)'),
  body('quiet_hours.end')
    .optional()
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Invalid time format (HH:mm)'),
  body('quiet_hours.timezone')
    .optional()
    .isString()
    .withMessage('Invalid timezone')
];

// Get notification preferences
router.get(
  '/',
  auth,
  rateLimiter.api(),
  async (req, res) => {
    try {
      const preferences = await notificationPreferences.getPreferences(req.user.id);
      
      res.json({
        success: true,
        data: preferences
      });
    } catch (err) {
      console.error('Error getting notification preferences:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error getting notification preferences'
      });
    }
  }
);

// Update notification preferences
router.put(
  '/',
  auth,
  rateLimiter.api(),
  validatePreferences,
  validateRequest,
  async (req, res) => {
    try {
      const success = await notificationPreferences.updatePreferences(
        req.user.id,
        req.body
      );
      
      res.json({
        success: true,
        message: 'Notification preferences updated successfully'
      });
    } catch (err) {
      console.error('Error updating notification preferences:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error updating notification preferences'
      });
    }
  }
);

// Get available notification types
router.get(
  '/types',
  auth,
  rateLimiter.api(),
  async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          types: notificationPreferences.NOTIFICATION_TYPES,
          defaults: notificationPreferences.DEFAULT_PREFERENCES
        }
      });
    } catch (err) {
      console.error('Error getting notification types:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error getting notification types'
      });
    }
  }
);

module.exports = router; 