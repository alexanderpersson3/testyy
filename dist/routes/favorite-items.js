import express from 'express';
import { ObjectId } from 'mongodb';
import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const router = express.Router();
// Get all favorite items for the user
router.get('/', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const favorites = await db.collection('favorite_items')
        .aggregate([
        {
            $match: { userId }
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
        },
        {
            $sort: { 'ingredient.name': 1 }
        }
    ])
        .toArray();
    res.json(favorites);
}));
// Add an ingredient to favorites
router.post('/', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const { ingredientId, customName, defaultQuantity, defaultUnit, notes } = req.body;
    if (!ingredientId) {
        return res.status(400).json({ message: 'Ingredient ID is required' });
    }
    // Check if ingredient exists
    const ingredient = await db.collection('ingredients')
        .findOne({ _id: new ObjectId(ingredientId) });
    if (!ingredient) {
        return res.status(404).json({ message: 'Ingredient not found' });
    }
    // Check if already in favorites
    const existing = await db.collection('favorite_items')
        .findOne({ userId, ingredientId: new ObjectId(ingredientId) });
    if (existing) {
        return res.status(400).json({ message: 'Item already in favorites' });
    }
    const favoriteItem = {
        userId,
        ingredientId: new ObjectId(ingredientId),
        customName,
        defaultQuantity,
        defaultUnit,
        notes,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await db.collection('favorite_items').insertOne(favoriteItem);
    favoriteItem._id = result.insertedId;
    // Return the favorite item with ingredient details
    const favoriteWithDetails = await db.collection('favorite_items')
        .aggregate([
        {
            $match: { _id: result.insertedId }
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
        .next();
    res.status(201).json(favoriteWithDetails);
}));
// Update a favorite item
router.patch('/:id', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const itemId = new ObjectId(req.params.id);
    const { customName, defaultQuantity, defaultUnit, notes } = req.body;
    const updateData = {
        updatedAt: new Date()
    };
    if (customName !== undefined)
        updateData.customName = customName;
    if (defaultQuantity !== undefined)
        updateData.defaultQuantity = defaultQuantity;
    if (defaultUnit !== undefined)
        updateData.defaultUnit = defaultUnit;
    if (notes !== undefined)
        updateData.notes = notes;
    const result = await db.collection('favorite_items').updateOne({ _id: itemId, userId }, { $set: updateData });
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Favorite item not found' });
    }
    // Return updated item with ingredient details
    const updatedItem = await db.collection('favorite_items')
        .aggregate([
        {
            $match: { _id: itemId }
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
        .next();
    res.json(updatedItem);
}));
// Remove an item from favorites
router.delete('/:id', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const itemId = new ObjectId(req.params.id);
    const result = await db.collection('favorite_items').deleteOne({
        _id: itemId,
        userId
    });
    if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Favorite item not found' });
    }
    res.status(204).send();
}));
// Add favorite items to a shopping list
router.post('/to-shopping-list', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const { favoriteIds, listId } = req.body;
    if (!Array.isArray(favoriteIds) || favoriteIds.length === 0) {
        return res.status(400).json({ message: 'At least one favorite item ID is required' });
    }
    // Get favorite items
    const favorites = await db.collection('favorite_items')
        .find({
        _id: { $in: favoriteIds.map(id => new ObjectId(id)) },
        userId
    })
        .toArray();
    if (favorites.length === 0) {
        return res.status(404).json({ message: 'No favorite items found' });
    }
    // Create shopping list items from favorites
    const items = favorites.map(favorite => ({
        _id: new ObjectId(),
        ingredientId: favorite.ingredientId,
        quantity: favorite.defaultQuantity || 1,
        unit: favorite.defaultUnit || '',
        customName: favorite.customName,
        checked: false,
        createdAt: new Date(),
        updatedAt: new Date()
    }));
    if (listId) {
        // Add to existing list
        const list = await db.collection('shopping_lists').findOne({
            _id: new ObjectId(listId),
            userId
        });
        if (!list) {
            return res.status(404).json({ message: 'Shopping list not found' });
        }
        await db.collection('shopping_lists').updateOne({ _id: new ObjectId(listId) }, {
            $push: { 'items': { $each: items } },
            $set: { updatedAt: new Date() }
        });
        const updatedList = await db.collection('shopping_lists')
            .findOne({ _id: new ObjectId(listId) });
        res.json(updatedList);
    }
    else {
        // Create new list
        const newList = {
            _id: new ObjectId(),
            userId,
            name: 'Favorite Items List',
            items,
            collaborators: [],
            isShared: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await db.collection('shopping_lists').insertOne(newList);
        res.status(201).json(newList);
    }
}));
export default router;
//# sourceMappingURL=favorite-items.js.map