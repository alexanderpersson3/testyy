;
import { ObjectId } from 'mongodb';
;
import { auth } from '../../middleware/auth.js';
import { validate as validateRequest } from '../../middleware/validate.js';
import { z } from 'zod';
import { rateLimitMiddleware } from '../../middleware/rate-limit.js';
import { asyncHandler, asyncAuthHandler } from '../../utils/asyncHandler.js';
import { InternalServerError as DatabaseError, NotFoundError, ValidationError, AuthorizationError as ForbiddenError } from '../../types/errors.js';
import logger from '../../utils/logger.js';
import { DatabaseService } from '../../db/database.service.js';
import { RecipeService } from '../../services/recipe.service.js';
const router = Router();
const dbService = DatabaseService.getInstance();
const recipeService = RecipeService.getInstance();
// Validation schemas
const ratingSchema = z.object({
    rating: z.number().min(1).max(5),
    comment: z.string().optional(),
});
const commentSchema = z.object({
    content: z.string().min(1, 'Comment content is required').max(1000, 'Comment is too long'),
});
const reportSchema = z.object({
    reason: z.enum(['inappropriate', 'copyright', 'spam', 'other']),
    description: z.string().optional(),
});
// Rate recipe
router.post('/:id/rate', auth, rateLimitMiddleware.api(), validateRequest(ratingSchema), asyncAuthHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const userId = new ObjectId(req.user.id);
        const recipeId = new ObjectId(req.params.id);
        const recipe = await recipeService.getRecipe(recipeId);
        if (!recipe) {
            throw new NotFoundError('Recipe not found');
        }
        // Check if user owns recipe
        if (recipe.author && recipe.author._id.toString() === req.user.id) {
            throw new ValidationError('Cannot rate your own recipe');
        }
        const db = dbService.getDb();
        const existingRating = await db.collection('recipe_ratings').findOne({
            recipeId,
            userId,
        });
        if (existingRating) {
            // Update existing rating
            await db.collection('recipe_ratings').updateOne({ _id: existingRating._id }, {
                $set: {
                    rating: req.body.rating,
                    comment: req.body.comment,
                    updatedAt: new Date(),
                },
            });
        }
        else {
            // Create new rating
            await db.collection('recipe_ratings').insertOne({
                recipeId,
                userId,
                rating: req.body.rating,
                comment: req.body.comment,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }
        // Update recipe average rating
        await recipeService.updateRating(recipeId, req.body.rating);
        res.json({ success: true });
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ValidationError) {
            throw error;
        }
        logger.error('Failed to rate recipe:', error);
        throw new DatabaseError('Failed to rate recipe');
    }
}));
// Get recipe ratings
router.get('/:id/ratings', rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    try {
        const recipeId = new ObjectId(req.params.id);
        const db = dbService.getDb();
        const ratings = await db
            .collection('recipe_ratings')
            .aggregate([
            { $match: { recipeId } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            { $unwind: '$user' },
            {
                $project: {
                    rating: 1,
                    comment: 1,
                    createdAt: 1,
                    user: {
                        _id: 1,
                        name: 1,
                    },
                },
            },
            { $sort: { createdAt: -1 } },
        ])
            .toArray();
        res.json(ratings);
    }
    catch (error) {
        logger.error('Failed to get recipe ratings:', error);
        throw new DatabaseError('Failed to get recipe ratings');
    }
}));
// Add comment
router.post('/:id/comments', auth, rateLimitMiddleware.api(), validateRequest(commentSchema), asyncAuthHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const recipeId = new ObjectId(req.params.id);
        const userId = new ObjectId(req.user.id);
        const recipe = await recipeService.getRecipe(recipeId);
        if (!recipe) {
            throw new NotFoundError('Recipe not found');
        }
        const db = dbService.getDb();
        const comment = {
            recipeId,
            userId,
            content: req.body.content,
            isEdited: false,
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection('recipe_comments').insertOne(comment);
        res.status(201).json({ ...comment, _id: result.insertedId });
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to add comment:', error);
        throw new DatabaseError('Failed to add comment');
    }
}));
// Get comments
router.get('/:id/comments', rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    try {
        const recipeId = new ObjectId(req.params.id);
        const db = dbService.getDb();
        const comments = await db
            .collection('recipe_comments')
            .aggregate([
            {
                $match: {
                    recipeId,
                    isDeleted: { $ne: true }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            { $unwind: '$user' },
            {
                $project: {
                    content: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    isEdited: 1,
                    user: {
                        _id: 1,
                        name: 1,
                    },
                },
            },
            { $sort: { createdAt: -1 } },
        ])
            .toArray();
        res.json(comments);
    }
    catch (error) {
        logger.error('Failed to get recipe comments:', error);
        throw new DatabaseError('Failed to get recipe comments');
    }
}));
// Update comment
router.patch('/:id/comments/:commentId', auth, rateLimitMiddleware.api(), validateRequest(commentSchema), asyncAuthHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const db = dbService.getDb();
        const comment = await db.collection('recipe_comments').findOne({
            _id: new ObjectId(req.params.commentId),
            recipeId: new ObjectId(req.params.id),
        });
        if (!comment) {
            throw new NotFoundError('Comment not found');
        }
        if (comment.userId.toString() !== req.user.id) {
            throw new ForbiddenError('Not authorized to update this comment');
        }
        const result = await db.collection('recipe_comments').findOneAndUpdate({
            _id: new ObjectId(req.params.commentId),
            recipeId: new ObjectId(req.params.id),
            userId: new ObjectId(req.user.id),
        }, {
            $set: {
                content: req.body.content,
                isEdited: true,
                updatedAt: new Date(),
            },
        }, { returnDocument: 'after' });
        if (!result.value) {
            throw new NotFoundError('Comment not found or unauthorized');
        }
        res.json(result.value);
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
router.delete('/:id/comments/:commentId', auth, rateLimitMiddleware.api(), asyncAuthHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const db = dbService.getDb();
        const comment = await db.collection('recipe_comments').findOne({
            _id: new ObjectId(req.params.commentId),
            recipeId: new ObjectId(req.params.id),
        });
        if (!comment) {
            throw new NotFoundError('Comment not found');
        }
        if (comment.userId.toString() !== req.user.id) {
            throw new ForbiddenError('Not authorized to delete this comment');
        }
        // Soft delete
        const result = await db.collection('recipe_comments').updateOne({
            _id: new ObjectId(req.params.commentId),
            recipeId: new ObjectId(req.params.id),
            userId: new ObjectId(req.user.id),
        }, {
            $set: {
                isDeleted: true,
                updatedAt: new Date(),
            },
        });
        if (result.modifiedCount === 0) {
            throw new NotFoundError('Comment not found or unauthorized');
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
// Report recipe
router.post('/:id/report', auth, rateLimitMiddleware.api(), validateRequest(reportSchema), asyncAuthHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const recipeId = new ObjectId(req.params.id);
        const userId = new ObjectId(req.user.id);
        const recipe = await recipeService.getRecipe(recipeId);
        if (!recipe) {
            throw new NotFoundError('Recipe not found');
        }
        // Check if user has already reported this recipe
        const db = dbService.getDb();
        const existingReport = await db.collection('recipe_reports').findOne({
            recipeId,
            userId,
            status: { $ne: 'resolved' },
        });
        if (existingReport) {
            throw new ValidationError('You have already reported this recipe');
        }
        const reportData = {
            reason: req.body.reason,
            ...(req.body.description && { description: req.body.description }),
        };
        await recipeService.reportRecipe(recipeId, userId, reportData);
        res.json({ success: true });
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ValidationError) {
            throw error;
        }
        logger.error('Failed to report recipe:', error);
        throw new DatabaseError('Failed to report recipe');
    }
}));
export default router;
//# sourceMappingURL=interactions.routes.js.map