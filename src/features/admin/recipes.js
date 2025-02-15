import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../../middleware/validation.js';
import { authenticateToken } from '../../middleware/auth.js';
import rateLimiter from '../../middleware/rate-limit.js';
import recipeManager from '../../services/admin/recipe-manager.js';

const router = express.Router();

// Validation schemas
const recipeSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    servings: z.number().int().positive(),
    prepTime: z.number().int().positive(),
    cookTime: z.number().int().positive(),
    ingredients: z
      .array(
        z.object({
          name: z.string().min(1),
          amount: z.number().positive(),
          unit: z.string().min(1),
        })
      )
      .min(1),
    instructions: z.array(z.string().min(1)).min(1),
    tags: z.array(z.string()).optional(),
  })
  .strict();

const importSchema = z
  .object({
    content: z.string().min(1),
  })
  .strict();

const scheduleSchema = z
  .object({
    recipeId: z.string(),
    date: z.string().datetime(),
    category: z.string().optional(),
    priorityOrder: z.number().int().min(0).optional(),
  })
  .strict();

const dateRangeSchema = z
  .object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  })
  .strict();

// Create a new recipe
router.post(
  '/',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    body: recipeSchema,
  }),
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const recipe = await recipeManager.createRecipe(req.body, req.user.id);

      res.json({
        success: true,
        data: recipe,
      });
    } catch (error) {
      console.error('Error creating recipe:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create recipe',
      });
    }
  }
);

// Import recipe using AI
router.post(
  '/import',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    body: importSchema,
  }),
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const parsedRecipe = await recipeManager.importRecipeWithAI(req.body.content);

      res.json({
        success: true,
        data: parsedRecipe,
      });
    } catch (error) {
      console.error('Error importing recipe:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to import recipe',
      });
    }
  }
);

// Schedule a recipe
router.post(
  '/schedule',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    body: scheduleSchema,
  }),
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { recipeId, date, category, priorityOrder } = req.body;
      const schedule = await recipeManager.scheduleRecipe(recipeId, date, category, priorityOrder);

      res.json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      console.error('Error scheduling recipe:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to schedule recipe',
      });
    }
  }
);

// Get scheduled recipes
router.get(
  '/schedule',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    query: dateRangeSchema,
  }),
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { startDate, endDate } = req.query;
      const schedules = await recipeManager.getScheduledRecipes(startDate, endDate);

      res.json({
        success: true,
        data: schedules,
      });
    } catch (error) {
      console.error('Error getting scheduled recipes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get scheduled recipes',
      });
    }
  }
);

// Remove a recipe schedule
router.delete('/schedule/:scheduleId', authenticateToken, rateLimiter.api(), async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const success = await recipeManager.removeSchedule(req.params.scheduleId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found',
      });
    }

    res.json({
      success: true,
      message: 'Schedule removed successfully',
    });
  } catch (error) {
    console.error('Error removing schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove schedule',
    });
  }
});

export default router;
