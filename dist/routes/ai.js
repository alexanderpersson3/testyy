;
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { AIService } from '../services/ai.service.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { DatabaseError, ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const router = Router();
const aiService = AIService.getInstance();
// Validation schemas
const recipeSchema = z.object({
    ingredients: z.array(z.string()),
    preferences: z.object({
        cuisine: z.string().optional(),
        dietary: z.array(z.string()).optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
        maxTime: z.number().optional(),
    }).optional(),
});
// Generate recipe
router.post('/generate', auth, rateLimitMiddleware.api(), validateRequest(recipeSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const recipe = await aiService.generateRecipe({
            ingredients: req.body.ingredients,
            preferences: req.body.preferences,
        });
        res.json(recipe);
    }
    catch (error) {
        logger.error('Failed to generate recipe:', error);
        throw new DatabaseError('Failed to generate recipe');
    }
}));
// Get recipe suggestions
router.post('/suggest', auth, rateLimitMiddleware.api(), validateRequest(recipeSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const recipe = await aiService.generateRecipe({
            ingredients: req.body.ingredients,
            preferences: req.body.preferences,
        });
        res.json(recipe);
    }
    catch (error) {
        logger.error('Failed to get suggestions:', error);
        throw new DatabaseError('Failed to get suggestions');
    }
}));
// Analyze recipe
router.post('/analyze/:recipeId', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const { recipeId } = req.params;
        const analysis = await aiService.generateRecipe({
            ingredients: [],
            preferences: {
                maxTime: 30, // Default to 30 minutes for analysis
                difficulty: 'medium', // Default to medium difficulty
            }
        });
        res.json({ analysis });
    }
    catch (error) {
        logger.error('Failed to analyze recipe:', error);
        throw new DatabaseError('Failed to analyze recipe');
    }
}));
export default router;
//# sourceMappingURL=ai.js.map