;
import { ObjectId } from 'mongodb';
;
import { auth } from '../../middleware/auth.js';
import { z } from 'zod';
import { rateLimitMiddleware } from '../../middleware/rate-limit.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { DatabaseError, ValidationError, NotFoundError, ForbiddenError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';
import { SocialService } from '../../services/social.service.js';
import { ShareService } from '../../services/share.service.js';
import { DatabaseService } from '../../db/database.service.js';
const router = Router();
const dbService = DatabaseService.getInstance();
const recipeService = RecipeService.getInstance();
const socialService = SocialService.getInstance(dbService);
const shareService = ShareService.getInstance();
// Validation schemas
const shareSchema = z.object({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
    message: z.string().max(500, 'Message is too long').optional(),
    visibility: z.enum(['public', 'private']).optional().default('private'),
});
const shareListSchema = z.object({
    userIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID')),
    message: z.string().max(500, 'Message is too long').optional(),
    visibility: z.enum(['public', 'private']).optional().default('private'),
});
// Share recipe with user
router.post('/:id/share', auth, rateLimitMiddleware.api(), validateRequest(shareSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const recipe = await recipeService.getRecipe(new ObjectId(req.params.id));
        if (!recipe) {
            throw new NotFoundError('Recipe not found');
        }
        // Check recipe visibility
        if (recipe.visibility === 'private' && (!recipe.author || recipe.author._id.toString() !== req.user.id)) {
            throw new ForbiddenError('Cannot share private recipes');
        }
        // Check if user is blocked
        const isBlocked = await socialService.isUserBlocked(new ObjectId(req.body.userId), new ObjectId(req.user.id));
        if (isBlocked) {
            throw new ForbiddenError('Cannot share recipe with this user');
        }
        const share = await shareService.shareRecipe({
            recipeId: new ObjectId(req.params.id),
            sharedBy: new ObjectId(req.user.id),
            sharedWith: new ObjectId(req.body.userId),
            message: req.body.message,
            visibility: req.body.visibility || 'private'
        });
        res.status(201).json(share);
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ForbiddenError) {
            throw error;
        }
        logger.error('Failed to share recipe:', error);
        throw new DatabaseError('Failed to share recipe');
    }
}));
// Share recipe with multiple users
router.post('/:id/share-multiple', auth, rateLimitMiddleware.api(), validateRequest(shareListSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const recipe = await recipeService.getRecipe(new ObjectId(req.params.id));
        if (!recipe) {
            throw new NotFoundError('Recipe not found');
        }
        // Check recipe visibility
        if (recipe.visibility === 'private' && (!recipe.author || recipe.author._id.toString() !== req.user.id)) {
            throw new ForbiddenError('Cannot share private recipes');
        }
        const userIds = req.body.userIds.map((id) => new ObjectId(id));
        // Check for blocked users
        const blockedUsers = await Promise.all(userIds.map((userId) => socialService.isUserBlocked(userId, new ObjectId(req.user.id))));
        const blockedIndices = blockedUsers
            .map((isBlocked, index) => isBlocked ? index : -1)
            .filter(index => index !== -1);
        if (blockedIndices.length > 0) {
            const blockedIds = blockedIndices.map(index => req.body.userIds[index]);
            throw new ValidationError(`Cannot share with blocked users: ${blockedIds.join(', ')}`);
        }
        const shares = await shareService.shareRecipeWithMultiple({
            recipeId: new ObjectId(req.params.id),
            sharedBy: new ObjectId(req.user.id),
            sharedWith: userIds,
            message: req.body.message,
            visibility: req.body.visibility || 'private'
        });
        res.status(201).json({ success: true, shares });
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ForbiddenError || error instanceof ValidationError) {
            throw error;
        }
        logger.error('Failed to share recipe with multiple users:', error);
        throw new DatabaseError('Failed to share recipe with multiple users');
    }
}));
// Get recipe shares
router.get('/:id/shares', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const recipe = await recipeService.getRecipe(new ObjectId(req.params.id));
        if (!recipe) {
            throw new NotFoundError('Recipe not found');
        }
        const isAuthor = Boolean(recipe.author && recipe.author._id.toString() === req.user.id);
        const shares = await shareService.getRecipeShares(new ObjectId(req.params.id), new ObjectId(req.user.id), isAuthor);
        res.json(shares);
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to get recipe shares:', error);
        throw new DatabaseError('Failed to get recipe shares');
    }
}));
// Accept share
router.post('/accept/:shareId', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        await shareService.acceptShare(new ObjectId(req.params.shareId), new ObjectId(req.user.id));
        res.json({ success: true });
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ForbiddenError) {
            throw error;
        }
        logger.error('Failed to accept share:', error);
        throw new DatabaseError('Failed to accept share');
    }
}));
// Reject share
router.post('/reject/:shareId', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        await shareService.rejectShare(new ObjectId(req.params.shareId), new ObjectId(req.user.id));
        res.json({ success: true });
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ForbiddenError) {
            throw error;
        }
        logger.error('Failed to reject share:', error);
        throw new DatabaseError('Failed to reject share');
    }
}));
export default router;
//# sourceMappingURL=sharing.routes.js.map