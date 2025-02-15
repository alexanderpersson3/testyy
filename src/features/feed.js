const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { query } = require('express-validator');
const { validateRequest } = require('../middleware/validate-request');
const feedManager = require('../services/feed-manager');
const rateLimiter = require('../middleware/rate-limit');

// Validation middleware
const validateFeedQuery = [
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('offset').optional().isInt({ min: 0 }),
  query('includeFollowing').optional().isBoolean(),
  query('includeFeatured').optional().isBoolean(),
];

// Get user's feed
router.get('/', auth, validateFeedQuery, validateRequest, async (req, res) => {
  try {
    const options = {
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined,
      includeFollowing: req.query.includeFollowing !== 'false',
      includeFeatured: req.query.includeFeatured !== 'false',
    };

    const feed = await feedManager.getFeed(req.user.id, options);

    res.json({
      success: true,
      data: feed,
    });
  } catch (err) {
    console.error('Error getting feed:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error getting feed',
    });
  }
});

// Get activity by ID
router.get('/activity/:activityId', auth, async (req, res) => {
  try {
    const activity = await feedManager.getActivityById(req.params.activityId);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found',
      });
    }

    res.json({
      success: true,
      data: activity,
    });
  } catch (err) {
    console.error('Error getting activity:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error getting activity',
    });
  }
});

// Delete activity
router.delete('/activity/:activityId', auth, rateLimiter.api(), async (req, res) => {
  try {
    await feedManager.deleteActivity(req.params.activityId, req.user.id);

    res.json({
      success: true,
      message: 'Activity deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting activity:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error deleting activity',
    });
  }
});

module.exports = router;
