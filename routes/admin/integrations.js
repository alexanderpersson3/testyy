const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { body, param } = require('express-validator');
const { validateRequest } = require('../../middleware/validate-request');
const integrationsManager = require('../../services/integrations-manager');
const { getDb } = require('../../db');
const { ObjectId } = require('mongodb');

// Helper function to check if user is admin
async function isAdmin(userId) {
  const db = getDb();
  const user = await db.collection('users').findOne({
    _id: new ObjectId(userId)
  });
  return user && user.role === 'admin';
}

// Middleware to ensure admin access
async function requireAdmin(req, res, next) {
  try {
    if (!await isAdmin(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

// Validation middleware
const validateIntegration = [
  body('type').isIn(Object.values(integrationsManager.integrationTypes))
    .withMessage('Invalid integration type'),
  body('config').isObject().withMessage('Config must be an object'),
  body('config.apiKey').isString().withMessage('API key is required'),
  body('config.testEndpoint').isURL().withMessage('Valid test endpoint URL is required')
];

// Register a new integration
router.post(
  '/',
  auth,
  requireAdmin,
  validateIntegration,
  validateRequest,
  async (req, res) => {
    try {
      const { type, config } = req.body;
      const result = await integrationsManager.registerIntegration(type, config);

      res.status(201).json({
        success: true,
        data: {
          integrationId: result.insertedId,
          message: 'Integration registered successfully'
        }
      });
    } catch (err) {
      console.error('Error registering integration:', err);
      res.status(500).json({
        success: false,
        message: 'Error registering integration'
      });
    }
  }
);

// List all integrations
router.get(
  '/',
  auth,
  requireAdmin,
  async (req, res) => {
    try {
      const { type } = req.query;
      const integrations = await integrationsManager.listIntegrations(type);

      res.json({
        success: true,
        data: integrations
      });
    } catch (err) {
      console.error('Error listing integrations:', err);
      res.status(500).json({
        success: false,
        message: 'Error listing integrations'
      });
    }
  }
);

// Get integration details
router.get(
  '/:integrationId',
  auth,
  requireAdmin,
  param('integrationId').isMongoId(),
  validateRequest,
  async (req, res) => {
    try {
      const integration = await integrationsManager.getIntegration(req.params.integrationId);
      
      if (!integration) {
        return res.status(404).json({
          success: false,
          message: 'Integration not found'
        });
      }

      res.json({
        success: true,
        data: integration
      });
    } catch (err) {
      console.error('Error getting integration:', err);
      res.status(500).json({
        success: false,
        message: 'Error getting integration'
      });
    }
  }
);

// Update integration
router.put(
  '/:integrationId',
  auth,
  requireAdmin,
  param('integrationId').isMongoId(),
  body('config').isObject().optional(),
  body('status').isIn(['active', 'inactive']).optional(),
  validateRequest,
  async (req, res) => {
    try {
      const { config, status } = req.body;
      const updates = {};
      
      if (config) updates.config = config;
      if (status) updates.status = status;

      const result = await integrationsManager.updateIntegration(
        req.params.integrationId,
        updates
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Integration not found'
        });
      }

      res.json({
        success: true,
        message: 'Integration updated successfully'
      });
    } catch (err) {
      console.error('Error updating integration:', err);
      res.status(500).json({
        success: false,
        message: 'Error updating integration'
      });
    }
  }
);

// Delete integration
router.delete(
  '/:integrationId',
  auth,
  requireAdmin,
  param('integrationId').isMongoId(),
  validateRequest,
  async (req, res) => {
    try {
      const result = await integrationsManager.deleteIntegration(req.params.integrationId);

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Integration not found'
        });
      }

      res.json({
        success: true,
        message: 'Integration deleted successfully'
      });
    } catch (err) {
      console.error('Error deleting integration:', err);
      res.status(500).json({
        success: false,
        message: 'Error deleting integration'
      });
    }
  }
);

// Test integration
router.post(
  '/:integrationId/test',
  auth,
  requireAdmin,
  param('integrationId').isMongoId(),
  validateRequest,
  async (req, res) => {
    try {
      const testResult = await integrationsManager.testIntegration(req.params.integrationId);

      res.json({
        success: true,
        data: testResult
      });
    } catch (err) {
      console.error('Error testing integration:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Error testing integration'
      });
    }
  }
);

module.exports = router; 