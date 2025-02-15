import express, {} from 'express';
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { validateRequest } from '../middleware/validate.js';
import { IngredientService } from '../services/ingredient.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateIngredient } from '../middleware/validation.js';
const router = express.Router();
const ingredientService = IngredientService.getInstance();
// Get all ingredients
router.get('/', asyncHandler(async (req, res) => {
    const ingredients = await ingredientService.searchIngredients({});
    res.json(ingredients);
}));
// Search ingredients
router.get('/search', rateLimitMiddleware.api(), async (req, res) => {
    try {
        const { query, source, category, tags, isVerified, limit, offset } = req.query;
        const searchQuery = {
            query: typeof query === 'string' ? query : undefined,
            source: source,
            category: typeof category === 'string' ? category : undefined,
            tags: Array.isArray(tags) ? tags.map(String) : undefined,
            isVerified: isVerified === 'true',
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        };
        const results = await ingredientService.searchIngredients(searchQuery);
        return res.json(results);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to search ingredients' });
    }
});
// Get ingredient by ID
router.get('/:id', rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ error: 'Ingredient ID is required' });
    }
    try {
        const ingredient = await ingredientService.getIngredientWithPrices(id);
        if (!ingredient) {
            return res.status(404).json({ error: 'Ingredient not found' });
        }
        return res.json(ingredient);
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Ingredient not found') {
            return res.status(404).json({ error: 'Ingredient not found' });
        }
        return res.status(500).json({ error: 'Failed to fetch ingredient' });
    }
}));
// Create new ingredient (admin only)
router.post('/', auth, requireAdmin, rateLimitMiddleware.api(), validateIngredient, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const ingredientId = await ingredientService.createIngredient(req.user.id, req.body);
        res.status(201).json({ id: ingredientId });
    }
    catch (error) {
        if (error instanceof Error) {
            return res.status(500).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Failed to create ingredient' });
    }
}));
// Update ingredient
router.put('/:id', auth, rateLimitMiddleware.api(), validateIngredient, asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!id) {
            return res.status(400).json({ error: 'Ingredient ID is required' });
        }
        await ingredientService.updateIngredient(id, req.user.id, req.body);
        return res.json({ success: true });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Ingredient not found') {
            return res.status(404).json({ error: 'Ingredient not found' });
        }
        if (error instanceof Error && error.message === 'Not authorized to update this ingredient') {
            return res.status(403).json({ error: 'Not authorized to update this ingredient' });
        }
        return res.status(500).json({ error: 'Failed to update ingredient' });
    }
}));
// Delete ingredient
router.delete('/:id', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!id) {
            return res.status(400).json({ error: 'Ingredient ID is required' });
        }
        await ingredientService.deleteIngredient(id, req.user.id);
        return res.status(204).send();
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Ingredient not found') {
            return res.status(404).json({ error: 'Ingredient not found' });
        }
        if (error instanceof Error && error.message === 'Not authorized to delete this ingredient') {
            return res.status(403).json({ error: 'Not authorized to delete this ingredient' });
        }
        return res.status(500).json({ error: 'Failed to delete ingredient' });
    }
}));
export default router;
//# sourceMappingURL=ingredients.js.map