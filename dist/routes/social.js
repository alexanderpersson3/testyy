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
import { SocialService } from '../services/social.service.js';
const router = Router();
const dbService = DatabaseService.getInstance();
const socialService = SocialService.getInstance(dbService);
// Validation schemas
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');
const paginationSchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
});
const updateProfileSchema = z.object({
    displayName: z.string().min(1).max(50).optional(),
    bio: z.string().max(500).optional(),
    location: z.string().max(100).optional(),
    website: z.string().url().optional(),
    socialLinks: z
        .object({
        instagram: z.string().optional(),
        twitter: z.string().optional(),
        facebook: z.string().optional(),
        youtube: z.string().optional(),
    })
        .optional(),
    specialties: z.array(z.string()).optional(),
    dietaryPreferences: z.array(z.string()).optional(),
    privacySettings: z
        .object({
        profileVisibility: z.enum(['public', 'private', 'followers']).optional(),
        activityVisibility: z.enum(['public', 'private', 'followers']).optional(),
        allowTagging: z.boolean().optional(),
        showCookingSessions: z.boolean().optional(),
        showCollections: z.boolean().optional(),
    })
        .optional(),
});
// Get user profile
router.get('/profile/:userId', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    try {
        const profile = await socialService.getProfile(new ObjectId(req.params.userId));
        if (!profile) {
            throw new NotFoundError('Profile not found');
        }
        res.json(profile);
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to get profile:', error);
        throw new DatabaseError('Failed to get profile');
    }
}));
// Update profile
router.patch('/profile', auth, rateLimitMiddleware.api(), validateRequest(updateProfileSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        await socialService.updateProfile(new ObjectId(req.user.id), req.body);
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Failed to update profile:', error);
        throw new DatabaseError('Failed to update profile');
    }
}));
// Follow user
router.post('/follow/:userId', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        await socialService.followUser(new ObjectId(req.user.id), new ObjectId(req.params.userId));
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Failed to follow user:', error);
        throw new DatabaseError('Failed to follow user');
    }
}));
// Unfollow user
router.delete('/follow/:userId', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        await socialService.unfollowUser(new ObjectId(req.user.id), new ObjectId(req.params.userId));
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Failed to unfollow user:', error);
        throw new DatabaseError('Failed to unfollow user');
    }
}));
// Get followers
router.get('/followers/:userId', auth, rateLimitMiddleware.api(), validateRequest(paginationSchema, 'query'), asyncHandler(async (req, res) => {
    try {
        const followers = await socialService.getUserFollowers(new ObjectId(req.params.userId));
        res.json(followers);
    }
    catch (error) {
        logger.error('Failed to get followers:', error);
        throw new DatabaseError('Failed to get followers');
    }
}));
// Get following
router.get('/following/:userId', auth, rateLimitMiddleware.api(), validateRequest(paginationSchema, 'query'), asyncHandler(async (req, res) => {
    try {
        const following = await socialService.getUserFollowing(new ObjectId(req.params.userId));
        res.json(following);
    }
    catch (error) {
        logger.error('Failed to get following:', error);
        throw new DatabaseError('Failed to get following');
    }
}));
// Get follow suggestions
router.get('/suggestions', auth, rateLimitMiddleware.api(), validateRequest(paginationSchema, 'query'), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const suggestions = await socialService.getFollowSuggestions(req.user.id);
        res.json(suggestions);
    }
    catch (error) {
        logger.error('Failed to get follow suggestions:', error);
        throw new DatabaseError('Failed to get follow suggestions');
    }
}));
export default router;
//# sourceMappingURL=social.js.map