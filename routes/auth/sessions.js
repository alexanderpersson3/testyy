const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../../middleware/validate-request');
const auth = require('../../middleware/auth');
const sessionManager = require('../../services/session-manager');
const rateLimiter = require('../../middleware/rate-limit');

// Validation middleware
const validateRefreshToken = [
  body('refreshToken')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Refresh token is required')
];

// Refresh access token
router.post(
  '/refresh',
  rateLimiter.auth(),
  validateRefreshToken,
  validateRequest,
  async (req, res) => {
    try {
      const deviceInfo = {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        deviceType: req.headers['x-device-type']
      };

      const result = await sessionManager.refreshSession(
        req.body.refreshToken,
        deviceInfo
      );
      
      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      console.error('Error refreshing token:', err);
      res.status(401).json({
        success: false,
        message: err.message || 'Error refreshing token'
      });
    }
  }
);

// Logout (invalidate current session)
router.post(
  '/logout',
  auth,
  rateLimiter.auth(),
  async (req, res) => {
    try {
      await sessionManager.invalidateSession(req.user.sessionId, req.user.id);
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (err) {
      console.error('Error logging out:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error logging out'
      });
    }
  }
);

// Logout from all devices
router.post(
  '/logout-all',
  auth,
  rateLimiter.auth(),
  async (req, res) => {
    try {
      await sessionManager.invalidateAllSessions(req.user.id);
      
      res.json({
        success: true,
        message: 'Logged out from all devices'
      });
    } catch (err) {
      console.error('Error logging out from all devices:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error logging out from all devices'
      });
    }
  }
);

// Get active sessions
router.get(
  '/active',
  auth,
  rateLimiter.auth(),
  async (req, res) => {
    try {
      const sessions = await sessionManager.getActiveSessions(req.user.id);
      
      res.json({
        success: true,
        data: sessions
      });
    } catch (err) {
      console.error('Error getting active sessions:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error getting active sessions'
      });
    }
  }
);

// Logout from specific session
router.post(
  '/logout/:sessionId',
  auth,
  rateLimiter.auth(),
  async (req, res) => {
    try {
      await sessionManager.invalidateSession(req.params.sessionId, req.user.id);
      
      res.json({
        success: true,
        message: 'Session invalidated successfully'
      });
    } catch (err) {
      console.error('Error invalidating session:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error invalidating session'
      });
    }
  }
);

module.exports = router; 