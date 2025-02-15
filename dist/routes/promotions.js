;
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { PromotionService } from '../services/promotion.service.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { DatabaseError, NotFoundError, ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { z } from 'zod';
const router = Router();
const promotionService = PromotionService.getInstance();
// Validation schemas
const createPromotionSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().min(1, 'Description is required'),
    startDate: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid start date'),
    endDate: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid end date'),
    discountPercentage: z.number().min(0).max(100),
    itemId: z.string().refine(val => ObjectId.isValid(val), 'Invalid item ID'),
    itemType: z.enum(['recipe', 'ingredient']),
});
const updatePromotionSchema = createPromotionSchema.partial().extend({
    status: z.enum(['active', 'inactive']).optional(),
});
// Get all active promotions
router.get('/', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user?._id) {
        throw new ValidationError('Authentication required');
    }
    try {
        const promotions = await promotionService.getActivePromotions(req.user._id);
        res.json({ promotions });
    }
    catch (error) {
        logger.error('Failed to get promotions:', error);
        throw new DatabaseError('Failed to get promotions');
    }
}));
// Get promotion by ID
router.get('/:id', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user?._id) {
        throw new ValidationError('Authentication required');
    }
    try {
        const promotion = await promotionService.getPromotionById(new ObjectId(req.params.id), req.user._id);
        if (!promotion) {
            throw new NotFoundError('Promotion not found');
        }
        res.json({ promotion });
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to get promotion:', error);
        throw new DatabaseError('Failed to get promotion');
    }
}));
// Create new promotion
router.post('/', auth, rateLimitMiddleware.api(), validateRequest(createPromotionSchema), asyncHandler(async (req, res) => {
    if (!req.user?._id) {
        throw new ValidationError('Authentication required');
    }
    try {
        const promotion = await promotionService.createPromotion({
            ...req.body,
            userId: req.user._id,
            itemId: new ObjectId(req.body.itemId),
        });
        res.status(201).json({ promotion });
    }
    catch (error) {
        logger.error('Failed to create promotion:', error);
        throw new DatabaseError('Failed to create promotion');
    }
}));
// Update promotion
router.patch('/:id', auth, rateLimitMiddleware.api(), validateRequest(updatePromotionSchema), asyncHandler(async (req, res) => {
    if (!req.user?._id) {
        throw new ValidationError('Authentication required');
    }
    try {
        const promotion = await promotionService.updatePromotion(new ObjectId(req.params.id), req.user._id, req.body);
        if (!promotion) {
            throw new NotFoundError('Promotion not found');
        }
        res.json({ promotion });
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to update promotion:', error);
        throw new DatabaseError('Failed to update promotion');
    }
}));
// Delete promotion
router.delete('/:id', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user?._id) {
        throw new ValidationError('Authentication required');
    }
    try {
        const success = await promotionService.deletePromotion(new ObjectId(req.params.id), req.user._id);
        if (!success) {
            throw new NotFoundError('Promotion not found');
        }
        res.json({ message: 'Promotion deleted successfully' });
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to delete promotion:', error);
        throw new DatabaseError('Failed to delete promotion');
    }
}));
export default router;
//# sourceMappingURL=promotions.js.map