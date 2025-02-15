import express, { Request, Response } from 'express';
;
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ShoppingList, ShoppingListItem } from '../types/shopping-list.js';
import { IngredientWithPrices } from '../types/ingredient.js';
import { AuthError } from '../utils/errors.js';
const router = express.Router();
// Get user's shopping lists
router.get('/', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const userId = new ObjectId(req.user.id);
    const lists = await getCollection('shopping_lists')
        .find({ userId, isArchived: false })
        .sort({ createdAt: -1 })
        .toArray();
    res.json({ lists });
}));
// Create shopping list from recipes
router.post('/from-recipes', auth, [
    check('name').trim().notEmpty(),
    check('description').optional().trim(),
    check('recipeIds').isArray().notEmpty(),
    check('recipeIds.*').isMongoId(),
    check('servingsMultiplier').optional().isObject(),
    check('servingsMultiplier.*').optional().isFloat({ min: 0.1 }),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const userId = new ObjectId(req.user.id);
    const recipeIds = req.body.recipeIds.map((id) => new ObjectId(id));
    const servingsMultiplier = req.body.servingsMultiplier || {};
    // Get all recipes
    const recipes = await getCollection('recipes')
        .find({ _id: { $in: recipeIds } })
        .toArray();
    if (recipes.length !== recipeIds.length) {
        res.status(400).json({ message: 'One or more recipes not found' });
        return;
    }
    // Combine ingredients from all recipes
    const combinedIngredients = new Map();
    recipes.forEach(recipe => {
        const multiplier = recipe._id ? servingsMultiplier[recipe._id.toString()] || 1 : 1;
        recipe.ingredients.forEach((ingredient) => {
            const key = `${ingredient.name.toLowerCase()}_${ingredient.unit.toLowerCase()}`;
            const existing = combinedIngredients.get(key);
            if (existing) {
                existing.quantity += ingredient.amount * multiplier;
                if (ingredient.notes && !existing.notes?.includes(ingredient.notes)) {
                    existing.notes = existing.notes
                        ? `${existing.notes}, ${ingredient.notes}`
                        : ingredient.notes;
                }
            }
            else {
                const ingredientWithPrices = {
                    _id: new ObjectId(),
                    name: ingredient.name,
                    prices: [],
                    isVerified: false,
                    status: 'pending',
                    tags: [],
                    source: 'system',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                combinedIngredients.set(key, {
                    _id: new ObjectId(),
                    ingredient: ingredientWithPrices,
                    quantity: ingredient.amount * multiplier,
                    unit: ingredient.unit,
                    notes: ingredient.notes,
                    checked: false,
                    addedBy: userId,
                    addedAt: new Date(),
                });
            }
        });
    });
    // Create shopping list
    const shoppingList = {
        _id: new ObjectId(),
        name: req.body.name,
        description: req.body.description,
        owner: userId,
        collaborators: [
            {
                userId,
                role: 'editor',
                joinedAt: new Date(),
            },
        ],
        items: Array.from(combinedIngredients.values()),
        status: 'active',
        recipeIds,
        servingsMultiplier: Object.fromEntries(recipeIds.map((recipeId) => [
            recipeId.toString(),
            servingsMultiplier[recipeId.toString()] || 1,
        ])),
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    const result = await getCollection('shopping_lists').insertOne(shoppingList);
    res.status(201).json({
        success: true,
        shoppingListId: result.insertedId,
    });
}));
// Add items to shopping list
router.post('/:id/items', auth, [
    check('items').isArray().notEmpty(),
    check('items.*.name').trim().notEmpty(),
    check('items.*.amount').isFloat({ min: 0 }),
    check('items.*.unit').trim().notEmpty(),
    check('items.*.notes').optional().trim(),
    check('items.*.category').optional().trim(),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const userId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    const items = req.body.items.map((item) => ({
        _id: new ObjectId(),
        ingredient: {
            _id: new ObjectId(),
            name: item.name,
            prices: [],
            isVerified: false,
            status: 'pending',
            tags: [],
            source: 'system',
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        quantity: item.amount,
        unit: item.unit,
        notes: item.notes,
        checked: false,
        addedBy: userId,
        addedAt: new Date(),
        category: item.category,
    }));
    const result = await getCollection('shopping_lists').updateOne({ _id: listId, owner: userId }, {
        $push: {
            items: {
                $each: items,
            },
        },
        $set: { updatedAt: new Date() },
    });
    if (result.matchedCount === 0) {
        res.status(404).json({ message: 'Shopping list not found or unauthorized' });
        return;
    }
    res.json({ success: true });
}));
// Update item in shopping list
router.put('/:id/items/:itemIndex', auth, [
    check('name').optional().trim().notEmpty(),
    check('amount').optional().isFloat({ min: 0 }),
    check('unit').optional().trim().notEmpty(),
    check('notes').optional().trim(),
    check('isChecked').optional().isBoolean(),
    check('category').optional().trim(),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const userId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    const itemIndex = parseInt(req.params.itemIndex);
    const updateFields = {};
    for (const [key, value] of Object.entries(req.body)) {
        if (key === 'isChecked') {
            updateFields[`items.${itemIndex}.checked`] = value;
        }
        else {
            updateFields[`items.${itemIndex}.${key}`] = value;
        }
    }
    updateFields.updatedAt = new Date();
    const result = await getCollection('shopping_lists').updateOne({ _id: listId, owner: userId }, { $set: updateFields });
    if (result.matchedCount === 0) {
        res.status(404).json({ message: 'Shopping list not found or unauthorized' });
        return;
    }
    res.json({ success: true });
}));
// Remove item from shopping list
router.delete('/:id/items/:itemIndex', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const userId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    const itemIndex = parseInt(req.params.itemIndex);
    const result = await getCollection('shopping_lists').updateOne({ _id: listId, owner: userId }, {
        $unset: { [`items.${itemIndex}`]: 1 },
        $set: { updatedAt: new Date() },
    });
    if (result.matchedCount === 0) {
        res.status(404).json({ message: 'Shopping list not found or unauthorized' });
        return;
    }
    // Remove null items from array using aggregation pipeline
    await getCollection('shopping_lists').updateOne({ _id: listId }, [
        {
            $set: {
                items: {
                    $filter: {
                        input: '$items',
                        cond: { $ne: ['$$this', null] },
                    },
                },
            },
        },
    ]);
    res.json({ success: true });
}));
// Archive shopping list
router.post('/:id/archive', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const userId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    const result = await getCollection('shopping_lists').updateOne({ _id: listId, owner: userId }, {
        $set: {
            status: 'archived',
            updatedAt: new Date(),
        },
    });
    if (result.matchedCount === 0) {
        res.status(404).json({ message: 'Shopping list not found or unauthorized' });
        return;
    }
    res.json({ success: true });
}));
// Delete shopping list
router.delete('/:id', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const userId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    const result = await getCollection('shopping_lists').deleteOne({
        _id: listId,
        owner: userId,
    });
    if (result.deletedCount === 0) {
        res.status(404).json({ message: 'Shopping list not found or unauthorized' });
        return;
    }
    res.json({ success: true });
}));
// Export shopping list as text
router.get('/:id/export', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const userId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    const list = await getCollection('shopping_lists')
        .findOne({ _id: listId, owner: userId });
    if (!list) {
        res.status(404).json({ message: 'Shopping list not found or unauthorized' });
        return;
    }
    let text = `Shopping List: ${list.name}\n`;
    if (list.description) {
        text += `Description: ${list.description}\n`;
    }
    text += `\nCreated: ${list.createdAt.toLocaleDateString()}\n`;
    // Group items by category
    const itemsByCategory = new Map();
    list.items.forEach(item => {
        const category = item.category || 'Uncategorized';
        if (!itemsByCategory.has(category)) {
            itemsByCategory.set(category, []);
        }
        itemsByCategory.get(category).push(item);
    });
    // Sort categories and items
    const sortedCategories = Array.from(itemsByCategory.keys()).sort();
    sortedCategories.forEach(category => {
        const items = itemsByCategory
            .get(category)
            .sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name));
        text += `\n${category}:\n`;
        items.forEach(item => {
            text += `${item.checked ? '[x]' : '[ ]'} ${item.quantity} ${item.unit} ${item.ingredient.name}`;
            if (item.notes) {
                text += ` (${item.notes})`;
            }
            text += '\n';
        });
    });
    if (list.recipeIds && list.recipeIds.length > 0) {
        text += '\nBased on recipes:\n';
        const recipes = await getCollection('recipes')
            .find({ _id: { $in: list.recipeIds } })
            .toArray();
        recipes.forEach((recipe) => {
            const multiplier = list.servingsMultiplier?.[recipe._id.toString()] || 1;
            text += `- ${recipe.title} (${multiplier}x servings)\n`;
        });
    }
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${list.name.replace(/[^a-z0-9]/gi, '_')}.txt"`);
    res.send(text);
}));
export default router;
//# sourceMappingURL=shopping-lists.js.map