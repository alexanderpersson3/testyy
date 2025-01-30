import express from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getWebSocketService } from '../services/websocket.js';
const router = express.Router();
// Add a helper function to get list ID
function getListId(list) {
    return list._id || new ObjectId();
}
// Update the hasListAccess function
async function hasListAccess(db, listId, userId, requiredRole = 'viewer') {
    const list = await db.collection('shopping_lists').findOne({ _id: listId });
    if (!list)
        return false;
    // Owner has full access
    if (list.userId.toString() === userId.toString())
        return true;
    // Check collaborator access
    const collaborator = list.collaborators.find(c => c.userId.toString() === userId.toString());
    if (!collaborator)
        return false;
    // For editor role, any access level is fine
    if (requiredRole === 'editor') {
        return collaborator.role === 'editor';
    }
    // For viewer role, any access level is fine
    return true;
}
// Update the getShoppingList function
async function getShoppingList(db, listId) {
    return await db.collection('shopping_lists').findOne({ _id: listId });
}
// Get user's shopping lists
router.get('/', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const lists = await db.collection('shopping_lists')
        .find({ userId: new ObjectId(req.user.id) })
        .sort({ updatedAt: -1 })
        .toArray();
    res.json({ lists });
}));
// Create new shopping list
router.post('/', auth, [
    check('name').notEmpty().trim()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const newList = {
        userId: new ObjectId(req.user.id),
        name: req.body.name,
        items: [],
        collaborators: [],
        isShared: false,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await db.collection('shopping_lists').insertOne(newList);
    res.status(201).json({
        success: true,
        listId: result.insertedId
    });
}));
// Get shopping list by ID
router.get('/:id', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const list = await db.collection('shopping_lists').findOne({
        _id: new ObjectId(req.params.id),
        userId: new ObjectId(req.user.id)
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    const items = await db.collection('shopping_list_items')
        .find({ listId: list._id })
        .sort({ checked: 1, createdAt: -1 })
        .toArray();
    res.json({
        ...list,
        items
    });
}));
// Add item to shopping list
router.post('/:listId/items', auth, [
    check('ingredientId').notEmpty(),
    check('quantity').isFloat({ min: 0.01 }),
    check('unit').notEmpty().trim(),
    check('customName').optional().trim()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const listId = new ObjectId(req.params.listId);
    // Verify list ownership
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId: new ObjectId(req.user.id)
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    // Verify ingredient exists
    const ingredient = await db.collection('ingredients').findOne({
        _id: new ObjectId(req.body.ingredientId)
    });
    if (!ingredient) {
        return res.status(404).json({ message: 'Ingredient not found' });
    }
    const newItem = {
        listId,
        ingredientId: new ObjectId(req.body.ingredientId),
        quantity: parseFloat(req.body.quantity),
        unit: req.body.unit,
        customName: req.body.customName,
        checked: false,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    await db.collection('shopping_lists').updateOne({ _id: listId }, {
        $push: { items: newItem },
        $set: { updatedAt: new Date() }
    });
    res.status(201).json({
        success: true,
        item: newItem
    });
}));
// Update shopping list item
router.patch('/:listId/items/:itemId', auth, [
    check('quantity').optional().isFloat({ min: 0.01 }),
    check('unit').optional().trim(),
    check('customName').optional().trim(),
    check('checked').optional().isBoolean()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const listId = new ObjectId(req.params.listId);
    const itemId = new ObjectId(req.params.itemId);
    // Verify list ownership
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId: new ObjectId(req.user.id)
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    const updateData = {
        ...req.body,
        updatedAt: new Date()
    };
    const result = await db.collection('shopping_lists').updateOne({
        _id: listId,
        'items._id': itemId
    }, {
        $set: {
            'items.$': {
                ...list.items.find(item => item._id?.equals(itemId)),
                ...updateData
            }
        },
        updatedAt: new Date()
    });
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Item not found in shopping list' });
    }
    res.json({ success: true });
}));
// Remove item from shopping list
router.delete('/:listId/items/:itemId', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const listId = new ObjectId(req.params.listId);
    const itemId = new ObjectId(req.params.itemId);
    // Verify list ownership
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId: new ObjectId(req.user.id)
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    const result = await db.collection('shopping_lists').updateOne({ _id: listId }, {
        $pull: { items: { _id: itemId } },
        $set: { updatedAt: new Date() }
    });
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Item not found in shopping list' });
    }
    res.json({ success: true });
}));
// Delete shopping list
router.delete('/:listId', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const listId = new ObjectId(req.params.listId);
    const result = await db.collection('shopping_lists').deleteOne({
        _id: listId,
        userId: new ObjectId(req.user.id)
    });
    if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    res.json({ success: true });
}));
// Share shopping list with another user
router.post('/:id/share', auth, [
    check('email').isEmail(),
    check('role').isIn(['editor', 'viewer'])
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const listId = new ObjectId(req.params.id);
    // Verify list ownership
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId: new ObjectId(req.user.id)
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    // Find user by email
    const targetUser = await db.collection('users').findOne({ email: req.body.email });
    if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
    }
    // Check if already shared
    if (list.collaborators?.some(c => c.userId.equals(targetUser._id))) {
        return res.status(400).json({ message: 'List already shared with this user' });
    }
    const collaborator = {
        userId: targetUser._id,
        role: req.body.role,
        addedAt: new Date()
    };
    // Add collaborator
    await db.collection('shopping_lists').updateOne({ _id: listId }, {
        $push: {
            collaborators: {
                $each: [{
                        userId: collaborator.userId,
                        role: collaborator.role,
                        addedAt: collaborator.addedAt
                    }]
            }
        }
    });
    // Notify WebSocket clients
    getWebSocketService().notifyListUpdate(listId, 'share', {
        collaborator: {
            ...collaborator,
            email: targetUser.email,
            name: targetUser.name
        }
    });
    res.json({ success: true });
}));
// Remove collaborator from shopping list
router.delete('/:id/share/:userId', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const listId = new ObjectId(req.params.id);
    const collaboratorId = new ObjectId(req.params.userId);
    // Verify list ownership
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId: new ObjectId(req.user.id)
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    // Remove collaborator
    await db.collection('shopping_lists').updateOne({ _id: listId }, {
        $pull: {
            collaborators: {
                userId: { $eq: collaboratorId }
            }
        }
    });
    // Update isShared flag if no more collaborators
    const updatedList = await db.collection('shopping_lists').findOne({ _id: listId });
    if (updatedList && (!updatedList.collaborators || updatedList.collaborators.length === 0)) {
        await db.collection('shopping_lists').updateOne({ _id: listId }, { $set: { isShared: false } });
    }
    res.json({ success: true });
}));
// Update collaborator role
router.patch('/:id/share/:userId', auth, [check('role').isIn(['editor', 'viewer'])], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const listId = new ObjectId(req.params.id);
    const collaboratorId = new ObjectId(req.params.userId);
    // Verify list ownership
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId: new ObjectId(req.user.id)
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    // Update collaborator role
    await db.collection('shopping_lists').updateOne({
        _id: listId,
        'collaborators.userId': collaboratorId
    }, {
        $set: { 'collaborators.$.role': req.body.role }
    });
    res.json({ success: true });
}));
// Get list collaborators
router.get('/:id/collaborators', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const listId = new ObjectId(req.params.id);
    // Verify list access
    if (!await hasListAccess(db, listId, new ObjectId(req.user.id))) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    const list = await db.collection('shopping_lists').findOne({ _id: listId });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    // Get collaborator details
    const collaboratorIds = list.collaborators?.map(c => c.userId) || [];
    const collaboratorDetails = await db.collection('users')
        .find({ _id: { $in: collaboratorIds } })
        .project({ password: 0 })
        .toArray();
    const collaborators = list.collaborators?.map(c => ({
        ...collaboratorDetails.find(d => d._id.equals(c.userId)),
        role: c.role,
        addedAt: c.addedAt
    }));
    res.json({ collaborators });
}));
// Sort shopping list items
router.post('/:listId/sort', auth, [
    check('sortBy').isIn(['name', 'category', 'checked', 'createdAt']),
    check('order').isIn(['asc', 'desc'])
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const listId = new ObjectId(req.params.listId);
    const { sortBy, order } = req.body;
    // Verify list ownership
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId: new ObjectId(req.user.id)
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    // Sort items
    const sortedItems = [...list.items].sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        return order === 'asc' ?
            (aVal > bVal ? 1 : -1) :
            (aVal < bVal ? 1 : -1);
    });
    // Update list with sorted items
    await db.collection('shopping_lists').updateOne({ _id: listId }, {
        $set: {
            items: sortedItems,
            updatedAt: new Date()
        }
    });
    res.json({ success: true });
}));
// Bulk add items to shopping list
router.post('/:listId/items/bulk', auth, [
    check('items').isArray(),
    check('items.*.ingredientId').notEmpty(),
    check('items.*.quantity').isFloat({ min: 0.01 }),
    check('items.*.unit').notEmpty().trim()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const listId = new ObjectId(req.params.listId);
    // Verify list ownership
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId: new ObjectId(req.user.id)
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    // Create new items
    const newItems = req.body.items.map((item) => ({
        listId,
        ingredientId: new ObjectId(item.ingredientId),
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        customName: item.customName,
        checked: false,
        createdAt: new Date(),
        updatedAt: new Date()
    }));
    // Add items to list
    await db.collection('shopping_lists').updateOne({ _id: listId }, {
        $push: {
            items: { $each: newItems }
        },
        $set: { updatedAt: new Date() }
    });
    res.status(201).json({
        success: true,
        items: newItems
    });
}));
// Save list as template
router.post('/:listId/save-template', auth, [
    check('name').notEmpty().trim()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const listId = new ObjectId(req.params.listId);
    // Verify list ownership
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId: new ObjectId(req.user.id)
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    // Create template
    const template = {
        userId: new ObjectId(req.user.id),
        name: req.body.name,
        items: list.items.map(item => ({
            ingredientId: item.ingredientId,
            quantity: item.quantity,
            unit: item.unit,
            customName: item.customName
        })),
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await db.collection('shopping_list_templates').insertOne(template);
    res.status(201).json({
        success: true,
        templateId: result.insertedId
    });
}));
// Create list from template
router.post('/from-template/:templateId', auth, [
    check('name').notEmpty().trim()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const templateId = new ObjectId(req.params.templateId);
    // Get template
    const template = await db.collection('shopping_list_templates').findOne({
        _id: templateId,
        userId: new ObjectId(req.user.id)
    });
    if (!template) {
        return res.status(404).json({ message: 'Template not found' });
    }
    // Create new list from template
    const newList = {
        userId: new ObjectId(req.user.id),
        name: req.body.name,
        items: template.items.map((item) => ({
            ...item,
            listId: new ObjectId(), // Will be set after list creation
            checked: false,
            createdAt: new Date(),
            updatedAt: new Date()
        })),
        collaborators: [],
        isShared: false,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await db.collection('shopping_lists').insertOne(newList);
    // Update listId for all items
    newList.items.forEach(item => item.listId = result.insertedId);
    await db.collection('shopping_lists').updateOne({ _id: result.insertedId }, { $set: { items: newList.items } });
    res.status(201).json({
        success: true,
        listId: result.insertedId
    });
}));
// Get list statistics
router.get('/:listId/stats', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const listId = new ObjectId(req.params.listId);
    // Verify list ownership
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId: new ObjectId(req.user.id)
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    // Calculate statistics
    const stats = {
        totalItems: list.items.length,
        checkedItems: list.items.filter(item => item.checked).length,
        categories: {},
        estimatedTotal: 0
    };
    // Get all ingredients to calculate categories and prices
    const ingredientIds = list.items.map(item => item.ingredientId);
    const ingredients = await db.collection('ingredients')
        .find({ _id: { $in: ingredientIds } })
        .toArray();
    // Calculate category distribution and estimated total
    list.items.forEach(item => {
        const ingredient = ingredients.find(i => i._id.equals(item.ingredientId));
        if (ingredient) {
            // Update category count
            const category = ingredient.category;
            stats.categories[category] = (stats.categories[category] || 0) + 1;
            // Add to estimated total if price exists
            const latestPrice = ingredient.priceHistory?.[0]?.price;
            if (latestPrice) {
                stats.estimatedTotal += latestPrice * item.quantity;
            }
        }
    });
    res.json({ stats });
}));
// Update list store preferences
router.patch('/:listId/store-preferences', auth, [
    check('preferredStore').optional().trim(),
    check('preferredDay').optional().isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
    check('notifyPriceDrops').optional().isBoolean()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const listId = new ObjectId(req.params.listId);
    // Verify list ownership
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId: new ObjectId(req.user.id)
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    const preferences = {
        preferredStore: req.body.preferredStore,
        preferredDay: req.body.preferredDay,
        notifyPriceDrops: req.body.notifyPriceDrops
    };
    await db.collection('shopping_lists').updateOne({ _id: listId }, {
        $set: {
            storePreferences: preferences,
            updatedAt: new Date()
        }
    });
    res.json({ success: true });
}));
// Get price comparison for list items
router.get('/:listId/price-comparison', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const listId = new ObjectId(req.params.listId);
    // Verify list ownership
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId: new ObjectId(req.user.id)
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    // Get all ingredients
    const ingredientIds = list.items.map(item => item.ingredientId);
    const ingredients = await db.collection('ingredients')
        .find({ _id: { $in: ingredientIds } })
        .toArray();
    // Calculate prices per store
    const storePrices = {};
    list.items.forEach(item => {
        const ingredient = ingredients.find(i => i._id.equals(item.ingredientId));
        if (ingredient?.priceHistory) {
            // Group prices by store
            const storeGroups = ingredient.priceHistory.reduce((acc, price) => {
                if (!acc[price.store]) {
                    acc[price.store] = [];
                }
                acc[price.store].push(price);
                return acc;
            }, {});
            // Get latest price for each store
            Object.entries(storeGroups)
                .forEach(([store, prices]) => {
                const latestPrice = prices.sort((a, b) => b.date.getTime() - a.date.getTime())[0].price;
                if (!storePrices[store]) {
                    storePrices[store] = { total: 0, savings: 0, items: [] };
                }
                storePrices[store].items.push({
                    name: ingredient.name,
                    quantity: item.quantity,
                    price: latestPrice,
                    total: latestPrice * item.quantity
                });
                storePrices[store].total += latestPrice * item.quantity;
            });
        }
    });
    // Calculate potential savings
    const lowestTotal = Math.min(...Object.values(storePrices).map(store => store.total));
    Object.values(storePrices).forEach(store => {
        store.savings = store.total - lowestTotal;
    });
    res.json({
        storePrices,
        recommendation: Object.entries(storePrices)
            .sort(([, a], [, b]) => a.total - b.total)[0]
    });
}));
// Copy items from a completed list to a new list
router.post('/:listId/copy', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const sourceListId = new ObjectId(req.params.listId);
    const { name, items } = req.body;
    // Verify source list exists and user has access
    const sourceList = await getShoppingList(db, sourceListId);
    if (!sourceList || !hasListAccess(db, sourceListId, new ObjectId(req.user.id))) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    // Create new list with copied items
    const newList = {
        _id: new ObjectId(),
        userId: new ObjectId(req.user.id),
        name: name || `Copy of ${sourceList.name}`,
        items: items ? sourceList.items.filter(item => items.includes(item._id?.toString()))
            : sourceList.items.map(item => ({
                ...item,
                _id: new ObjectId(),
                checked: false,
                createdAt: new Date(),
                updatedAt: new Date()
            })),
        collaborators: [],
        isShared: false,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await db.collection('shopping_lists').insertOne(newList);
    newList._id = result.insertedId;
    res.json(newList);
}));
// Bulk update items (check/uncheck)
router.patch('/:listId/items/bulk', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const listId = new ObjectId(req.params.listId);
    const { itemIds, checked } = req.body;
    if (!Array.isArray(itemIds) || typeof checked !== 'boolean') {
        return res.status(400).json({ message: 'Invalid request body' });
    }
    // Verify list exists and user has access
    const list = await getShoppingList(db, listId);
    if (!list || !hasListAccess(db, listId, new ObjectId(req.user.id))) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    // Update items
    const objectIds = itemIds.map(id => new ObjectId(id));
    await db.collection('shopping_lists').updateOne({ _id: listId }, {
        $set: {
            'items.$[elem].checked': checked,
            'items.$[elem].updatedAt': new Date()
        }
    }, {
        arrayFilters: [{ 'elem._id': { $in: objectIds } }]
    });
    const updatedList = await getShoppingList(db, listId);
    res.json(updatedList);
}));
// Merge shopping lists
router.post('/merge', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const { listIds, name } = req.body;
    if (!Array.isArray(listIds) || listIds.length < 2) {
        return res.status(400).json({ message: 'At least two list IDs are required' });
    }
    // Verify all lists exist and user has access
    const lists = await Promise.all(listIds.map(id => getShoppingList(db, new ObjectId(id))));
    if (lists.some(list => !list || !hasListAccess(db, list._id, new ObjectId(req.user.id)))) {
        return res.status(404).json({ message: 'One or more shopping lists not found' });
    }
    // Merge items from all lists
    const mergedItems = lists.flatMap(list => list.items).map(item => ({
        ...item,
        _id: new ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date()
    }));
    // Create new merged list
    const mergedList = {
        _id: new ObjectId(),
        userId: new ObjectId(req.user.id),
        name: name || `Merged List ${new Date().toLocaleDateString()}`,
        items: mergedItems,
        collaborators: [],
        isShared: false,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await db.collection('shopping_lists').insertOne(mergedList);
    mergedList._id = result.insertedId;
    // Optionally delete original lists
    if (req.body.deleteOriginals) {
        await db.collection('shopping_lists').deleteMany({
            _id: { $in: listIds.map(id => new ObjectId(id)) }
        });
    }
    res.json(mergedList);
}));
// Move checked items to a new list
router.post('/:listId/split', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const sourceListId = new ObjectId(req.params.listId);
    const { name } = req.body;
    // Verify source list exists and user has access
    const sourceList = await getShoppingList(db, sourceListId);
    if (!sourceList || !hasListAccess(db, sourceListId, new ObjectId(req.user.id))) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    // Split items
    const checkedItems = sourceList.items.filter(item => item.checked);
    const uncheckedItems = sourceList.items.filter(item => !item.checked);
    if (checkedItems.length === 0) {
        return res.status(400).json({ message: 'No checked items to split' });
    }
    // Create new list with checked items
    const newList = {
        userId: new ObjectId(req.user.id),
        name: name || `${sourceList.name} (Checked Items)`,
        items: checkedItems.map(item => ({
            ...item,
            _id: new ObjectId(),
            checked: false,
            createdAt: new Date(),
            updatedAt: new Date()
        })),
        collaborators: [],
        isShared: false,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    // Update original list to only contain unchecked items
    await db.collection('shopping_lists').updateOne({ _id: sourceListId }, {
        $set: {
            items: uncheckedItems,
            updatedAt: new Date()
        }
    });
    const result = await db.collection('shopping_lists').insertOne(newList);
    newList._id = result.insertedId;
    res.json({
        originalList: await getShoppingList(db, sourceListId),
        newList
    });
}));
export default router;
//# sourceMappingURL=shopping-list.js.map