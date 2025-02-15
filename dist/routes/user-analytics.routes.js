;
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { AnalyticsService } from '../services/analytics.service.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { DatabaseError, ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { z } from 'zod';
const router = Router();
const analyticsService = AnalyticsService.getInstance();
// Validation schemas
const timelineSchema = z.object({
    startDate: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid start date').optional(),
    endDate: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid end date').optional(),
});
const metricsSchema = z.object({
    period: z.enum(['day', 'week', 'month'], {
        errorMap: () => ({ message: 'Invalid period. Must be one of: day, week, month' })
    })
});
const analyticsPreferencesSchema = z.object({
    dataCollection: z.object({
        cookingStats: z.boolean().optional(),
        collectionInsights: z.boolean().optional(),
        usageMetrics: z.boolean().optional(),
        personalizedTips: z.boolean().optional(),
    }).optional(),
    notifications: z.object({
        weeklyReport: z.boolean().optional(),
        monthlyInsights: z.boolean().optional(),
        achievementAlerts: z.boolean().optional(),
        trendAlerts: z.boolean().optional(),
    }).optional(),
    privacySettings: z.object({
        shareStats: z.boolean().optional(),
        showInLeaderboards: z.boolean().optional(),
        allowComparison: z.boolean().optional(),
        anonymizeData: z.boolean().optional(),
    }).optional(),
    reportSettings: z.object({
        format: z.enum(['simple', 'detailed']).optional(),
        frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
    }).optional(),
});
// Get cooking stats
router.get('/cooking-stats', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const stats = await analyticsService.getCookingStats(ensureObjectId(req.user.id));
        res.json(stats);
    }
    catch (error) {
        logger.error('Failed to get cooking stats:', error);
        throw new DatabaseError('Failed to get cooking stats');
    }
}));
// Get activity timeline
router.get('/activity', auth, rateLimitMiddleware.api(), validateRequest(timelineSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const { startDate, endDate } = req.query;
        const timeline = await analyticsService.getActivityTimeline(ensureObjectId(req.user.id), {
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        });
        res.json(timeline);
    }
    catch (error) {
        logger.error('Failed to get activity timeline:', error);
        throw new DatabaseError('Failed to get activity timeline');
    }
}));
// Get usage metrics
router.get('/metrics', auth, rateLimitMiddleware.api(), validateRequest(metricsSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const metrics = await analyticsService.getUsageMetrics(ensureObjectId(req.user.id), { period: req.query.period });
        res.json(metrics);
    }
    catch (error) {
        logger.error('Failed to get usage metrics:', error);
        throw new DatabaseError('Failed to get usage metrics');
    }
}));
// Get analytics preferences
router.get('/preferences', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const preferences = await analyticsService.getAnalyticsPreferences(ensureObjectId(req.user.id));
        res.json(preferences);
    }
    catch (error) {
        logger.error('Failed to get analytics preferences:', error);
        throw new DatabaseError('Failed to get analytics preferences');
    }
}));
// Update analytics preferences
router.put('/preferences', auth, rateLimitMiddleware.api(), validateRequest(analyticsPreferencesSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const preferences = await analyticsService.updateAnalyticsPreferences(ensureObjectId(req.user.id), req.body);
        res.json(preferences);
    }
    catch (error) {
        logger.error('Failed to update analytics preferences:', error);
        throw new DatabaseError('Failed to update analytics preferences');
    }
}));
// Get personalized insights
router.get('/insights', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const insights = await analyticsService.getPersonalizedInsights(ensureObjectId(req.user.id));
        res.json(insights);
    }
    catch (error) {
        logger.error('Failed to get personalized insights:', error);
        throw new DatabaseError('Failed to get personalized insights');
    }
}));
// Get personalized tips
router.get('/tips', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const tips = await analyticsService.getPersonalizedTips(ensureObjectId(req.user.id));
        res.json(tips);
    }
    catch (error) {
        logger.error('Failed to get personalized tips:', error);
        throw new DatabaseError('Failed to get personalized tips');
    }
}));
// Get achievement progress
router.get('/achievements', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const achievements = await analyticsService.getAchievementProgress(ensureObjectId(req.user.id));
        res.json(achievements);
    }
    catch (error) {
        logger.error('Failed to get achievement progress:', error);
        throw new DatabaseError('Failed to get achievement progress');
    }
}));
export default router;
//# sourceMappingURL=user-analytics.routes.js.map