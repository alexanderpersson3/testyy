import express from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { FavoritesService } from '../services/favorites.js';
const router = express.Router();
// Get user's favorite items
router.get('/', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const favorites = await db.collection('favorite_items')
        .aggregate([
        {
            $match: {
                userId: new ObjectId(req.user.id)
            }
        },
        {
            $lookup: {
                from: 'ingredients',
                localField: 'ingredientId',
                foreignField: '_id',
                as: 'ingredient'
            }
        },
        {
            $unwind: '$ingredient'
        }
    ])
        .sort({ createdAt: -1 })
        .toArray();
    res.json({ favorites });
}));
// Add item to favorites
router.post('/', auth, [
    check('itemId').isMongoId(),
    check('itemType').isIn(['recipe', 'ingredient'])
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const favoritesService = new FavoritesService(db.collection('favorites'), db.collection('recipes'));
    await favoritesService.addFavorite(new ObjectId(req.user.id), new ObjectId(req.body.itemId), req.body.itemType);
    res.json({ success: true });
}));
// Update favorite item
router.patch('/:id', auth, [
    check('customName').optional().trim(),
    check('defaultQuantity').optional().isFloat({ min: 0 }),
    check('defaultUnit').optional().trim(),
    check('notes').optional().trim()
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
    if (updateData.defaultQuantity) {
        updateData.defaultQuantity = parseFloat(updateData.defaultQuantity);
    }
    const result = await db.collection('favorite_items').updateOne({
        _id: favoriteId,
        userId: new ObjectId(req.user.id)
    }, { $set: updateData });
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Favorite item not found' });
    }
    res.json({ success: true });
}));
// Remove item from favorites
router.delete('/:itemId', auth, [
    check('itemType').isIn(['recipe', 'ingredient'])
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const favoritesService = new FavoritesService(db.collection('favorites'), db.collection('recipes'));
    await favoritesService.removeFavorite(new ObjectId(req.user.id), new ObjectId(req.params.itemId), req.query.itemType);
    res.json({ success: true });
}));
// Add favorite item to shopping list
router.post('/:id/add-to-list/:listId', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const favoriteId = new ObjectId(req.params.id);
    const listId = new ObjectId(req.params.listId);
    // Get favorite item
    const favorite = await db.collection('favorite_items').findOne({
        _id: favoriteId,
        userId: new ObjectId(req.user.id)
    });
    if (!favorite) {
        return res.status(404).json({ message: 'Favorite item not found' });
    }
    // Verify shopping list ownership
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId: new ObjectId(req.user.id)
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    // Add to shopping list
    const shoppingItem = {
        listId,
        ingredientId: favorite.ingredientId,
        quantity: favorite.defaultQuantity || 1,
        unit: favorite.defaultUnit || 'st',
        customName: favorite.customName,
        checked: false,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    await db.collection('shopping_lists').updateOne({ _id: listId }, {
        $push: { items: { $each: [shoppingItem] } },
        $set: { updatedAt: new Date() }
    });
    res.status(201).json({
        success: true,
        item: shoppingItem
    });
}));
// Get user's favorites
router.get('/', auth, [
    check('itemType').optional().isIn(['recipe', 'ingredient']),
    check('page').optional().isInt({ min: 1 }),
    check('limit').optional().isInt({ min: 1, max: 50 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const favoritesService = new FavoritesService(db.collection('favorites'), db.collection('recipes'));
    const itemType = req.query.itemType;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    if (itemType === 'recipe') {
        const { recipes, total } = await favoritesService.getFavoriteRecipes(new ObjectId(req.user.id), page, limit);
        res.json({ recipes, total, page, limit });
    }
    else {
        const favorites = await favoritesService.getFavorites(new ObjectId(req.user.id), itemType);
        res.json({ favorites });
    }
}));
// Check if item is favorited
router.get('/:itemId/check', auth, [
    check('itemType').isIn(['recipe', 'ingredient'])
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const favoritesService = new FavoritesService(db.collection('favorites'), db.collection('recipes'));
    const isFavorite = await favoritesService.isFavorite(new ObjectId(req.user.id), new ObjectId(req.params.itemId), req.query.itemType);
    res.json({ isFavorite });
}));
// Get popular recipes
router.get('/popular/recipes', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const favoritesService = new FavoritesService(db.collection('favorites'), db.collection('recipes'));
    const limit = parseInt(req.query.limit) || 10;
    const recipes = await favoritesService.getPopularRecipes(limit);
    res.json({ recipes });
}));
export default router;
//# sourceMappingURL=favorites.js.map