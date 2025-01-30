const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../../middleware/validate-request');
const auth = require('../../middleware/auth');
const onboardingManager = require('../../services/onboarding-manager');
const rateLimiter = require('../../middleware/rate-limit');

// Validation middleware
const validateStepUpdate = [
  body('step')
    .isString()
    .custom(value => {
      if (!Object.values(onboardingManager.ONBOARDING_STEPS).includes(value)) {
        throw new Error('Invalid onboarding step');
      }
      return true;
    }),
  body('status')
    .isString()
    .custom(value => {
      if (!Object.values(onboardingManager.ONBOARDING_STATUS).includes(value)) {
        throw new Error('Invalid status');
      }
      return true;
    }),
  body('data')
    .optional()
    .isObject()
    .withMessage('Data must be an object')
];

// Get onboarding state
router.get(
  '/state',
  auth,
  rateLimiter.api(),
  async (req, res) => {
    try {
      const state = await onboardingManager.getOnboardingState(req.user.id);
      
      res.json({
        success: true,
        data: state
      });
    } catch (err) {
      console.error('Error getting onboarding state:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error getting onboarding state'
      });
    }
  }
);

// Update step progress
router.post(
  '/progress',
  auth,
  rateLimiter.api(),
  validateStepUpdate,
  validateRequest,
  async (req, res) => {
    try {
      const { step, status, data = {} } = req.body;
      
      await onboardingManager.updateStepProgress(
        req.user.id,
        step,
        status,
        data
      );
      
      const nextStep = await onboardingManager.getNextStep(req.user.id);
      
      res.json({
        success: true,
        data: { nextStep },
        message: 'Onboarding progress updated successfully'
      });
    } catch (err) {
      console.error('Error updating onboarding progress:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error updating onboarding progress'
      });
    }
  }
);

// Get next step
router.get(
  '/next-step',
  auth,
  rateLimiter.api(),
  async (req, res) => {
    try {
      const nextStep = await onboardingManager.getNextStep(req.user.id);
      
      res.json({
        success: true,
        data: { nextStep }
      });
    } catch (err) {
      console.error('Error getting next onboarding step:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error getting next onboarding step'
      });
    }
  }
);

// Reset onboarding
router.post(
  '/reset',
  auth,
  rateLimiter.api(),
  async (req, res) => {
    try {
      const newState = await onboardingManager.resetOnboarding(req.user.id);
      
      res.json({
        success: true,
        data: newState,
        message: 'Onboarding reset successfully'
      });
    } catch (err) {
      console.error('Error resetting onboarding:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error resetting onboarding'
      });
    }
  }
);

// Get supported options
router.get(
  '/options',
  auth,
  rateLimiter.api(),
  async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          steps: onboardingManager.ONBOARDING_STEPS,
          status: onboardingManager.ONBOARDING_STATUS
        }
      });
    } catch (err) {
      console.error('Error getting onboarding options:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error getting onboarding options'
      });
    }
  }
);

module.exports = router; 