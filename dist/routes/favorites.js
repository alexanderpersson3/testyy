;
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { FavoritesService } from '../services/favorites.service.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { DatabaseError, NotFoundError, ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { z } from 'zod';
const router = Router();
const favoritesService = FavoritesService.getInstance();
// Validation schemas
const favoriteItemSchema = z.object({
    itemId: z.string().refine(val => ObjectId.isValid(val), 'Invalid item ID'),
    itemType: z.enum(['recipe', 'ingredient']),
});
const updateFavoriteSchema = z.object({
    customName: z.string().optional(),
    defaultQuantity: z.number().min(0).optional(),
    defaultUnit: z.string().optional(),
    notes: z.string().optional(),
});
const filterSchema = z.object({
    itemType: z.enum(['recipe', 'ingredient']).optional(),
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(50).optional(),
});
// Get user's favorite items
router.get('/', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user?._id) {
        throw new ValidationError('Authentication required');
    }
    try {
        const favorites = await favoritesService.getFavorites(req.user._id);
        res.json({ favorites });
    }
    catch (error) {
        logger.error('Failed to get favorites:', error);
        throw new DatabaseError('Failed to get favorites');
    }
}));
// Add item to favorites
router.post('/', auth, rateLimitMiddleware.api(), validateRequest(favoriteItemSchema), asyncHandler(async (req, res) => {
    if (!req.user?._id) {
        throw new ValidationError('Authentication required');
    }
    try {
        await favoritesService.addFavorite(req.user._id, new ObjectId(req.body.itemId), req.body.itemType);
        res.json({ message: 'Item added to favorites' });
    }
    catch (error) {
        logger.error('Failed to add favorite:', error);
        throw new DatabaseError('Failed to add favorite');
    }
}));
// Update favorite item
router.patch('/:id', auth, rateLimitMiddleware.api(), validateRequest(updateFavoriteSchema), asyncHandler(async (req, res) => {
    if (!req.user?._id) {
        throw new ValidationError('Authentication required');
    }
    try {
        const result = await favoritesService.updateFavorite(new ObjectId(req.params.id), req.user._id, req.body);
        if (!result) {
            throw new NotFoundError('Favorite item not found');
        }
        res.json({ message: 'Favorite item updated successfully' });
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to update favorite:', error);
        throw new DatabaseError('Failed to update favorite');
    }
}));
// Remove item from favorites
router.delete('/:itemId', auth, rateLimitMiddleware.api(), validateRequest(favoriteItemSchema.pick({ itemType: true })), asyncHandler(async (req, res) => {
    if (!req.user?._id) {
        throw new ValidationError('Authentication required');
    }
    try {
        await favoritesService.removeFavorite(req.user._id, new ObjectId(req.params.itemId), req.query.itemType);
        res.json({ message: 'Item removed from favorites' });
    }
    catch (error) {
        logger.error('Failed to remove favorite:', error);
        throw new DatabaseError('Failed to remove favorite');
    }
}));
// Add favorite item to shopping list
router.post('/:id/add-to-list/:listId', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user?._id) {
        throw new ValidationError('Authentication required');
    }
    try {
        const result = await favoritesService.addFavoriteToShoppingList(req.user._id, new ObjectId(req.params.id), new ObjectId(req.params.listId));
        res.status(201).json({
            message: 'Item added to shopping list',
            item: result
        });
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to add item to shopping list:', error);
        throw new DatabaseError('Failed to add item to shopping list');
    }
}));
// Get user's favorites with filtering
router.get('/filter', auth, rateLimitMiddleware.api(), validateRequest(filterSchema), asyncHandler(async (req, res) => {
    if (!req.user?._id) {
        throw new ValidationError('Authentication required');
    }
    try {
        const itemType = req.query.itemType;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        if (itemType === 'recipe') {
            const { recipes, total } = await favoritesService.getFavoriteRecipes(req.user._id, page, limit);
            res.json({ recipes, total, page, limit });
        }
        else {
            const favorites = await favoritesService.getFavorites(req.user._id, itemType);
            res.json({ favorites });
        }
    }
    catch (error) {
        logger.error('Failed to get filtered favorites:', error);
        throw new DatabaseError('Failed to get filtered favorites');
    }
}));
// Check if item is favorited
router.get('/:itemId/check', auth, rateLimitMiddleware.api(), validateRequest(favoriteItemSchema.pick({ itemType: true })), asyncHandler(async (req, res) => {
    if (!req.user?._id) {
        throw new ValidationError('Authentication required');
    }
    try {
        const isFavorite = await favoritesService.isFavorite(req.user._id, new ObjectId(req.params.itemId), req.query.itemType);
        res.json({ isFavorite });
    }
    catch (error) {
        logger.error('Failed to check favorite status:', error);
        throw new DatabaseError('Failed to check favorite status');
    }
}));
// Get popular recipes (no auth required)
router.get('/popular/recipes', rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const recipes = await favoritesService.getPopularRecipes(limit);
        res.json({ recipes });
    }
    catch (error) {
        logger.error('Failed to get popular recipes:', error);
        throw new DatabaseError('Failed to get popular recipes');
    }
}));
export default router;
//# sourceMappingURL=favorites.js.map