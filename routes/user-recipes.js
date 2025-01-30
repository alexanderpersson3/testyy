import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
const { authenticateToken } = require('../middleware/auth');
import userRecipeManager from '../services/user-recipe-manager.js';
import rateLimiter from '../middleware/rate-limit.js';
import multer from 'multer';
import imageManager from '../services/image-manager.js';

const router = express.Router();
const upload = multer();

// Validation schemas
const mealPlanSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  recipes: z.array(z.object({
    recipeId: z.string(),
    day: z.string(),
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    servings: z.number().int().positive()
  }))
});

// Save recipe
router.post(
  '/saved-recipes/:recipeId',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      const savedRecipe = await userRecipeManager.saveRecipe(
        req.user.id,
        req.params.recipeId
      );
      res.status(201).json({
        success: true,
        data: savedRecipe
      });
    } catch (error) {
      console.error('Error saving recipe:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get saved recipes
router.get(
  '/saved-recipes',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      const savedRecipes = await userRecipeManager.getSavedRecipes(req.user.id);
      res.json({
        success: true,
        data: savedRecipes
      });
    } catch (error) {
      console.error('Error getting saved recipes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get saved recipes'
      });
    }
  }
);

// Remove saved recipe
router.delete(
  '/saved-recipes/:recipeId',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      await userRecipeManager.unsaveRecipe(req.user.id, req.params.recipeId);
      res.json({
        success: true,
        message: 'Recipe removed from saved recipes'
      });
    } catch (error) {
      console.error('Error removing saved recipe:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Create meal plan
router.post(
  '/meal-plans',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: mealPlanSchema }),
  async (req, res) => {
    try {
      const mealPlan = await userRecipeManager.createMealPlan({
        ...req.body,
        userId: req.user.id
      });
      res.status(201).json({
        success: true,
        data: mealPlan
      });
    } catch (error) {
      console.error('Error creating meal plan:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create meal plan'
      });
    }
  }
);

// Get meal plans
router.get(
  '/meal-plans',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      const mealPlans = await userRecipeManager.getMealPlans(req.user.id);
      res.json({
        success: true,
        data: mealPlans
      });
    } catch (error) {
      console.error('Error getting meal plans:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get meal plans'
      });
    }
  }
);

// Update meal plan
router.put(
  '/meal-plans/:mealPlanId',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: mealPlanSchema }),
  async (req, res) => {
    try {
      const updatedMealPlan = await userRecipeManager.updateMealPlan(
        req.params.mealPlanId,
        req.body
      );
      res.json({
        success: true,
        data: updatedMealPlan
      });
    } catch (error) {
      console.error('Error updating meal plan:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Delete meal plan
router.delete(
  '/meal-plans/:mealPlanId',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      await userRecipeManager.deleteMealPlan(req.user.id, req.params.mealPlanId);
      res.json({
        success: true,
        message: 'Meal plan deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting meal plan:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Upload recipe images
router.post(
  '/recipes/:recipeId/images',
  authenticateToken,
  rateLimiter.api(),
  upload.array('images', 5), // Max 5 images per request
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        throw new Error('No images provided');
      }

      const images = await imageManager.uploadRecipeImages(
        req.params.recipeId,
        req.files.map(file => file.buffer)
      );

      res.status(201).json({
        success: true,
        data: images
      });
    } catch (error) {
      console.error('Error uploading images:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Delete recipe images
router.delete(
  '/recipes/:recipeId/images',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    body: z.object({
      imageIds: z.array(z.string())
    })
  }),
  async (req, res) => {
    try {
      await imageManager.deleteRecipeImages(
        req.params.recipeId,
        req.body.imageIds
      );
      res.json({
        success: true,
        message: 'Images deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting images:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

export default router; 