;
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { DatabaseError, ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { DatabaseService } from '../db/database.service.js';
const router = Router();
const db = DatabaseService.getInstance();
// Get user settings
router.get('/', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const settings = await db.getCollection('user_settings').findOne({
            userId: new ObjectId(req.user.id)
        });
        res.json(settings || {});
    }
    catch (error) {
        logger.error('Failed to get settings:', error);
        throw new DatabaseError('Failed to get settings');
    }
}));
// Update user settings
router.put('/', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const result = await db.getCollection('user_settings').updateOne({ userId: new ObjectId(req.user.id) }, {
            $set: { ...req.body, updatedAt: new Date() },
            $setOnInsert: { createdAt: new Date() }
        }, { upsert: true });
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Failed to update settings:', error);
        throw new DatabaseError('Failed to update settings');
    }
}));
export default router;
//# sourceMappingURL=settings.js.map