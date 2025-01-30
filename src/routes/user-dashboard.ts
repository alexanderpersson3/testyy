import express, { Request, Response } from 'express';
import { ObjectId, WithId } from 'mongodb';

import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { ShoppingList, ShoppingListItem, UserSettings } from '../types/models.js';

const router = express.Router();

interface DashboardResponse {
  shoppingLists: {
    active: WithId<ShoppingList>[];
    completed: WithId<ShoppingList>[];
    shared: WithId<ShoppingList>[];
  };
  favorites: {
    items: any[];
    recentlyUsed: any[];
    categories: Record<string, number>;
  };
  settings: Omit<UserSettings, 'userId' | 'createdAt' | 'updatedAt'>;
}

// Get user's dashboard data
router.get('/', 
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);

    // Parse query parameters
    const listSort = (req.query.listSort as string) || 'updatedAt';
    const listOrder = (req.query.listOrder as 'asc' | 'desc') || 'desc';
    const favoriteSort = (req.query.favoriteSort as string) || 'updatedAt';
    const favoriteOrder = (req.query.favoriteOrder as 'asc' | 'desc') || 'desc';
    const categoryFilter = req.query.category as string;
    const searchQuery = req.query.q as string;

    // Get user settings
    const settings = await db.collection<UserSettings>('user_settings')
      .findOne({ userId }) || {
        userId,
        sortCheckedItems: true,
        sortByCategory: false,
        enableReminders: false,
        defaultStore: undefined,
        sharedListsEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

    // Build shopping list query
    const listQuery = {
      $or: [
        { userId },
        { 'collaborators.userId': userId }
      ]
    };

    // Get shopping lists with sorting
    const lists = await db.collection<ShoppingList>('shopping_lists')
      .find(listQuery)
      .sort({ [listSort]: listOrder === 'asc' ? 1 : -1 })
      .toArray();

    // Build favorites pipeline
    const favoritePipeline: any[] = [
      {
        $match: { userId }
      }
    ];

    // Add category filter if specified
    if (categoryFilter) {
      favoritePipeline.push({
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
        $match: {
          'ingredient.category': categoryFilter
        }
      });
    } else {
      favoritePipeline.push({
        $lookup: {
          from: 'ingredients',
          localField: 'ingredientId',
          foreignField: '_id',
          as: 'ingredient'
        }
      },
      {
        $unwind: '$ingredient'
      });
    }

    // Add search filter if specified
    if (searchQuery) {
      favoritePipeline.push({
        $match: {
          $or: [
            { 'ingredient.name': { $regex: searchQuery, $options: 'i' } },
            { 'ingredient.category': { $regex: searchQuery, $options: 'i' } },
            { customName: { $regex: searchQuery, $options: 'i' } }
          ]
        }
      });
    }

    // Add sorting
    favoritePipeline.push({
      $sort: { 
        [favoriteSort === 'name' ? 'ingredient.name' : favoriteSort]: 
        favoriteOrder === 'asc' ? 1 : -1 
      }
    });

    // Get favorite items
    const favorites = await db.collection('favorite_items')
      .aggregate(favoritePipeline)
      .toArray();

    // Calculate recently used items with improved aggregation
    const recentItems = await db.collection<ShoppingList>('shopping_lists')
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
                  null
                ]
              }
            },
            lastUnit: {
              $first: {
                $cond: [
                  { $eq: ['$items.updatedAt', { $max: '$items.updatedAt' }] },
                  '$items.unit',
                  null
                ]
              }
            }
          }
        },
        { $sort: { lastUsed: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'ingredients',
            localField: '_id',
            foreignField: '_id',
            as: 'ingredient'
          }
        },
        { $unwind: '$ingredient' }
      ])
      .toArray();

    // Apply list sorting based on settings
    const activeList = lists.filter(l => !l.isShared && !isListCompleted(l));
    const completedLists = lists.filter(l => !l.isShared && isListCompleted(l));
    const sharedLists = lists.filter(l => l.isShared);

    if (settings.sortCheckedItems) {
      const sortItems = (list: WithId<ShoppingList>) => {
        const sortedItems = [...list.items].sort((a, b) => {
          if (a.checked === b.checked) return 0;
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
      const ingredientIds = new Set(
        lists.flatMap(l => l.items.map(i => i.ingredientId.toString()))
      );

      const ingredients = await db.collection('ingredients')
        .find({ _id: { $in: Array.from(ingredientIds).map(id => new ObjectId(id)) } })
        .toArray();

      const ingredientMap = new Map(
        ingredients.map(i => [i._id.toString(), i.category])
      );

      const sortByCategory = (list: WithId<ShoppingList>) => {
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

    const response: DashboardResponse = {
      shoppingLists: {
        active: activeList,
        completed: completedLists,
        shared: sharedLists
      },
      favorites: {
        items: favorites,
        recentlyUsed: recentItems,
        categories: favorites.reduce((acc, item) => {
          const category = item.ingredient.category;
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      },
      settings: {
        sortCheckedItems: settings.sortCheckedItems,
        sortByCategory: settings.sortByCategory,
        enableReminders: settings.enableReminders,
        defaultStore: settings.defaultStore,
        sharedListsEnabled: settings.sharedListsEnabled
      }
    };

    res.json(response);
  })
);

// Update user dashboard settings
router.patch('/settings',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);

    const allowedSettings = [
      'sortCheckedItems',
      'sortByCategory',
      'enableReminders',
      'defaultStore',
      'sharedListsEnabled'
    ];

    const updateData = Object.fromEntries(
      Object.entries(req.body)
        .filter(([key]) => allowedSettings.includes(key))
    );

    await db.collection('user_settings').updateOne(
      { userId },
      { 
        $set: updateData,
        $setOnInsert: {
          userId,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    res.json({ success: true });
  })
);

// Helper function to check if a list is completed
function isListCompleted(list: ShoppingList): boolean {
  return list.items.length > 0 && list.items.every(item => item.checked);
}

export default router; 
