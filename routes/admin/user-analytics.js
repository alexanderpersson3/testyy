const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const { validateRequest } = require('../../middleware/validate-request');
const auth = require('../../middleware/auth');
const isAdmin = require('../../middleware/is-admin');
const userAnalytics = require('../../services/user-analytics');
const rateLimiter = require('../../middleware/rate-limit');

// Validation middleware
const validateTimeframe = [
  query('timeframe')
    .optional()
    .isIn(['7d', '30d', '90d'])
    .withMessage('Invalid timeframe. Must be one of: 7d, 30d, 90d')
];

const validateFeature = [
  query('feature')
    .isString()
    .custom(value => {
      if (!Object.values(userAnalytics.LIFECYCLE_EVENTS).includes(value)) {
        throw new Error('Invalid feature');
      }
      return true;
    })
];

// Get engagement metrics
router.get(
  '/engagement',
  auth,
  isAdmin,
  rateLimiter.admin(),
  validateTimeframe,
  validateRequest,
  async (req, res) => {
    try {
      const { timeframe = '30d' } = req.query;
      const metrics = await userAnalytics.getEngagementMetrics(timeframe);
      
      res.json({
        success: true,
        data: metrics
      });
    } catch (err) {
      console.error('Error getting engagement metrics:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error getting engagement metrics'
      });
    }
  }
);

// Get feature adoption metrics
router.get(
  '/feature-adoption',
  auth,
  isAdmin,
  rateLimiter.admin(),
  validateTimeframe,
  validateFeature,
  validateRequest,
  async (req, res) => {
    try {
      const { feature, timeframe = '30d' } = req.query;
      const adoption = await userAnalytics.getFeatureAdoption(feature, timeframe);
      
      res.json({
        success: true,
        data: adoption
      });
    } catch (err) {
      console.error('Error getting feature adoption:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error getting feature adoption'
      });
    }
  }
);

// Get user retention metrics
router.get(
  '/retention',
  auth,
  isAdmin,
  rateLimiter.admin(),
  validateTimeframe,
  validateRequest,
  async (req, res) => {
    try {
      const { timeframe = '30d' } = req.query;
      const retention = await userAnalytics.getUserRetention(timeframe);
      
      res.json({
        success: true,
        data: retention
      });
    } catch (err) {
      console.error('Error getting user retention:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error getting user retention'
      });
    }
  }
);

// Get supported options
router.get(
  '/options',
  auth,
  isAdmin,
  rateLimiter.admin(),
  async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          lifecycleEvents: userAnalytics.LIFECYCLE_EVENTS,
          engagementMetrics: userAnalytics.ENGAGEMENT_METRICS,
          timeframes: ['7d', '30d', '90d']
        }
      });
    } catch (err) {
      console.error('Error getting analytics options:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error getting analytics options'
      });
    }
  }
);

module.exports = router; 