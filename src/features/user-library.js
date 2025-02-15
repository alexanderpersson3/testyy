import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
const { authenticateToken } = require('../middleware/auth');
import userRecipeLibrary from '../services/user-recipe-library.js';
import rateLimiter from '../middleware/rate-limit.js';
import recipeListManager from '../services/recipe-list-manager.js';
import savedRecipeManager from '../services/saved-recipe-manager.js';

const router = express.Router();

// Validation schemas
const createListSchema = z.object({
  name: z.string().min(1, 'List name is required').max(100, 'List name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
});

const updateListSchema = z.object({
  name: z.string().min(1, 'List name is required').max(100, 'List name is too long').optional(),
  description: z.string().max(500, 'Description is too long').optional(),
});

const listQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  sort: z.enum(['newest', 'oldest', 'nameAsc', 'nameDesc']).optional(),
});

// Recipe Lists Routes

// Create a new list
router.post(
  '/lists',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: createListSchema }),
  async (req, res) => {
    try {
      const list = await recipeListManager.createList(req.user.id, req.body);

      res.status(201).json({
        success: true,
        data: list,
      });
    } catch (error) {
      console.error('Error creating list:', error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Update a list
router.patch(
  '/lists/:listId',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: updateListSchema }),
  async (req, res) => {
    try {
      const list = await recipeListManager.updateList(req.user.id, req.params.listId, req.body);

      res.json({
        success: true,
        data: list,
      });
    } catch (error) {
      console.error('Error updating list:', error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Delete a list
router.delete('/lists/:listId', authenticateToken, rateLimiter.api(), async (req, res) => {
  try {
    await recipeListManager.deleteList(req.user.id, req.params.listId);

    res.json({
      success: true,
      message: 'List deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting list:', error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Get user's lists
router.get('/lists', authenticateToken, rateLimiter.api(), async (req, res) => {
  try {
    const lists = await recipeListManager.getUserLists(req.user.id);

    res.json({
      success: true,
      data: lists,
    });
  } catch (error) {
    console.error('Error getting lists:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get lists',
    });
  }
});

// Get recipes in a list
router.get(
  '/lists/:listId/recipes',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ query: listQuerySchema }),
  async (req, res) => {
    try {
      const recipes = await recipeListManager.getListRecipes(
        req.user.id,
        req.params.listId,
        req.query
      );

      res.json({
        success: true,
        data: recipes,
      });
    } catch (error) {
      console.error('Error getting list recipes:', error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Add recipe to list
router.post(
  '/lists/:listId/recipes/:recipeId',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      const recipe = await recipeListManager.addRecipeToList(
        req.user.id,
        req.params.listId,
        req.params.recipeId
      );

      res.status(201).json({
        success: true,
        data: recipe,
      });
    } catch (error) {
      console.error('Error adding recipe to list:', error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Remove recipe from list
router.delete(
  '/lists/:listId/recipes/:recipeId',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      await recipeListManager.removeRecipeFromList(
        req.user.id,
        req.params.listId,
        req.params.recipeId
      );

      res.json({
        success: true,
        message: 'Recipe removed from list successfully',
      });
    } catch (error) {
      console.error('Error removing recipe from list:', error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Move recipe between lists
router.post(
  '/lists/:fromListId/recipes/:recipeId/move/:toListId',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      await recipeListManager.moveRecipeBetweenLists(
        req.user.id,
        req.params.recipeId,
        req.params.fromListId,
        req.params.toListId
      );

      res.json({
        success: true,
        message: 'Recipe moved successfully',
      });
    } catch (error) {
      console.error('Error moving recipe:', error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Saved Recipes Routes

// Save a recipe
router.post('/saved-recipes/:recipeId', authenticateToken, rateLimiter.api(), async (req, res) => {
  try {
    const recipe = await savedRecipeManager.saveRecipe(req.user.id, req.params.recipeId);

    res.status(201).json({
      success: true,
      data: recipe,
    });
  } catch (error) {
    console.error('Error saving recipe:', error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Remove saved recipe
router.delete(
  '/saved-recipes/:recipeId',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      await savedRecipeManager.removeRecipe(req.user.id, req.params.recipeId);

      res.json({
        success: true,
        message: 'Recipe removed successfully',
      });
    } catch (error) {
      console.error('Error removing recipe:', error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Get saved recipes
router.get(
  '/saved-recipes',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ query: listQuerySchema }),
  async (req, res) => {
    try {
      const recipes = await savedRecipeManager.getSavedRecipes(req.user.id, req.query);

      res.json({
        success: true,
        data: recipes,
      });
    } catch (error) {
      console.error('Error getting saved recipes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get saved recipes',
      });
    }
  }
);

// Get recipe save status
router.get(
  '/saved-recipes/:recipeId/status',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      const status = await savedRecipeManager.getRecipeSaveStatus(req.user.id, req.params.recipeId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('Error getting recipe save status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get recipe save status',
      });
    }
  }
);

export default router;
