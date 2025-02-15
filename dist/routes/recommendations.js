;
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { DatabaseError, ValidationError, NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { DatabaseService } from '../db/database.service.js';
import { RecommendationService } from '../services/recommendation.service.js';
import { RecommendationType } from '../types/recommendation.js';
const router = Router();
const dbService = DatabaseService.getInstance();
const recommendationService = RecommendationService.getInstance(dbService);
// Validation schemas
const preferencesSchema = z.object({
    cuisinePreferences: z.array(z.string()).optional(),
    dietaryRestrictions: z.array(z.enum([
        'vegetarian',
        'vegan',
        'glutenFree',
        'dairyFree',
        'keto',
        'paleo',
    ])).optional(),
    difficultyPreference: z.enum(['easy', 'medium', 'hard']).optional(),
    maxCookingTime: z.number().positive().optional(),
    excludeIngredients: z.array(z.string()).optional(),
    preferredTags: z.array(z.string()).optional(),
    servingSizePreference: z.number().positive().optional(),
    priceRange: z.enum(['budget', 'moderate', 'expensive']).optional(),
});
// Get recommendations by ingredients
router.post('/by-ingredients', auth, rateLimitMiddleware.api(), validateRequest(z.object({
    ingredients: z.array(z.string()).min(1, 'At least one ingredient is required'),
    limit: z.number().positive().optional(),
    matchThreshold: z.number().min(0).max(1).optional(),
    excludeIds: z.array(z.string()).optional(),
})), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const recommendations = await recommendationService.getRecipesByIngredients(req.body.ingredients, {
            matchThreshold: req.body.matchThreshold,
            excludeIds: req.body.excludeIds?.map((id) => new ObjectId(id)),
            limit: req.body.limit,
        });
        res.json(recommendations);
    }
    catch (error) {
        logger.error('Failed to get recommendations by ingredients:', error);
        throw new DatabaseError('Failed to get recommendations by ingredients');
    }
}));
// Get personalized recommendations
router.get('/personalized', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const recommendations = await recommendationService.getPersonalizedRecommendations(new ObjectId(req.user.id), {
            cuisine: req.query.cuisine,
            difficulty: req.query.difficulty,
            maxTime: req.query.maxTime ? parseInt(req.query.maxTime) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined,
        });
        res.json(recommendations);
    }
    catch (error) {
        logger.error('Failed to get personalized recommendations:', error);
        throw new DatabaseError('Failed to get personalized recommendations');
    }
}));
// Get trending recipes
router.get('/trending', rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    try {
        const trending = await recommendationService.getTrendingRecipes({
            timeframe: req.query.timeframe,
            category: req.query.category,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined,
        });
        res.json(trending);
    }
    catch (error) {
        logger.error('Failed to get trending recipes:', error);
        throw new DatabaseError('Failed to get trending recipes');
    }
}));
// Get similar recipes
router.get('/similar/:recipeId', rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    try {
        const similar = await recommendationService.getRecipesByIngredients([], {
            excludeIds: [new ObjectId(req.params.recipeId)],
            limit: req.query.limit ? parseInt(req.query.limit) : undefined,
        });
        res.json(similar);
    }
    catch (error) {
        logger.error('Failed to get similar recipes:', error);
        throw new DatabaseError('Failed to get similar recipes');
    }
}));
// Get user preferences
router.get('/preferences', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const preferences = await recommendationService.getUserPreferences(new ObjectId(req.user.id));
        res.json(preferences);
    }
    catch (error) {
        logger.error('Failed to get preferences:', error);
        throw new DatabaseError('Failed to get preferences');
    }
}));
// Track recommendation metrics
router.post('/metrics/:type/:action', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const type = req.params.type;
        if (!['similar', 'trending', 'personalized', 'seasonal', 'collaborative', 'dietary', 'difficulty', 'quick', 'new'].includes(type)) {
            throw new ValidationError('Invalid recommendation type');
        }
        await recommendationService.trackMetrics(req.user.id.toString(), type, req.params.action);
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Failed to track metrics:', error);
        throw new DatabaseError('Failed to track metrics');
    }
}));
// Submit recommendation feedback
router.post('/feedback/:recipeId', auth, rateLimitMiddleware.api(), validateRequest(z.object({
    type: z.enum(['similar', 'trending', 'personalized', 'seasonal', 'collaborative', 'dietary', 'difficulty', 'quick', 'new']),
    action: z.enum(['accept', 'reject', 'irrelevant']),
    reason: z.string().optional(),
})), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        await recommendationService.submitFeedback(req.user.id.toString(), req.params.recipeId, req.body.type, req.body.action, req.body.reason);
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Failed to submit feedback:', error);
        throw new DatabaseError('Failed to submit feedback');
    }
}));
export default router;
//# sourceMappingURL=recommendations.js.map