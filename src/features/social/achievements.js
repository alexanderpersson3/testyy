import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../../middleware/validation.js';
import { authenticateToken } from '../../middleware/auth.js';
import rateLimiter from '../../middleware/rate-limit.js';
import achievementManager from '../../services/social/achievement-manager.js';

const router = express.Router();

// Validation schemas
const leaderboardSchema = z
  .object({
    metric: z.enum(['recipes_created', 'total_likes', 'daily_streak']),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  })
  .strict();

// Get leaderboard
router.get(
  '/leaderboard',
  rateLimiter.api(),
  validateRequest({
    query: leaderboardSchema,
  }),
  async (req, res) => {
    try {
      const { metric, limit, offset } = req.query;
      const leaderboard = await achievementManager.getLeaderboard(metric, { limit, offset });

      res.json({
        success: true,
        data: leaderboard,
      });
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get leaderboard',
      });
    }
  }
);

// Get user's badges
router.get('/badges', authenticateToken, rateLimiter.api(), async (req, res) => {
  try {
    const badges = await achievementManager.getUserBadges(req.user.id);

    res.json({
      success: true,
      data: badges,
    });
  } catch (error) {
    console.error('Error getting user badges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get badges',
    });
  }
});

// Get user's rank for a metric
router.get(
  '/rank/:metric',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    params: z.object({
      metric: z.enum(['recipes_created', 'total_likes', 'daily_streak']),
    }),
  }),
  async (req, res) => {
    try {
      const rank = await achievementManager.getUserRank(req.user.id, req.params.metric);

      res.json({
        success: true,
        data: rank,
      });
    } catch (error) {
      console.error('Error getting user rank:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get rank',
      });
    }
  }
);

// Track achievement (internal route for other services)
router.post(
  '/track',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    body: z.object({
      achievementType: z.enum(['recipes_created', 'total_likes', 'daily_streak']),
      value: z.number().int().positive(),
    }),
  }),
  async (req, res) => {
    try {
      const { achievementType, value } = req.body;
      const newBadges = await achievementManager.trackAchievement(
        req.user.id,
        achievementType,
        value
      );

      res.json({
        success: true,
        data: {
          newBadges,
        },
      });
    } catch (error) {
      console.error('Error tracking achievement:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to track achievement',
      });
    }
  }
);

export default router;
