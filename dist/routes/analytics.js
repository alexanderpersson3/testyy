;
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { DatabaseService } from '../db/database.service.js';
import { ObjectId } from 'mongodb';
;
import { DatabaseError, ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const router = Router();
const db = DatabaseService.getInstance();
// Validation schemas
const eventSchema = z.object({
    type: z.enum(['view', 'like', 'share', 'save', 'cook', 'search']),
    itemId: z.string(),
    itemType: z.enum(['recipe', 'ingredient', 'collection']),
    metadata: z.record(z.any()).optional(),
});
// Track event
router.post('/events', auth, rateLimitMiddleware.api(), validateRequest(eventSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const { type, itemId, itemType, metadata } = req.body;
        const event = {
            userId: new ObjectId(req.user.id),
            type,
            itemId: new ObjectId(itemId),
            itemType,
            metadata,
            createdAt: new Date(),
        };
        await db.getCollection('analytics_events').insertOne(event);
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Failed to track event:', error);
        throw new DatabaseError('Failed to track event');
    }
}));
// Get user analytics
router.get('/', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const userId = new ObjectId(req.user.id);
        // Get user's recipe count
        const recipeCount = await db.getCollection('recipes').countDocuments({ authorId: userId });
        // Get user's favorite recipes count
        const favoriteCount = await db.getCollection('favorites').countDocuments({ userId });
        // Get user's total recipe views
        const viewsResult = await db
            .getCollection('recipe_views')
            .aggregate([
            { $match: { authorId: userId } },
            { $group: { _id: null, total: { $sum: '$views' } } },
        ])
            .next();
        const totalViews = viewsResult?.total || 0;
        // Get user's total recipe likes
        const likesResult = await db
            .getCollection('recipe_likes')
            .aggregate([{ $match: { authorId: userId } }, { $group: { _id: null, total: { $sum: 1 } } }])
            .next();
        const totalLikes = likesResult?.total || 0;
        res.json({
            success: true,
            data: {
                recipes: recipeCount,
                favorites: favoriteCount,
                views: totalViews,
                likes: totalLikes,
            },
        });
    }
    catch (error) {
        logger.error('Failed to get user analytics:', error);
        throw new DatabaseError('Failed to get user analytics');
    }
}));
export default router;
//# sourceMappingURL=analytics.js.map