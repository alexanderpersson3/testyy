import express, { Response } from 'express';
import { ObjectId } from 'mongodb';
;
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/async-handler.js';
import { IngredientService } from '../services/ingredient.service.js';
const router = express.Router();
const ingredientService = IngredientService.getInstance();
// Validation schema for custom ingredients
const customIngredientSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
    description: z.string().max(500, 'Description must be at most 500 characters').optional(),
    category: z.string().min(2, 'Category must be at least 2 characters').max(50, 'Category must be at most 50 characters'),
    nutritionalInfo: z.object({
        calories: z.number().nonnegative().optional(),
        protein: z.number().nonnegative().optional(),
        carbs: z.number().nonnegative().optional(),
        fat: z.number().nonnegative().optional(),
        fiber: z.number().nonnegative().optional(),
        vitamins: z.array(z.string()).optional(),
        minerals: z.array(z.string()).optional(),
    }).optional(),
    customPrice: z.number().nonnegative().optional(),
    store: z.string().optional(),
});
// Create custom ingredient
router.post('/', auth, rateLimitMiddleware.api, validateRequest({ body: customIngredientSchema }), asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const ingredient = {
        ...req.body,
        userId: new ObjectId(req.user.id),
        isCustom: true,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    const result = await ingredientService.createCustomIngredient(ingredient);
    res.status(201).json({
        success: true,
        data: result,
    });
}));
// Get user's custom ingredients
router.get('/my-ingredients', auth, rateLimitMiddleware.api, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const ingredients = await ingredientService.getUserCustomIngredients(req.user.id);
    res.json({
        success: true,
        data: ingredients,
    });
}));
// Update custom ingredient
router.put('/:ingredientId', auth, rateLimitMiddleware.api, validateRequest({ body: customIngredientSchema }), asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { ingredientId } = req.params;
    const ingredient = await ingredientService.getCustomIngredient(ingredientId, req.user.id);
    if (!ingredient) {
        return res.status(404).json({
            success: false,
            message: 'Ingredient not found',
        });
    }
    const update = {
        ...req.body,
        updatedAt: new Date(),
    };
    await ingredientService.updateCustomIngredient(ingredientId, req.user.id, update);
    res.json({
        success: true,
        message: 'Ingredient updated successfully',
    });
}));
// Delete custom ingredient
router.delete('/:ingredientId', auth, rateLimitMiddleware.api, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { ingredientId } = req.params;
    const result = await ingredientService.deleteCustomIngredient(ingredientId, req.user.id);
    if (!result) {
        return res.status(404).json({
            success: false,
            message: 'Ingredient not found',
        });
    }
    res.json({
        success: true,
        message: 'Ingredient deleted successfully',
    });
}));
export default router;
//# sourceMappingURL=user-ingredients.js.map