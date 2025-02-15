const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../../middleware/validate-request');
const auth = require('../../middleware/auth');
const complianceManager = require('../../services/compliance-manager');
const rateLimiter = require('../../middleware/rate-limit');

// Validation middleware
const validateConsent = [
  body('consentType')
    .isString()
    .custom(value => {
      if (!Object.values(complianceManager.CONSENT_TYPES).includes(value)) {
        throw new Error('Invalid consent type');
      }
      return true;
    }),
  body('granted').isBoolean().withMessage('Granted must be a boolean value'),
  body('version').optional().isString().withMessage('Version must be a string'),
];

const validateDataRequest = [
  body('requestType')
    .isString()
    .custom(value => {
      if (!Object.values(complianceManager.REQUEST_TYPES).includes(value)) {
        throw new Error('Invalid request type');
      }
      return true;
    }),
  body('details').optional().isObject().withMessage('Details must be an object'),
];

// Record consent
router.post(
  '/consent',
  auth,
  rateLimiter.api(),
  validateConsent,
  validateRequest,
  async (req, res) => {
    try {
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        version: req.body.version,
        additionalData: req.body.additionalData,
      };

      await complianceManager.recordConsent(
        req.user.id,
        req.body.consentType,
        req.body.granted,
        metadata
      );

      res.json({
        success: true,
        message: 'Consent recorded successfully',
      });
    } catch (err) {
      console.error('Error recording consent:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error recording consent',
      });
    }
  }
);

// Get user's consents
router.get('/consent', auth, rateLimiter.api(), async (req, res) => {
  try {
    const consents = await complianceManager.getConsents(req.user.id);

    res.json({
      success: true,
      data: consents,
    });
  } catch (err) {
    console.error('Error getting consents:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error getting consents',
    });
  }
});

// Create data request
router.post(
  '/data-requests',
  auth,
  rateLimiter.api(),
  validateDataRequest,
  validateRequest,
  async (req, res) => {
    try {
      const request = await complianceManager.createDataRequest(
        req.user.id,
        req.body.requestType,
        req.body.details
      );

      res.json({
        success: true,
        data: request,
        message: 'Data request created successfully',
      });
    } catch (err) {
      console.error('Error creating data request:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error creating data request',
      });
    }
  }
);

// Get user's data requests
router.get('/data-requests', auth, rateLimiter.api(), async (req, res) => {
  try {
    const status = req.query.status || null;
    const requests = await complianceManager.getDataRequests(req.user.id, status);

    res.json({
      success: true,
      data: requests,
    });
  } catch (err) {
    console.error('Error getting data requests:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error getting data requests',
    });
  }
});

// Get supported options
router.get('/options', auth, rateLimiter.api(), async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        consentTypes: complianceManager.CONSENT_TYPES,
        requestTypes: complianceManager.REQUEST_TYPES,
        requestStatus: complianceManager.REQUEST_STATUS,
      },
    });
  } catch (err) {
    console.error('Error getting compliance options:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error getting compliance options',
    });
  }
});

module.exports = router;
