const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { validateRequest } = require('../middleware/validate-request');
const auth = require('../middleware/auth');
const moderationManager = require('../services/moderation-manager');
const rateLimiter = require('../middleware/rate-limit');

// Validation middleware
const validateReport = [
  body('contentType')
    .isIn(Object.values(moderationManager.CONTENT_TYPES))
    .withMessage('Invalid content type'),
  body('contentId')
    .isString()
    .notEmpty()
    .withMessage('Content ID is required'),
  body('reason')
    .isIn(Object.values(moderationManager.REPORT_TYPES))
    .withMessage('Invalid report reason'),
  body('details')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Details must be less than 1000 characters')
];

const validateMute = [
  body('duration')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Duration must be a positive number')
];

// Block a user
router.post(
  '/block/:userId',
  auth,
  rateLimiter.api(),
  async (req, res) => {
    try {
      await moderationManager.blockUser(req.user.id, req.params.userId);
      
      res.json({
        success: true,
        message: 'User blocked successfully'
      });
    } catch (err) {
      console.error('Error blocking user:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error blocking user'
      });
    }
  }
);

// Unblock a user
router.delete(
  '/block/:userId',
  auth,
  rateLimiter.api(),
  async (req, res) => {
    try {
      await moderationManager.unblockUser(req.user.id, req.params.userId);
      
      res.json({
        success: true,
        message: 'User unblocked successfully'
      });
    } catch (err) {
      console.error('Error unblocking user:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error unblocking user'
      });
    }
  }
);

// Get blocked users
router.get(
  '/blocks',
  auth,
  rateLimiter.api(),
  async (req, res) => {
    try {
      const blocks = await moderationManager.getBlockedUsers(req.user.id);
      
      res.json({
        success: true,
        data: blocks
      });
    } catch (err) {
      console.error('Error getting blocked users:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error getting blocked users'
      });
    }
  }
);

// Mute a user
router.post(
  '/mute/:userId',
  auth,
  rateLimiter.api(),
  validateMute,
  validateRequest,
  async (req, res) => {
    try {
      await moderationManager.muteUser(
        req.user.id,
        req.params.userId,
        req.body.duration
      );
      
      res.json({
        success: true,
        message: 'User muted successfully'
      });
    } catch (err) {
      console.error('Error muting user:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error muting user'
      });
    }
  }
);

// Unmute a user
router.delete(
  '/mute/:userId',
  auth,
  rateLimiter.api(),
  async (req, res) => {
    try {
      await moderationManager.unmuteUser(req.user.id, req.params.userId);
      
      res.json({
        success: true,
        message: 'User unmuted successfully'
      });
    } catch (err) {
      console.error('Error unmuting user:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error unmuting user'
      });
    }
  }
);

// Get muted users
router.get(
  '/mutes',
  auth,
  rateLimiter.api(),
  async (req, res) => {
    try {
      const mutes = await moderationManager.getMutedUsers(req.user.id);
      
      res.json({
        success: true,
        data: mutes
      });
    } catch (err) {
      console.error('Error getting muted users:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error getting muted users'
      });
    }
  }
);

// Report content
router.post(
  '/report',
  auth,
  rateLimiter.api(),
  validateReport,
  validateRequest,
  async (req, res) => {
    try {
      const { contentType, contentId, reason, details } = req.body;
      
      await moderationManager.reportContent(
        req.user.id,
        contentType,
        contentId,
        reason,
        details
      );
      
      res.json({
        success: true,
        message: 'Content reported successfully'
      });
    } catch (err) {
      console.error('Error reporting content:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error reporting content'
      });
    }
  }
);

// Get reports (admin only)
router.get(
  '/reports',
  auth,
  rateLimiter.admin(),
  async (req, res) => {
    try {
      const filters = {
        status: req.query.status,
        contentType: req.query.contentType,
        reason: req.query.reason
      };
      
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      const reports = await moderationManager.getReports(filters, page, limit);
      
      res.json({
        success: true,
        data: reports
      });
    } catch (err) {
      console.error('Error getting reports:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error getting reports'
      });
    }
  }
);

module.exports = router; 