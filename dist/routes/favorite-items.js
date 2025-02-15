import express, { Response } from 'express';
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { DatabaseService } from '../db/database.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { DatabaseError, ValidationError, NotFoundError } from '../utils/errors.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import logger from '../utils/logger.js';
import { z } from 'zod';
const router = express.Router();
const dbService = DatabaseService.getInstance();
// Validation schemas
const favoriteItemSchema = z.object({
    ingredientId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ingredient ID'),
    customName: z.string().optional(),
    defaultQuantity: z.number().positive().optional(),
    defaultUnit: z.string().optional(),
    notes: z.string().optional(),
}).strict();
// Get all favorite items for the user
router.get('/', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const userId = new ObjectId(req.user.id);
        const favorites = await dbService.getCollection('favorite_items')
            .aggregate([
            {
                $match: { userId },
            },
            {
                $lookup: {
                    from: 'ingredients',
                    localField: 'ingredientId',
                    foreignField: '_id',
                    as: 'ingredient',
                },
            },
            {
                $unwind: '$ingredient',
            },
            {
                $sort: { 'ingredient.name': 1 },
            },
        ])
            .toArray();
        res.json(favorites);
    }
    catch (error) {
        logger.error('Failed to get favorite items:', error);
        throw new DatabaseError('Failed to get favorite items');
    }
}));
// Add an ingredient to favorites
router.post('/', auth, rateLimitMiddleware.api(), validateRequest(favoriteItemSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const userId = new ObjectId(req.user.id);
        const { ingredientId, customName, defaultQuantity, defaultUnit, notes } = req.body;
        // Check if ingredient exists
        const ingredient = await dbService.getCollection('ingredients')
            .findOne({ _id: new ObjectId(ingredientId) });
        if (!ingredient) {
            throw new NotFoundError('Ingredient not found');
        }
        // Check if already in favorites
        const existing = await dbService.getCollection('favorite_items')
            .findOne({ userId, ingredientId: new ObjectId(ingredientId) });
        if (existing) {
            throw new ValidationError('Item already in favorites');
        }
        const favoriteItem = {
            userId,
            ingredientId: new ObjectId(ingredientId),
            customName,
            defaultQuantity,
            defaultUnit,
            notes,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await dbService.getCollection('favorite_items').insertOne(favoriteItem);
        favoriteItem._id = result.insertedId;
        // Return the favorite item with ingredient details
        const favoriteWithDetails = await dbService.getCollection('favorite_items')
            .aggregate([
            {
                $match: { _id: result.insertedId },
            },
            {
                $lookup: {
                    from: 'ingredients',
                    localField: 'ingredientId',
                    foreignField: '_id',
                    as: 'ingredient',
                },
            },
            {
                $unwind: '$ingredient',
            },
        ])
            .next();
        res.status(201).json(favoriteWithDetails);
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ValidationError) {
            throw error;
        }
        logger.error('Failed to add favorite item:', error);
        throw new DatabaseError('Failed to add favorite item');
    }
}));
// Update a favorite item
router.patch('/:id', auth, rateLimitMiddleware.api(), validateRequest(favoriteItemSchema.partial()), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const userId = new ObjectId(req.user.id);
        const itemId = new ObjectId(req.params.id);
        const { customName, defaultQuantity, defaultUnit, notes } = req.body;
        const updateData = {
            updatedAt: new Date(),
        };
        if (customName !== undefined)
            updateData.customName = customName;
        if (defaultQuantity !== undefined)
            updateData.defaultQuantity = defaultQuantity;
        if (defaultUnit !== undefined)
            updateData.defaultUnit = defaultUnit;
        if (notes !== undefined)
            updateData.notes = notes;
        const result = await dbService.getCollection('favorite_items')
            .updateOne({ _id: itemId, userId }, { $set: updateData });
        if (result.matchedCount === 0) {
            throw new NotFoundError('Favorite item not found');
        }
        // Return updated item with ingredient details
        const updatedItem = await dbService.getCollection('favorite_items')
            .aggregate([
            {
                $match: { _id: itemId },
            },
            {
                $lookup: {
                    from: 'ingredients',
                    localField: 'ingredientId',
                    foreignField: '_id',
                    as: 'ingredient',
                },
            },
            {
                $unwind: '$ingredient',
            },
        ])
            .next();
        res.json(updatedItem);
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to update favorite item:', error);
        throw new DatabaseError('Failed to update favorite item');
    }
}));
// Remove an item from favorites
router.delete('/:id', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const userId = new ObjectId(req.user.id);
        const itemId = new ObjectId(req.params.id);
        const result = await dbService.getCollection('favorite_items').deleteOne({
            _id: itemId,
            userId,
        });
        if (result.deletedCount === 0) {
            throw new NotFoundError('Favorite item not found');
        }
        res.status(204).send();
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to delete favorite item:', error);
        throw new DatabaseError('Failed to delete favorite item');
    }
}));
// Add favorite items to a shopping list
router.post('/to-shopping-list', auth, rateLimitMiddleware.api(), validateRequest(z.object({
    favoriteIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid favorite item ID')),
    listId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid list ID').optional(),
})), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const userId = new ObjectId(req.user.id);
        const { favoriteIds, listId } = req.body;
        // Get favorite items
        const favorites = await dbService.getCollection('favorite_items')
            .find({
            _id: { $in: favoriteIds.map((id) => new ObjectId(id)) },
            userId,
        })
            .toArray();
        if (favorites.length === 0) {
            throw new NotFoundError('No favorite items found');
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
            updatedAt: new Date(),
        }));
        if (listId) {
            // Add to existing list
            const list = await dbService.getCollection('shopping_lists').findOne({
                _id: new ObjectId(listId),
                userId,
            });
            if (!list) {
                throw new NotFoundError('Shopping list not found');
            }
            await dbService.getCollection('shopping_lists').updateOne({ _id: new ObjectId(listId) }, { $push: { items: { $each: items } } });
            res.json({ success: true, listId });
        }
        else {
            // Create new list
            const list = {
                _id: new ObjectId(),
                userId,
                name: 'Favorites List',
                items,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            await dbService.getCollection('shopping_lists').insertOne(list);
            res.status(201).json({ success: true, listId: list._id });
        }
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to add favorites to shopping list:', error);
        throw new DatabaseError('Failed to add favorites to shopping list');
    }
}));
export default router;
//# sourceMappingURL=favorite-items.js.map