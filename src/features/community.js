import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
const { authenticateToken } = require('../middleware/auth');
import rateLimiter from '../middleware/rate-limit.js';
import recipePopularityManager from '../services/recipe-popularity-manager.js';

const router = express.Router();

// Validation schemas
const paginationSchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  offset: z.string().regex(/^\d+$/).transform(Number).default('0'),
});

const filterSchema = z.object({
  timeRange: z.number().optional(),
  category: z.string().optional(),
  dietaryPreferences: z.array(z.string()).optional(),
});

// Get top community recipes
router.get(
  '/top',
  rateLimiter.api(),
  validateRequest({
    query: paginationSchema.merge(filterSchema),
  }),
  async (req, res) => {
    try {
      // Try to get cached recipes first
      let recipes = null;
      const cacheKey = recipePopularityManager.COMMUNITY_RECIPES_CACHE_KEY;

      // Only use cache for default queries
      if (
        !req.query.timeRange &&
        !req.query.category &&
        !req.query.dietaryPreferences &&
        req.query.offset === 0
      ) {
        recipes = await recipePopularityManager.getCachedRecipes(cacheKey);
      }

      if (!recipes) {
        recipes = await recipePopularityManager.getTopRecipes(req.query);

        // Cache only default queries
        if (
          !req.query.timeRange &&
          !req.query.category &&
          !req.query.dietaryPreferences &&
          req.query.offset === 0
        ) {
          await recipePopularityManager.cacheRecipes(cacheKey, recipes);
        }
      }

      res.json({
        success: true,
        data: recipes,
      });
    } catch (error) {
      console.error('Error getting top community recipes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get top community recipes',
      });
    }
  }
);

// Get rising community recipes
router.get(
  '/rising',
  rateLimiter.api(),
  validateRequest({
    query: paginationSchema.merge(filterSchema),
  }),
  async (req, res) => {
    try {
      // Try to get cached recipes first
      let recipes = null;
      const cacheKey = recipePopularityManager.RISING_RECIPES_CACHE_KEY;

      // Only use cache for default queries
      if (!req.query.category && !req.query.dietaryPreferences && req.query.offset === 0) {
        recipes = await recipePopularityManager.getCachedRecipes(cacheKey);
      }

      if (!recipes) {
        recipes = await recipePopularityManager.getRisingRecipes(req.query);

        // Cache only default queries
        if (!req.query.category && !req.query.dietaryPreferences && req.query.offset === 0) {
          await recipePopularityManager.cacheRecipes(cacheKey, recipes);
        }
      }

      res.json({
        success: true,
        data: recipes,
      });
    } catch (error) {
      console.error('Error getting rising community recipes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get rising community recipes',
      });
    }
  }
);

// Track recipe interaction
router.post(
  '/:recipeId/interaction',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    body: z.object({
      type: z.enum(['view', 'like', 'comment', 'save', 'share']),
      timeSpent: z.number().optional(),
    }),
  }),
  async (req, res) => {
    try {
      await recipePopularityManager.updateMetrics(
        req.params.recipeId,
        req.body.type,
        req.body.timeSpent
      );

      res.json({
        success: true,
        message: 'Interaction tracked successfully',
      });
    } catch (error) {
      console.error('Error tracking recipe interaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to track interaction',
      });
    }
  }
);

// Update popularity scores (admin only)
router.post('/update-scores', authenticateToken, rateLimiter.api(), async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      throw new Error('Unauthorized');
    }

    const count = await recipePopularityManager.updatePopularityScores();

    res.json({
      success: true,
      message: `Updated scores for ${count} recipes`,
    });
  } catch (error) {
    console.error('Error updating popularity scores:', error);
    res.status(error.message === 'Unauthorized' ? 403 : 500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
