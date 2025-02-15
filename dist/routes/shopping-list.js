import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
;
import { Db } from 'mongodb';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
;
import { requireAuth } from '../middleware/require-auth.js';
import { connectToDatabase } from '../db/database.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getWebSocketService } from '../services/websocket.js';
import { ShoppingList, ShoppingListItem, CreateShoppingListDTO, UpdateShoppingListDTO,
// AddShoppingListItemDTO, // Not used
// UpdateShoppingListItemDTO, // Not used
// AddCollaboratorDTO, // Not used
// ShoppingListTemplate, // Not used
// PriceComparisonOptions, // Not used
// BulkUpdateItemsDTO // Not used
 } from '../types/shopping-list.js';
import { ShoppingListService } from '../services/shopping-list.service.js';
import { cacheMiddleware } from '../middleware/cache.js';
import { auth } from '../middleware/auth.js';
import { handleError } from '../utils/errors.js';
import { ItemCategory, ITEM_CATEGORIES } from '../types/shopping-list.js';
import { validate } from '../middleware/validate.js';
const router = Router();
const shoppingListService = ShoppingListService.getInstance();
const wsService = getWebSocketService();
// Configure multer for voice input uploads
const upload = multer({
    dest: path.join(process.cwd(), 'uploads/temp'),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/webm'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only WAV, MP3, and WebM audio files are allowed'), false);
        }
    },
});
// Add a helper function to get list ID 
function getListId(list) {
    return list._id.toString();
}
// Update the hasListAccess function
async function hasListAccess(db, listId, userId, requiredRole = 'viewer') {
    const list = await db.collection('shopping_lists').findOne({ _id: listId });
    if (!list)
        return false;
    // Check owner access
    if (list.userId.toString() === userId.toString())
        return true;
    // Check collaborator access
    if (!list.collaborators)
        return false;
    const collaborator = list.collaborators.find(c => c.userId.toString() === userId.toString());
    if (!collaborator)
        return false;
    // Check role
    return requiredRole === 'viewer' || collaborator.role === 'editor';
}
// Update the getShoppingList function
async function getShoppingList(db, listId) {
    try {
        return await connectToDatabase().then(db => db.collection('shopping_lists').findOne({ _id: listId }));
    }
    catch (error) {
        console.error(error);
        return null;
    }
}
// Validation schemas
const createListSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
    description: z.string().max(500, 'Description is too long').optional(),
    storeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid store ID').optional(),
    items: z.array(z.object({
        ingredientId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ingredient ID'),
        quantity: z.number().positive('Quantity must be positive'),
        unit: z.string().min(1, 'Unit is required'),
        notes: z.string().max(200, 'Notes are too long').optional()
    })).optional(),
    meals: z.array(z.object({
        recipeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid recipe ID'),
        servings: z.number().positive('Servings must be positive')
    })).optional(),
    mealPlanId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid meal plan ID').optional()
}).strict();
const updateListSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name is too long').optional(),
    description: z.string().max(500, 'Description is too long').optional(),
    storeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid store ID').optional(),
    status: z.enum(['active', 'archived', 'completed']).optional(),
}).strict();
const addItemSchema = z.object({
    ingredientId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ingredient ID'),
    quantity: z.number().positive('Quantity must be positive'),
    unit: z.string().min(1, 'Unit is required'),
    notes: z.string().max(200, 'Notes are too long').optional()
}).strict();
const updateItemSchema = z.object({
    quantity: z.number().positive('Quantity must be positive').optional(),
    unit: z.string().min(1, 'Unit is required').optional(),
    checked: z.boolean().optional(),
    notes: z.string().max(200, 'Notes are too long').optional()
}).strict();
const addCollaboratorSchema = z.object({
    userId: z.string(),
    role: z.enum(['editor', 'viewer']),
}).strict();
// Price comparison validation schemas
const priceComparisonOptionsSchema = z.object({
    maxDistance: z.number().positive().optional(),
    includeOutOfStock: z.boolean().optional(),
    onlyOpenStores: z.boolean().optional(),
    preferredStores: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
    currency: z.string().optional(),
}).strict();
const priceAlertPreferencesSchema = z.object({
    enabled: z.boolean(),
    minPriceDrop: z.number().min(0).max(100),
    minDiscount: z.number().min(0).max(100),
    notifyBackInStock: z.boolean(),
    notifyNewDeals: z.boolean(),
    maxAlertsPerDay: z.number().int().positive(),
    preferredStores: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
    excludedStores: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
    notificationChannels: z.array(z.enum(['email', 'push', 'in_app'])),
}).strict();
const updateItemsSchema = z.object({
    updates: z.array(z.object({
        name: z.string(),
        amount: z.number().positive().optional(),
        isChecked: z.boolean().optional(),
        notes: z.string().optional(),
    })),
}).strict();
const addItemsSchema = z.object({
    items: z.array(z.object({
        name: z.string().min(1),
        quantity: z.number().positive(),
        unit: z.string(),
        category: z.enum(Object.keys(ITEM_CATEGORIES)).optional(),
        notes: z.string().max(500).optional(),
    })),
});
const addItemsFromRecipeSchema = z.object({
    recipeId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    servings: z.number().positive().optional(),
    excludeItems: z.array(z.string()).optional(),
});
const shareListSchema = z.object({
    collaboratorId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    role: z.enum(['editor', 'viewer']),
});
// Get user's shopping lists
router.get('/', requireAuth, asyncHandler(async (req, res) => {
    try {
        const lists = await shoppingListService.getLists(req.user.id);
        return res.json({ lists });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to get shopping lists' });
    }
}));
// Create new shopping list
router.post('/', requireAuth, validateRequest(createListSchema), asyncHandler(async (req, res) => {
    try {
        const list = await shoppingListService.createList(new ObjectId(req.user.id), req.body.name);
        return res.status(201).json({
            success: true,
            listId: list._id
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to create shopping list' });
    }
}));
// Get shopping list by ID
router.get('/:id', auth, cacheMiddleware({ ttl: 60 }), // Cache for 1 minute
asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const list = await shoppingListService.getList(new ObjectId(id), new ObjectId(req.user.id));
        if (!list) {
            return res.status(404).json({
                success: false,
                message: 'Shopping list not found'
            });
        }
        return res.json({
            success: true,
            list
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to get shopping list' });
    }
}));
// Add item to shopping list
router.post('/:id/items', requireAuth, validateRequest(addItemSchema), asyncHandler(async (req, res) => {
    try {
        const itemId = await shoppingListService.addItem(req.params.id, req.user.id, req.body);
        return res.json({ success: true, itemId });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to add item to shopping list' });
    }
}));
// Update shopping list item
router.patch('/:id/items/:itemId', requireAuth, validateRequest(updateItemSchema), asyncHandler(async (req, res) => {
    try {
        await shoppingListService.updateItem(new ObjectId(req.params.id), new ObjectId(req.user.id), new ObjectId(req.params.itemId), req.body);
        return res.json({ success: true });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to update shopping list item' });
    }
}));
// Remove item from shopping list
router.delete('/:id/items/:itemId', requireAuth, asyncHandler(async (req, res) => {
    try {
        await shoppingListService.removeItem(new ObjectId(req.params.id), new ObjectId(req.user.id), new ObjectId(req.params.itemId));
        return res.json({ success: true });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to remove item from shopping list' });
    }
}));
// More routes will be added in the next update...
router.post('/', auth, validate(createListSchema), async (req, res) => {
    try {
        const listId = await shoppingListService.createList(req.user.id, req.body);
        res.status(201).json({ listId });
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.get('/', auth, async (req, res) => {
    try {
        const lists = await shoppingListService.getLists(req.user.id);
        res.json(lists);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.get('/:listId', auth, async (req, res) => {
    try {
        const list = await shoppingListService.getList(req.user.id, req.params.listId);
        if (!list) {
            return res.status(404).json({ error: 'Shopping list not found' });
        }
        res.json(list);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.post('/:listId/items', auth, validate(addItemsSchema), async (req, res) => {
    try {
        const list = await shoppingListService.addItems(req.user.id, req.params.listId, req.body.items);
        res.status(201).json(list);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.post('/:listId/items/recipe', auth, validate(addItemsFromRecipeSchema), async (req, res) => {
    try {
        const list = await shoppingListService.addItemsFromRecipe(req.user.id, req.params.listId, req.body);
        res.status(201).json(list);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.patch('/:listId/items/:itemId', auth, validate(updateItemSchema), async (req, res) => {
    try {
        const list = await shoppingListService.updateItem(req.user.id, req.params.listId, req.params.itemId, req.body);
        res.json(list);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.delete('/:listId/items/:itemId', auth, async (req, res) => {
    try {
        await shoppingListService.deleteItem(req.user.id, req.params.listId, req.params.itemId);
        res.status(204).send();
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.post('/:listId/voice', auth, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }
        const result = await shoppingListService.processVoiceInput(req.user.id, req.params.listId, req.file.buffer);
        res.json(result);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.post('/:listId/share', auth, validate(shareListSchema), async (req, res) => {
    try {
        await shoppingListService.shareList(req.user.id, req.params.listId, req.body.collaboratorId, req.body.role);
        res.status(204).send();
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
export default router;
//# sourceMappingURL=shopping-list.js.map