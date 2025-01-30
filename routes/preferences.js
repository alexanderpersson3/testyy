import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
const { authenticateToken } = require('../middleware/auth');
import rateLimiter from '../middleware/rate-limit.js';
import recipePreferenceManager from '../services/recipe-preference-manager.js';

const router = express.Router();

// Validation schemas
const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  category: z.string().optional(),
  searchQuery: z.string().optional()
});

const preferencesSchema = z.object({
  preferredDiets: z.array(z.string()).default([]),
  excludedDiets: z.array(z.string()).default([]),
  allergens: z.array(z.string()).default([]),
  cuisinePreferences: z.array(z.object({
    cuisine: z.string(),
    likeLevel: z.enum(['high', 'medium', 'low'])
  })).default([])
});

// Get user preferences
router.get(
  '/',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      const preferences = await recipePreferenceManager.getPreferences(req.user.id);

      res.json({
        success: true,
        data: preferences || {}
      });
    } catch (error) {
      console.error('Error getting user preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user preferences'
      });
    }
  }
);

// Update user preferences
router.put(
  '/',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    body: preferencesSchema
  }),
  async (req, res) => {
    try {
      const preferences = await recipePreferenceManager.updatePreferences(
        req.user.id,
        req.body
      );

      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      console.error('Error updating user preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user preferences'
      });
    }
  }
);

// Get filtered recipes
router.get(
  '/recipes',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    query: paginationSchema
  }),
  async (req, res) => {
    try {
      const result = await recipePreferenceManager.getFilteredRecipes(
        req.user.id,
        req.query
      );

      res.json({
        success: true,
        data: result.recipes,
        pagination: {
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          totalItems: result.totalCount
        }
      });
    } catch (error) {
      console.error('Error getting filtered recipes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get filtered recipes'
      });
    }
  }
);

export default router; 