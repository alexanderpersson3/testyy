import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../../middleware/validation.js';
import { authenticateToken } from '../../middleware/auth.js';
import rateLimiter from '../../middleware/rate-limit.js';
import analyticsManager from '../../services/admin/analytics-manager.js';

const router = express.Router();

// Validation schemas
const periodSchema = z.object({
  period: z.enum(['24h', '7d', '30d', '90d']).optional()
}).strict();

// Get user statistics
router.get(
  '/users',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    query: periodSchema
  }),
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const stats = await analyticsManager.getUserStats(req.query);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting user stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user statistics'
      });
    }
  }
);

// Get recipe statistics
router.get(
  '/recipes',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    query: periodSchema
  }),
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const stats = await analyticsManager.getRecipeStats(req.query);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting recipe stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get recipe statistics'
      });
    }
  }
);

// Get revenue statistics
router.get(
  '/revenue',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    query: periodSchema
  }),
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const stats = await analyticsManager.getRevenueStats(req.query);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting revenue stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get revenue statistics'
      });
    }
  }
);

// Invalidate analytics cache
router.post(
  '/invalidate-cache',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      await analyticsManager.invalidateCache();

      res.json({
        success: true,
        message: 'Analytics cache invalidated'
      });
    } catch (error) {
      console.error('Error invalidating analytics cache:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to invalidate analytics cache'
      });
    }
  }
);

export default router; 