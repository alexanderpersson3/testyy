;
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { DatabaseError, ValidationError } from '../utils/errors.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { DiscoverService } from '../services/discover.service.js';
import logger from '../utils/logger.js';
const router = Router();
const discoverService = DiscoverService.getInstance();
// Validation schemas
const paginationSchema = z.object({
    limit: z.string()
        .optional()
        .transform(val => val ? parseInt(val, 10) : 10)
        .refine(val => val > 0 && val <= 50, 'Limit must be between 1 and 50'),
}).strict();
const categoryParamsSchema = z.object({
    categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID'),
}).strict();
// Get trending recipes
router.get('/trending', rateLimitMiddleware.api(), validateRequest(paginationSchema, 'query'), asyncHandler(async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const recipes = await discoverService.getTrendingRecipes(limit);
        res.json(recipes);
    }
    catch (error) {
        logger.error('Failed to get trending recipes:', error);
        throw new DatabaseError('Failed to get trending recipes');
    }
}));
// Get popular recipes
router.get('/popular', rateLimitMiddleware.api(), validateRequest(paginationSchema, 'query'), asyncHandler(async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const recipes = await discoverService.getPopularRecipes(limit);
        res.json(recipes);
    }
    catch (error) {
        logger.error('Failed to get popular recipes:', error);
        throw new DatabaseError('Failed to get popular recipes');
    }
}));
// Get recent recipes
router.get('/recent', rateLimitMiddleware.api(), validateRequest(paginationSchema, 'query'), asyncHandler(async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const recipes = await discoverService.getRecentRecipes(limit);
        res.json(recipes);
    }
    catch (error) {
        logger.error('Failed to get recent recipes:', error);
        throw new DatabaseError('Failed to get recent recipes');
    }
}));
// Get recommended recipes
router.get('/recommended', auth, rateLimitMiddleware.api(), validateRequest(paginationSchema, 'query'), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const recipes = await discoverService.getRecommendedRecipes(new ObjectId(req.user.id), limit);
        res.json(recipes);
    }
    catch (error) {
        logger.error('Failed to get recommended recipes:', error);
        throw new DatabaseError('Failed to get recommended recipes');
    }
}));
// Get recipe suggestions
router.get('/suggestions', rateLimitMiddleware.api(), validateRequest(paginationSchema, 'query'), asyncHandler(async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const recipes = await discoverService.getRecipeSuggestions(limit);
        res.json(recipes);
    }
    catch (error) {
        logger.error('Failed to get recipe suggestions:', error);
        throw new DatabaseError('Failed to get recipe suggestions');
    }
}));
// Get recipe categories
router.get('/categories', rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    try {
        const categories = await discoverService.getRecipeCategories();
        res.json(categories);
    }
    catch (error) {
        logger.error('Failed to get recipe categories:', error);
        throw new DatabaseError('Failed to get recipe categories');
    }
}));
// Get recipes by category
router.get('/categories/:categoryId', rateLimitMiddleware.api(), validateRequest(categoryParamsSchema, 'params'), validateRequest(paginationSchema, 'query'), asyncHandler(async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const recipes = await discoverService.getRecipesByCategory(new ObjectId(req.params.categoryId), limit);
        res.json(recipes);
    }
    catch (error) {
        logger.error('Failed to get recipes by category:', error);
        throw new DatabaseError('Failed to get recipes by category');
    }
}));
export default router;
//# sourceMappingURL=discover.js.map