import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
const { authenticateToken } = require('../middleware/auth');
import rateLimiter from '../middleware/rate-limit.js';
import settingsManager from '../services/settings-manager.js';

const router = express.Router();

// Validation schemas
const measurementSchema = z.object({
  system: z.enum(['metric', 'imperial']),
  autoConvert: z.boolean(),
  temperature: z.enum(['celsius', 'fahrenheit'])
});

const notificationSchema = z.object({
  push: z.object({
    comments: z.boolean(),
    followers: z.boolean(),
    messages: z.boolean(),
    mealPlanReminders: z.boolean(),
    weeklyDigest: z.boolean()
  }),
  email: z.object({
    newsletter: z.boolean(),
    marketing: z.boolean(),
    updates: z.boolean(),
    transactional: z.boolean()
  })
});

const appearanceSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  language: z.string(),
  fontSize: z.enum(['small', 'medium', 'large'])
});

const privacySchema = z.object({
  dataCollection: z.boolean(),
  analytics: z.boolean(),
  thirdPartySharing: z.boolean(),
  cookiePreferences: z.object({
    necessary: z.literal(true),
    functional: z.boolean(),
    analytics: z.boolean(),
    advertising: z.boolean()
  })
});

// Get all settings
router.get(
  '/',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      const settings = await settingsManager.getSettings(req.user.id);

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error getting settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get settings'
      });
    }
  }
);

// Update measurement settings
router.patch(
  '/measurement',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: measurementSchema }),
  async (req, res) => {
    try {
      const settings = await settingsManager.updateMeasurementSettings(
        req.user.id,
        req.body
      );

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error updating measurement settings:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Update notification settings
router.patch(
  '/notifications',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: notificationSchema }),
  async (req, res) => {
    try {
      const settings = await settingsManager.updateNotificationSettings(
        req.user.id,
        req.body
      );

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error updating notification settings:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Update appearance settings
router.patch(
  '/appearance',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: appearanceSchema }),
  async (req, res) => {
    try {
      const settings = await settingsManager.updateAppearanceSettings(
        req.user.id,
        req.body
      );

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error updating appearance settings:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Update privacy settings
router.patch(
  '/privacy',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: privacySchema }),
  async (req, res) => {
    try {
      const settings = await settingsManager.updatePrivacySettings(
        req.user.id,
        req.body
      );

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Clear app cache
router.post(
  '/clear-cache',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      await settingsManager.clearCache(req.user.id);

      res.json({
        success: true,
        message: 'Cache cleared successfully'
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear cache'
      });
    }
  }
);

// Delete account
router.delete(
  '/account',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      await settingsManager.deleteAccount(req.user.id);

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting account:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete account'
      });
    }
  }
);

export default router; 