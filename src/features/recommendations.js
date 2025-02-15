import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
const { authenticateToken } = require('../middleware/auth');
import rateLimiter from '../middleware/rate-limit.js';
import recipeRecommendations from '../services/recipe-recommendations.js';
import recipeDifficultyClassifier from '../services/recipe-difficulty-classifier.js';

const router = express.Router();

// Validation schemas
const paginationSchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  offset: z.string().regex(/^\d+$/).transform(Number).default('0'),
});

const timeframeSchema = z.object({
  timeframe: z.enum(['24h', '7d', '30d']).default('7d'),
});

// Get similar recipes
router.get('/similar/:recipeId', rateLimiter.api(), async (req, res) => {
  try {
    const recipes = await recipeRecommendations.getSimilarRecipes(req.params.recipeId, 5);

    res.json({
      success: true,
      data: recipes,
    });
  } catch (error) {
    console.error('Error getting similar recipes:', error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Get top picks
router.get(
  '/top-picks',
  rateLimiter.api(),
  validateRequest({ query: paginationSchema }),
  async (req, res) => {
    try {
      const { limit, offset } = req.query;
      const userId = req.user?.id; // Optional user ID for personalization

      const recipes = await recipeRecommendations.getTopPicks({
        limit,
        offset,
        userId,
      });

      res.json({
        success: true,
        data: recipes,
        pagination: {
          limit,
          offset,
          hasMore: recipes.length === limit,
        },
      });
    } catch (error) {
      console.error('Error getting top picks:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get top picks',
      });
    }
  }
);

// Get trending recipes
router.get(
  '/trending',
  rateLimiter.api(),
  validateRequest({
    query: paginationSchema.merge(timeframeSchema),
  }),
  async (req, res) => {
    try {
      const { limit, offset, timeframe } = req.query;

      const recipes = await recipeRecommendations.getTrendingRecipes({
        limit,
        offset,
        timeframe,
      });

      res.json({
        success: true,
        data: recipes,
        pagination: {
          limit,
          offset,
          hasMore: recipes.length === limit,
        },
      });
    } catch (error) {
      console.error('Error getting trending recipes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get trending recipes',
      });
    }
  }
);

// Classify recipe difficulty (admin only)
router.post('/classify/:recipeId', authenticateToken, rateLimiter.api(), async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      throw new Error('Unauthorized');
    }

    const difficulty = await recipeDifficultyClassifier.classifyRecipe(
      req.params.recipeId,
      req.query.useAI === 'true'
    );

    res.json({
      success: true,
      data: { difficulty },
    });
  } catch (error) {
    console.error('Error classifying recipe:', error);
    res.status(error.message === 'Unauthorized' ? 403 : 400).json({
      success: false,
      message: error.message,
    });
  }
});

// Bulk classify recipes (admin only)
router.post('/classify-all', authenticateToken, rateLimiter.api(), async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      throw new Error('Unauthorized');
    }

    const classified = await recipeDifficultyClassifier.bulkClassifyRecipes(
      req.query.useAI === 'true'
    );

    res.json({
      success: true,
      data: {
        classified,
        message: `Successfully classified ${classified} recipes`,
      },
    });
  } catch (error) {
    console.error('Error bulk classifying recipes:', error);
    res.status(error.message === 'Unauthorized' ? 403 : 500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
