import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
const { authenticateToken } = require('../middleware/auth');
import rateLimiter from '../middleware/rate-limit.js';
import creatorLeaderboardManager from '../services/creator-leaderboard-manager.js';

const router = express.Router();

// Validation schemas
const paginationSchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  offset: z.string().regex(/^\d+$/).transform(Number).default('0')
});

const timeRangeSchema = z.object({
  timeRange: z.number().optional() // days
});

// Get top creators
router.get(
  '/top',
  rateLimiter.api(),
  validateRequest({
    query: paginationSchema.merge(timeRangeSchema)
  }),
  async (req, res) => {
    try {
      // Try to get cached creators first
      let creators = null;
      const cacheKey = creatorLeaderboardManager.TOP_CREATORS_CACHE_KEY;

      // Only use cache for default queries
      if (!req.query.timeRange && req.query.offset === 0) {
        creators = await creatorLeaderboardManager.getCachedCreators(cacheKey);
      }

      if (!creators) {
        creators = await creatorLeaderboardManager.getTopCreators(req.query);

        // Cache only default queries
        if (!req.query.timeRange && req.query.offset === 0) {
          await creatorLeaderboardManager.cacheCreators(cacheKey, creators);
        }
      }

      res.json({
        success: true,
        data: creators
      });
    } catch (error) {
      console.error('Error getting top creators:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get top creators'
      });
    }
  }
);

// Get rising creators
router.get(
  '/rising',
  rateLimiter.api(),
  validateRequest({
    query: paginationSchema
  }),
  async (req, res) => {
    try {
      // Try to get cached creators first
      let creators = null;
      const cacheKey = creatorLeaderboardManager.RISING_CREATORS_CACHE_KEY;

      // Only use cache for default queries
      if (req.query.offset === 0) {
        creators = await creatorLeaderboardManager.getCachedCreators(cacheKey);
      }

      if (!creators) {
        creators = await creatorLeaderboardManager.getRisingCreators(req.query);

        // Cache only default queries
        if (req.query.offset === 0) {
          await creatorLeaderboardManager.cacheCreators(cacheKey, creators);
        }
      }

      res.json({
        success: true,
        data: creators
      });
    } catch (error) {
      console.error('Error getting rising creators:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get rising creators'
      });
    }
  }
);

// Get creator rank
router.get(
  '/rank/:userId',
  rateLimiter.api(),
  async (req, res) => {
    try {
      const db = getDb();
      const userId = new ObjectId(req.params.userId);

      // Get user's rank by counting users with higher scores
      const user = await db.collection('users').findOne(
        { _id: userId },
        { projection: { creatorScore: 1 } }
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Creator not found'
        });
      }

      const rank = await db.collection('users').countDocuments({
        creatorScore: { $gt: user.creatorScore }
      });

      res.json({
        success: true,
        data: {
          rank: rank + 1, // Add 1 since rank is 0-based
          score: user.creatorScore
        }
      });
    } catch (error) {
      console.error('Error getting creator rank:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get creator rank'
      });
    }
  }
);

// Update creator stats (admin only)
router.post(
  '/update-stats',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        throw new Error('Unauthorized');
      }

      const count = await creatorLeaderboardManager.updateCreatorStats();

      res.json({
        success: true,
        message: `Updated stats for ${count} creators`
      });
    } catch (error) {
      console.error('Error updating creator stats:', error);
      res.status(error.message === 'Unauthorized' ? 403 : 500).json({
        success: false,
        message: error.message
      });
    }
  }
);

export default router; 