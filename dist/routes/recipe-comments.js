;
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { DatabaseError, ValidationError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { DatabaseService } from '../db/database.service.js';
const router = Router();
const dbService = DatabaseService.getInstance();
// Validation schemas
const commentSchema = z.object({
    content: z.string().min(1, 'Comment content is required').max(1000, 'Comment is too long'),
    rating: z.number().min(1).max(5).optional(),
    images: z.array(z.string().url()).optional(),
    parentId: z.string().optional(),
});
// Get recipe comments
router.get('/:recipeId/comments', rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    try {
        const comments = await dbService.getCollection('recipe_comments')
            .find({
            recipeId: new ObjectId(req.params.recipeId),
            isDeleted: { $ne: true }
        })
            .sort({ createdAt: -1 })
            .toArray();
        // Get user info for each comment
        const userIds = [...new Set(comments.map(c => c.userId))];
        const users = await dbService.getCollection('users')
            .find({ _id: { $in: userIds } })
            .project({ _id: 1, name: 1, avatar: 1 })
            .toArray();
        const userMap = new Map(users.map(u => [u._id.toString(), u]));
        const commentsWithUser = comments.map(comment => ({
            ...comment,
            user: userMap.get(comment.userId.toString())
        }));
        res.json(commentsWithUser);
    }
    catch (error) {
        logger.error('Failed to get recipe comments:', error);
        throw new DatabaseError('Failed to get recipe comments');
    }
}));
// Add comment
router.post('/:recipeId/comments', auth, rateLimitMiddleware.api(), validateRequest(commentSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        // Check if recipe exists
        const recipe = await dbService.getCollection('recipes').findOne({
            _id: new ObjectId(req.params.recipeId)
        });
        if (!recipe) {
            throw new NotFoundError('Recipe not found');
        }
        const comment = {
            recipeId: new ObjectId(req.params.recipeId),
            userId: new ObjectId(req.user.id),
            content: req.body.content,
            rating: req.body.rating,
            images: req.body.images || [],
            parentId: req.body.parentId ? new ObjectId(req.body.parentId) : undefined,
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await dbService.getCollection('recipe_comments').insertOne(comment);
        // If rating provided, update recipe rating
        if (req.body.rating) {
            await updateRecipeRating(new ObjectId(req.params.recipeId));
        }
        // Get user info for response
        const user = await dbService.getCollection('users')
            .findOne({ _id: new ObjectId(req.user.id) }, { projection: { _id: 1, name: 1, avatar: 1 } });
        res.status(201).json({
            ...comment,
            _id: result.insertedId,
            user
        });
    }
    catch (error) {
        logger.error('Failed to add comment:', error);
        throw new DatabaseError('Failed to add comment');
    }
}));
// Update comment
router.patch('/:recipeId/comments/:commentId', auth, rateLimitMiddleware.api(), validateRequest(commentSchema.partial()), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const comment = await dbService.getCollection('recipe_comments').findOne({
            _id: new ObjectId(req.params.commentId),
            recipeId: new ObjectId(req.params.recipeId),
            isDeleted: { $ne: true }
        });
        if (!comment) {
            throw new NotFoundError('Comment not found');
        }
        if (comment.userId.toString() !== req.user.id) {
            throw new ForbiddenError('Not authorized to update this comment');
        }
        const updates = {
            ...req.body,
            parentId: req.body.parentId ? new ObjectId(req.body.parentId) : undefined,
            updatedAt: new Date()
        };
        const result = await dbService.getCollection('recipe_comments').findOneAndUpdate({ _id: new ObjectId(req.params.commentId) }, { $set: updates }, { returnDocument: 'after' });
        if (!result.value) {
            throw new NotFoundError('Comment not found');
        }
        // If rating was updated, update recipe rating
        if (req.body.rating) {
            await updateRecipeRating(new ObjectId(req.params.recipeId));
        }
        // Get user info for response
        const user = await dbService.getCollection('users')
            .findOne({ _id: new ObjectId(req.user.id) }, { projection: { _id: 1, name: 1, avatar: 1 } });
        res.json({
            ...result.value,
            user
        });
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ForbiddenError) {
            throw error;
        }
        logger.error('Failed to update comment:', error);
        throw new DatabaseError('Failed to update comment');
    }
}));
// Delete comment
router.delete('/:recipeId/comments/:commentId', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const comment = await dbService.getCollection('recipe_comments').findOne({
            _id: new ObjectId(req.params.commentId),
            recipeId: new ObjectId(req.params.recipeId),
            isDeleted: { $ne: true }
        });
        if (!comment) {
            throw new NotFoundError('Comment not found');
        }
        if (comment.userId.toString() !== req.user.id) {
            throw new ForbiddenError('Not authorized to delete this comment');
        }
        // Soft delete the comment
        await dbService.getCollection('recipe_comments').updateOne({ _id: new ObjectId(req.params.commentId) }, {
            $set: {
                isDeleted: true,
                updatedAt: new Date(),
                deletedAt: new Date(),
                deletedBy: new ObjectId(req.user.id)
            }
        });
        // If comment had rating, update recipe rating
        if (comment.rating) {
            await updateRecipeRating(new ObjectId(req.params.recipeId));
        }
        res.status(204).send();
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ForbiddenError) {
            throw error;
        }
        logger.error('Failed to delete comment:', error);
        throw new DatabaseError('Failed to delete comment');
    }
}));
// Helper function to update recipe rating
async function updateRecipeRating(recipeId) {
    const comments = await dbService.getCollection('recipe_comments')
        .find({
        recipeId,
        rating: { $exists: true },
        isDeleted: { $ne: true }
    })
        .toArray();
    if (comments.length === 0) {
        await dbService.getCollection('recipes').updateOne({ _id: recipeId }, {
            $set: {
                'ratings.average': 0,
                'ratings.count': 0,
                updatedAt: new Date()
            }
        });
        return;
    }
    const ratings = comments.map(c => c.rating).filter(r => r !== undefined);
    const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    await dbService.getCollection('recipes').updateOne({ _id: recipeId }, {
        $set: {
            'ratings.average': averageRating,
            'ratings.count': ratings.length,
            updatedAt: new Date()
        }
    });
}
export default router;
//# sourceMappingURL=recipe-comments.js.map