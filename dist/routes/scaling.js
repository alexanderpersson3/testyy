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
import { ScalingService } from '../services/scaling.service.js';
const router = Router();
const dbService = DatabaseService.getInstance();
const scalingService = ScalingService.getInstance();
// Validation schemas
const scaleRecipeSchema = z.object({
    targetServings: z.number().positive(),
});
const unitConversionSchema = z.object({
    preferredUnits: z.object({
        volume: z.string().optional(),
        weight: z.string().optional(),
        length: z.string().optional(),
        temperature: z.enum(['C', 'F']).optional(),
    }),
});
// Scale recipe servings
router.post('/:id/scale', auth, rateLimitMiddleware.api(), validateRequest(scaleRecipeSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const scaledRecipe = await scalingService.scaleServings(new ObjectId(req.params.id), req.body.targetServings, new ObjectId(req.user.id));
        res.json(scaledRecipe);
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to scale recipe:', error);
        throw new DatabaseError('Failed to scale recipe');
    }
}));
// Get scaling history
router.get('/:id/history', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    try {
        const history = await scalingService.getScalingHistory(new ObjectId(req.params.id));
        res.json(history);
    }
    catch (error) {
        logger.error('Failed to get scaling history:', error);
        throw new DatabaseError('Failed to get scaling history');
    }
}));
// Get popular scaling factors
router.get('/:id/popular', rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    try {
        const factors = await scalingService.getPopularScalingFactors(new ObjectId(req.params.id));
        res.json(factors);
    }
    catch (error) {
        logger.error('Failed to get popular scaling factors:', error);
        throw new DatabaseError('Failed to get popular scaling factors');
    }
}));
// Convert units
router.post('/:id/convert', auth, rateLimitMiddleware.api(), validateRequest(unitConversionSchema), asyncHandler(async (req, res) => {
    try {
        const converted = await scalingService.convertUnits(new ObjectId(req.params.id), req.body.preferredUnits);
        res.json(converted);
    }
    catch (error) {
        logger.error('Failed to convert units:', error);
        throw new DatabaseError('Failed to convert units');
    }
}));
export default router;
//# sourceMappingURL=scaling.js.map