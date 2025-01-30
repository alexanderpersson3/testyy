import express from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const router = express.Router();
// Get recipe comments
router.get('/:recipeId/comments', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const recipeId = new ObjectId(req.params.recipeId);
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;
    const [comments, total] = await Promise.all([
        db.collection('recipe_comments')
            .aggregate([
            {
                $match: { recipeId }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $project: {
                    'user.password': 0,
                    'user.email': 0
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            { $skip: skip },
            { $limit: limit }
        ])
            .toArray(),
        db.collection('recipe_comments').countDocuments({ recipeId })
    ]);
    res.json({
        comments,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    });
}));
// Add comment
router.post('/:recipeId/comments', auth, [
    check('text').trim().notEmpty(),
    check('parentId').optional().isMongoId()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const recipeId = new ObjectId(req.params.recipeId);
    // Verify recipe exists
    const recipe = await db.collection('recipes').findOne({ _id: recipeId });
    if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
    }
    // If parent comment specified, verify it exists
    if (req.body.parentId) {
        const parentComment = await db.collection('recipe_comments').findOne({
            _id: new ObjectId(req.body.parentId),
            recipeId
        });
        if (!parentComment) {
            return res.status(404).json({ message: 'Parent comment not found' });
        }
    }
    const comment = {
        recipeId,
        userId,
        parentId: req.body.parentId ? new ObjectId(req.body.parentId) : undefined,
        text: req.body.text,
        likes: 0,
        isEdited: false,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await db.collection('recipe_comments').insertOne(comment);
    // Add to activity feed
    await db.collection('user_activity').insertOne({
        userId,
        type: 'recipe_comment',
        recipeId,
        commentId: result.insertedId,
        createdAt: new Date()
    });
    res.status(201).json({
        success: true,
        commentId: result.insertedId
    });
}));
// Update comment
router.put('/comments/:id', auth, [
    check('text').trim().notEmpty()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const commentId = new ObjectId(req.params.id);
    const result = await db.collection('recipe_comments').updateOne({ _id: commentId, userId }, {
        $set: {
            text: req.body.text,
            isEdited: true,
            updatedAt: new Date()
        }
    });
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Comment not found or unauthorized' });
    }
    res.json({ success: true });
}));
// Delete comment
router.delete('/comments/:id', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const commentId = new ObjectId(req.params.id);
    const result = await db.collection('recipe_comments').deleteOne({
        _id: commentId,
        userId
    });
    if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Comment not found or unauthorized' });
    }
    // Also delete any replies
    await db.collection('recipe_comments').deleteMany({
        parentId: commentId
    });
    res.json({ success: true });
}));
// Rate recipe
router.post('/:recipeId/rate', auth, [
    check('rating').isInt({ min: 1, max: 5 }),
    check('review').optional().trim()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const recipeId = new ObjectId(req.params.recipeId);
    // Verify recipe exists
    const recipe = await db.collection('recipes').findOne({ _id: recipeId });
    if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
    }
    // Check if user has already rated
    const existingRating = await db.collection('recipe_ratings').findOne({
        userId,
        recipeId
    });
    if (existingRating) {
        // Update existing rating
        await db.collection('recipe_ratings').updateOne({ _id: existingRating._id }, {
            $set: {
                rating: req.body.rating,
                review: req.body.review,
                updatedAt: new Date()
            }
        });
    }
    else {
        // Add new rating
        const rating = {
            recipeId,
            userId,
            rating: req.body.rating,
            review: req.body.review,
            status: 'active',
            helpfulVotes: 0,
            unhelpfulVotes: 0,
            votedUserIds: [],
            flags: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await db.collection('recipe_ratings').insertOne(rating);
        // Add to activity feed
        await db.collection('user_activity').insertOne({
            userId,
            type: 'recipe_rate',
            recipeId,
            rating: req.body.rating,
            createdAt: new Date()
        });
    }
    // Update recipe rating
    const ratings = await db.collection('recipe_ratings')
        .find({ recipeId })
        .toArray();
    const averageRating = ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length;
    await db.collection('recipes').updateOne({ _id: recipeId }, {
        $set: {
            rating: {
                average: Math.round(averageRating * 10) / 10,
                count: ratings.length
            }
        }
    });
    res.json({ success: true });
}));
// Get recipe ratings
router.get('/:recipeId/ratings', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const recipeId = new ObjectId(req.params.recipeId);
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;
    const [ratings, total] = await Promise.all([
        db.collection('recipe_ratings')
            .aggregate([
            {
                $match: { recipeId }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $project: {
                    'user.password': 0,
                    'user.email': 0
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            { $skip: skip },
            { $limit: limit }
        ])
            .toArray(),
        db.collection('recipe_ratings').countDocuments({ recipeId })
    ]);
    res.json({
        ratings,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    });
}));
export default router;
//# sourceMappingURL=recipe-comments.js.map