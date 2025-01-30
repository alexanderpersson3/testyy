import express from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const router = express.Router();
// Get all favorite recipes
router.get('/', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    // Get favorite recipes with full recipe details
    const favorites = await db.collection('favorite_recipes')
        .aggregate([
        {
            $match: {
                userId: new ObjectId(req.user.id)
            }
        },
        {
            $lookup: {
                from: 'recipes',
                localField: 'recipeId',
                foreignField: '_id',
                as: 'recipe'
            }
        },
        {
            $unwind: '$recipe'
        },
        {
            $sort: {
                'recipe.title': 1
            }
        }
    ])
        .toArray();
    res.json({ favorites });
}));
// Add recipe to favorites
router.post('/:recipeId', auth, [
    check('note').optional().trim(),
    check('personalTags').optional().isArray(),
    check('rating').optional().isInt({ min: 1, max: 5 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const recipeId = new ObjectId(req.params.recipeId);
    // Verify recipe exists
    const recipe = await db.collection('recipes').findOne({ _id: recipeId });
    if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
    }
    // Check if already favorited
    const existing = await db.collection('favorite_recipes').findOne({
        userId: new ObjectId(req.user.id),
        recipeId
    });
    if (existing) {
        return res.status(400).json({ message: 'Recipe already in favorites' });
    }
    const favorite = {
        userId: new ObjectId(req.user.id),
        recipeId,
        note: req.body.note,
        timesCooked: 0,
        rating: req.body.rating,
        personalTags: req.body.personalTags?.map((tag) => tag.trim().toLowerCase()) || [],
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await db.collection('favorite_recipes').insertOne(favorite);
    res.status(201).json({
        success: true,
        favoriteId: result.insertedId
    });
}));
// Update favorite recipe
router.patch('/:id', auth, [
    check('note').optional().trim(),
    check('personalTags').optional().isArray(),
    check('rating').optional().isInt({ min: 1, max: 5 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const favoriteId = new ObjectId(req.params.id);
    const updateData = {
        ...req.body,
        updatedAt: new Date()
    };
    if (updateData.personalTags) {
        updateData.personalTags = updateData.personalTags.map((tag) => tag.trim().toLowerCase());
    }
    const result = await db.collection('favorite_recipes').updateOne({
        _id: favoriteId,
        userId: new ObjectId(req.user.id)
    }, { $set: updateData });
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Favorite recipe not found' });
    }
    res.json({ success: true });
}));
// Record recipe cooking
router.post('/:id/cooked', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const favoriteId = new ObjectId(req.params.id);
    const result = await db.collection('favorite_recipes').updateOne({
        _id: favoriteId,
        userId: new ObjectId(req.user.id)
    }, {
        $inc: { timesCooked: 1 },
        $set: {
            lastCooked: new Date(),
            updatedAt: new Date()
        }
    });
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Favorite recipe not found' });
    }
    res.json({ success: true });
}));
// Remove recipe from favorites
router.delete('/:id', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const favoriteId = new ObjectId(req.params.id);
    const result = await db.collection('favorite_recipes').deleteOne({
        _id: favoriteId,
        userId: new ObjectId(req.user.id)
    });
    if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Favorite recipe not found' });
    }
    res.json({ success: true });
}));
// Get favorite recipes by tag
router.get('/by-tag/:tag', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const tag = req.params.tag.toLowerCase();
    const favorites = await db.collection('favorite_recipes')
        .aggregate([
        {
            $match: {
                userId: new ObjectId(req.user.id),
                personalTags: tag
            }
        },
        {
            $lookup: {
                from: 'recipes',
                localField: 'recipeId',
                foreignField: '_id',
                as: 'recipe'
            }
        },
        {
            $unwind: '$recipe'
        },
        {
            $sort: {
                'recipe.title': 1
            }
        }
    ])
        .toArray();
    res.json({ favorites });
}));
// Get most cooked recipes
router.get('/most-cooked', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const favorites = await db.collection('favorite_recipes')
        .aggregate([
        {
            $match: {
                userId: new ObjectId(req.user.id),
                timesCooked: { $gt: 0 }
            }
        },
        {
            $lookup: {
                from: 'recipes',
                localField: 'recipeId',
                foreignField: '_id',
                as: 'recipe'
            }
        },
        {
            $unwind: '$recipe'
        },
        {
            $sort: {
                timesCooked: -1,
                lastCooked: -1
            }
        },
        {
            $limit: 10
        }
    ])
        .toArray();
    res.json({ favorites });
}));
export default router;
//# sourceMappingURL=favorite-recipes.js.map