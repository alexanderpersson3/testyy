import express, { Response } from 'express';
;
import { GroceryListService } from '../services/grocery-list.service.js';
import { requireAuth } from '../middleware/require-auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
const router = express.Router();
const groceryListService = new GroceryListService();
// Create new grocery list
router.post('/', requireAuth, [
    check('name').notEmpty().withMessage('List name is required'),
    check('collectionId').optional().isString(),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { name, collectionId } = req.body;
    const listId = await groceryListService.createList(req.user.id, name, collectionId);
    res.status(201).json({
        success: true,
        listId,
    });
}));
// Get user's grocery lists
router.get('/', requireAuth, rateLimitMiddleware.api, asyncHandler(async (req, res) => {
    const lists = await groceryListService.getUserLists(req.user.id);
    res.json(lists);
}));
// Get grocery list by ID
router.get('/:id', requireAuth, rateLimitMiddleware.api, asyncHandler(async (req, res) => {
    const list = await groceryListService.getList(req.params.id, req.user.id);
    if (!list) {
        return res.status(404).json({ error: 'Grocery list not found' });
    }
    res.json(list);
}));
// Add items to grocery list
router.post('/:id/items', requireAuth, [
    check('items').isArray().withMessage('Items must be an array'),
    check('items.*.name').notEmpty().withMessage('Item name is required'),
    check('items.*.amount').isNumeric().withMessage('Amount must be a number'),
    check('items.*.unit').notEmpty().withMessage('Unit is required'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    await groceryListService.addItems(req.params.id, req.body.items, req.user.id);
    res.json({ success: true });
}));
// Add recipe ingredients to grocery list
router.post('/:id/recipes/:recipeId', requireAuth, asyncHandler(async (req, res) => {
    await groceryListService.addRecipeIngredients(req.params.id, req.params.recipeId, req.user.id);
    res.json({ success: true });
}));
// Add collection ingredients to grocery list
router.post('/:id/collections/:collectionId', requireAuth, asyncHandler(async (req, res) => {
    await groceryListService.addCollectionIngredients(req.params.id, req.params.collectionId, req.user.id);
    res.json({ success: true });
}));
// Update item status
router.patch('/:id/items/:itemId', requireAuth, [check('checked').isBoolean().withMessage('Checked status must be a boolean')], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    await groceryListService.updateItemStatus(req.params.id, req.params.itemId, req.body.checked);
    res.json({ success: true });
}));
// Remove item from list
router.delete('/:id/items/:itemId', requireAuth, asyncHandler(async (req, res) => {
    await groceryListService.removeItem(req.params.id, req.params.itemId);
    res.status(204).send();
}));
// Clear completed items
router.delete('/:id/completed', requireAuth, asyncHandler(async (req, res) => {
    await groceryListService.clearCompleted(req.params.id);
    res.status(204).send();
}));
// Delete grocery list
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
    await groceryListService.deleteList(req.params.id, req.user.id);
    res.status(204).send();
}));
export default router;
//# sourceMappingURL=grocery-lists.js.map