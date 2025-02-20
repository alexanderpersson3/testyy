import express, { Request, Response } from 'express';
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ShoppingList, ShoppingListItem, UserSettings } from '../types/models.js';
const router = express.Router();
// Get user's dashboard data
router.get('/', auth, asyncHandler(async (req, res) => {
    const userId = new ObjectId(req.user.id);
    // Parse query parameters
    const listSort = req.query.listSort || 'updatedAt';
    const listOrder = req.query.listOrder || 'desc';
    const favoriteSort = req.query.favoriteSort || 'updatedAt';
    const favoriteOrder = req.query.favoriteOrder || 'desc';
    const categoryFilter = req.query.category;
    const searchQuery = req.query.q;
    // Get user settings
    const settings = (await getCollection('user_settings').findOne({ userId })) || {
        userId,
        sortCheckedItems: true,
        sortByCategory: false,
        enableReminders: false,
        defaultStore: undefined,
        sharedListsEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    // Build shopping list query
    const listQuery = {
        $or: [{ userId }, { 'collaborators.userId': userId }],
    };
    // Get shopping lists with sorting
    const lists = await getCollection('shopping_lists')
        .find(listQuery)
        .sort({ [listSort]: listOrder === 'asc' ? 1 : -1 })
        .toArray();
    // Build favorites pipeline
    const favoritePipeline = [
        {
            $match: { userId },
        },
    ];
    // Add category filter if specified
    if (categoryFilter) {
        favoritePipeline.push({
            $lookup: {
                from: 'ingredients',
                localField: 'ingredientId',
                foreignField: '_id',
                as: 'ingredient',
            },
        }, {
            $unwind: '$ingredient',
        }, {
            $match: {
                'ingredient.category': categoryFilter,
            },
        });
    }
    else {
        favoritePipeline.push({
            $lookup: {
                from: 'ingredients',
                localField: 'ingredientId',
                foreignField: '_id',
                as: 'ingredient',
            },
        }, {
            $unwind: '$ingredient',
        });
    }
    // Add search filter if specified
    if (searchQuery) {
        favoritePipeline.push({
            $match: {
                $or: [
                    { 'ingredient.name': { $regex: searchQuery, $options: 'i' } },
                    { 'ingredient.category': { $regex: searchQuery, $options: 'i' } },
                    { customName: { $regex: searchQuery, $options: 'i' } },
                ],
            },
        });
    }
    // Add sorting
    favoritePipeline.push({
        $sort: {
            [favoriteSort === 'name' ? 'ingredient.name' : favoriteSort]: favoriteOrder === 'asc' ? 1 : -1,
        },
    });
    // Get favorite items
    const favorites = await getCollection('favorite_items')
        .aggregate(favoritePipeline)
        .toArray();
    // Calculate recently used items with improved aggregation
    const recentItems = await getCollection('shopping_lists')
        .aggregate([
        { $match: { userId } },
        { $unwind: '$items' },
        {
            $group: {
                _id: '$items.ingredientId',
                lastUsed: { $max: '$items.updatedAt' },
                frequency: { $sum: 1 },
                lastQuantity: {
                    $first: {
                        $cond: [
                            { $eq: ['$items.updatedAt', { $max: '$items.updatedAt' }] },
                            '$items.quantity',
                            null,
                        ],
                    },
                },
                lastUnit: {
                    $first: {
                        $cond: [
                            { $eq: ['$items.updatedAt', { $max: '$items.updatedAt' }] },
                            '$items.unit',
                            null,
                        ],
                    },
                },
            },
        },
        { $sort: { lastUsed: -1 } },
        { $limit: 10 },
        {
            $lookup: {
                from: 'ingredients',
                localField: '_id',
                foreignField: '_id',
                as: 'ingredient',
            },
        },
        { $unwind: '$ingredient' },
    ])
        .toArray();
    // Apply list sorting based on settings
    const activeList = lists.filter(l => !l.isShared && !isListCompleted(l));
    const completedLists = lists.filter(l => !l.isShared && isListCompleted(l));
    const sharedLists = lists.filter(l => l.isShared);
    if (settings.sortCheckedItems) {
        const sortItems = (list) => {
            const sortedItems = [...list.items].sort((a, b) => {
                if (a.checked === b.checked)
                    return 0;
                return a.checked ? 1 : -1;
            });
            return Object.assign({}, list, { items: sortedItems });
        };
        for (let i = 0; i < activeList.length; i++) {
            activeList[i] = sortItems(activeList[i]);
        }
        for (let i = 0; i < sharedLists.length; i++) {
            sharedLists[i] = sortItems(sharedLists[i]);
        }
    }
    if (settings.sortByCategory) {
        const ingredientIds = new Set(lists.flatMap(l => l.items.map(i => i.ingredientId.toString())));
        const ingredients = await getCollection('ingredients')
            .find({ _id: { $in: Array.from(ingredientIds).map(id => new ObjectId(id)) } })
            .toArray();
        const ingredientMap = new Map(ingredients.map(i => [i._id.toString(), i.category]));
        const sortByCategory = (list) => {
            const sortedItems = [...list.items].sort((a, b) => {
                const catA = ingredientMap.get(a.ingredientId.toString()) || '';
                const catB = ingredientMap.get(b.ingredientId.toString()) || '';
                return catA.localeCompare(catB);
            });
            return Object.assign({}, list, { items: sortedItems });
        };
        for (let i = 0; i < activeList.length; i++) {
            activeList[i] = sortByCategory(activeList[i]);
        }
        for (let i = 0; i < sharedLists.length; i++) {
            sharedLists[i] = sortByCategory(sharedLists[i]);
        }
    }
    const response = {
        shoppingLists: {
            active: activeList,
            completed: completedLists,
            shared: sharedLists,
        },
        favorites: {
            items: favorites,
            recentlyUsed: recentItems,
            categories: favorites.reduce((acc, item) => {
                const category = item.ingredient.category;
                acc[category] = (acc[category] || 0) + 1;
                return acc;
            }, {}),
        },
        settings: {
            sortCheckedItems: settings.sortCheckedItems,
            sortByCategory: settings.sortByCategory,
            enableReminders: settings.enableReminders,
            defaultStore: settings.defaultStore,
            sharedListsEnabled: settings.sharedListsEnabled,
        },
    };
    res.json(response);
}));
// Update user dashboard settings
router.patch('/settings', auth, asyncHandler(async (req, res) => {
    const userId = new ObjectId(req.user.id);
    const allowedSettings = [
        'sortCheckedItems',
        'sortByCategory',
        'enableReminders',
        'defaultStore',
        'sharedListsEnabled',
    ];
    const updateData = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedSettings.includes(key)));
    await getCollection('user_settings').updateOne({ userId }, {
        $set: updateData,
        $setOnInsert: {
            userId,
            createdAt: new Date(),
        },
    }, { upsert: true });
    res.json({ success: true });
}));
function isListCompleted(list) {
    return list.items.every(item => item.checked);
}
export default router;
//# sourceMappingURL=user-dashboard.js.map