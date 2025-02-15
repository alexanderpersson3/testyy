/**
 * Achievement routes for handling user achievements, badges, ranks, and tracking.
 * Provides endpoints for managing the gamification aspects of the application,
 * including leaderboards, user badges, and achievement tracking.
 *
 * Known TypeScript Issue:
 * Express's type system has limitations with async route handlers returning Response objects.
 * This is a known issue (see: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/50871).
 * We're using @ts-expect-error comments as a workaround until this is fixed in Express's types.
 *
 * @module routes/social/achievements
 * @see .github/ISSUES/TS-001-express-async-handlers.md for detailed explanation
 */
;
import { z } from 'zod';
import { auth } from '../../middleware/auth.js';
import { rateLimitMiddleware } from '../../middleware/rate-limit.js';
import { AchievementManager } from '../../services/social/achievement-manager.js';
import { Achievement } from '../../types/social.js';
import { DatabaseError, ValidationError } from '../../utils/errors.js';
import { ObjectId } from 'mongodb';
;
import logger from '../../utils/logger.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
const router = Router();
const achievementManager = AchievementManager.getInstance();
/**
 * Validation schema for leaderboard query parameters
 */
const leaderboardSchema = z.object({
    limit: z.string()
        .transform((val) => parseInt(val, 10))
        .refine((val) => !isNaN(val) && val > 0 && val <= 100, 'Limit must be between 1 and 100')
        .optional(),
}).strict();
/**
 * Validation schema for user ID route parameters
 */
const userIdSchema = z.object({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format'),
});
/**
 * Validation schema for track achievement request body
 */
const trackAchievementSchema = z.object({
    achievementId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid achievement ID format'),
    progress: z.number().min(0, 'Progress must be non-negative'),
});
/**
 * Get the global leaderboard
 */
router.get('/leaderboard', auth, rateLimitMiddleware.api(), validateRequest(leaderboardSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
        const leaderboard = await achievementManager.getLeaderboard(limit);
        res.json(leaderboard);
    }
    catch (error) {
        logger.error('Failed to get leaderboard:', error);
        throw new DatabaseError('Failed to get leaderboard');
    }
}));
/**
 * Get user achievements
 */
router.get('/achievements/:userId', auth, rateLimitMiddleware.api(), validateRequest(userIdSchema, 'params'), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const achievements = await achievementManager.getUserAchievements(req.params.userId);
        res.json(achievements);
    }
    catch (error) {
        logger.error('Failed to get user achievements:', error);
        throw new DatabaseError('Failed to get user achievements');
    }
}));
/**
 * Get user rank
 */
router.get('/rank/:userId', auth, rateLimitMiddleware.api(), validateRequest(userIdSchema, 'params'), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const rank = await achievementManager.getUserRank(req.params.userId);
        res.json(rank);
    }
    catch (error) {
        logger.error('Failed to get user rank:', error);
        throw new DatabaseError('Failed to get user rank');
    }
}));
/**
 * Track achievement progress
 */
router.post('/track', auth, rateLimitMiddleware.api(), validateRequest(trackAchievementSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        await achievementManager.updateAchievementProgress(req.user.id, req.body.achievementId, req.body.progress);
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Failed to track achievement:', error);
        throw new DatabaseError('Failed to track achievement');
    }
}));
export default router;
//# sourceMappingURL=achievements.js.map