const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const { validateRequest } = require('../../middleware/validate-request');
const auth = require('../../middleware/auth');
const deviceManager = require('../../services/device-manager');
const rateLimiter = require('../../middleware/rate-limit');

// Validation middleware
const validateListQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('includeInactive').optional().isBoolean().withMessage('includeInactive must be a boolean'),
];

// Get device history
router.get('/', auth, rateLimiter.api(), validateListQuery, validateRequest, async (req, res) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      includeInactive: req.query.includeInactive === 'true',
    };

    const deviceHistory = await deviceManager.getDeviceHistory(req.user.id, options);

    res.json({
      success: true,
      data: deviceHistory,
    });
  } catch (err) {
    console.error('Error getting device history:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error getting device history',
    });
  }
});

// Revoke device access
router.post('/:sessionId/revoke', auth, rateLimiter.api(), async (req, res) => {
  try {
    // Prevent revoking current session
    if (req.params.sessionId === req.session.id) {
      throw new Error('Cannot revoke current session');
    }

    await deviceManager.revokeDeviceAccess(req.user.id, req.params.sessionId);

    res.json({
      success: true,
      message: 'Device access revoked successfully',
    });
  } catch (err) {
    console.error('Error revoking device access:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error revoking device access',
    });
  }
});

// Revoke all devices except current
router.post('/revoke-all', auth, rateLimiter.api(), async (req, res) => {
  try {
    await deviceManager.revokeAllDevices(req.user.id, req.session.id);

    res.json({
      success: true,
      message: 'All devices revoked successfully',
    });
  } catch (err) {
    console.error('Error revoking all devices:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error revoking all devices',
    });
  }
});

module.exports = router;
