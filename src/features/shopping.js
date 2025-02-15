import { Router } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
const { authenticateToken } = require('../middleware/auth');
import rateLimiter from '../middleware/rate-limit.js';

const router = Router();

// Validation schemas
const shoppingListSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  source: z.enum(['MANUAL', 'RECIPE', 'MEAL_PLAN']).default('MANUAL'),
  sourceId: z.string().optional(),
  isShared: z.boolean().default(false),
  sharedWith: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
});

const shoppingItemSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string(),
  notes: z.string().max(200).optional(),
  ingredientId: z.string().optional(),
  recipeId: z.string().optional(),
  isChecked: z.boolean().default(false),
});

const shareListSchema = z.object({
  userIds: z.array(z.string()),
  permissions: z.enum(['VIEW', 'EDIT']).default('VIEW'),
});

// Create shopping list
router.post('/', authenticateToken, rateLimiter.medium(), async (req, res) => {
  try {
    const db = getDb();
    const validatedData = shoppingListSchema.parse(req.body);

    const shoppingList = {
      ...validatedData,
      userId: new ObjectId(req.user.id),
      items: [],
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Convert string IDs to ObjectIds
    if (shoppingList.sourceId) {
      shoppingList.sourceId = new ObjectId(shoppingList.sourceId);
    }
    if (shoppingList.sharedWith) {
      shoppingList.sharedWith = shoppingList.sharedWith.map(id => new ObjectId(id));
    }

    const result = await db.collection('shopping_lists').insertOne(shoppingList);

    // If created from recipe or meal plan, populate items
    if (shoppingList.source === 'RECIPE' && shoppingList.sourceId) {
      const recipe = await db.collection('recipes').findOne({
        _id: shoppingList.sourceId,
      });

      if (recipe) {
        const items = recipe.ingredients.map(ingredient => ({
          name: ingredient.name,
          category: ingredient.category,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          ingredientId: ingredient.ingredientId,
          recipeId: recipe._id,
          isChecked: false,
        }));

        await db
          .collection('shopping_lists')
          .updateOne({ _id: result.insertedId }, { $set: { items } });
      }
    } else if (shoppingList.source === 'MEAL_PLAN' && shoppingList.sourceId) {
      const mealPlan = await db
        .collection('meal_plans')
        .aggregate([
          { $match: { _id: shoppingList.sourceId } },
          {
            $lookup: {
              from: 'recipes',
              localField: 'meals.recipeId',
              foreignField: '_id',
              as: 'recipes',
            },
          },
        ])
        .next();

      if (mealPlan) {
        // Aggregate ingredients from all recipes
        const items = mealPlan.recipes.reduce((acc, recipe) => {
          recipe.ingredients.forEach(ingredient => {
            const existingItem = acc.find(
              item => item.ingredientId && item.ingredientId.equals(ingredient.ingredientId)
            );

            if (existingItem) {
              existingItem.quantity += ingredient.quantity;
            } else {
              acc.push({
                name: ingredient.name,
                category: ingredient.category,
                quantity: ingredient.quantity,
                unit: ingredient.unit,
                ingredientId: ingredient.ingredientId,
                recipeId: recipe._id,
                isChecked: false,
              });
            }
          });
          return acc;
        }, []);

        await db
          .collection('shopping_lists')
          .updateOne({ _id: result.insertedId }, { $set: { items } });
      }
    }

    const createdList = await db.collection('shopping_lists').findOne({
      _id: result.insertedId,
    });

    res.status(201).json(createdList);
  } catch (error) {
    throw error;
  }
});

// Get user's shopping lists
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 10, status } = req.query;

    const query = {
      $or: [{ userId: new ObjectId(req.user.id) }, { sharedWith: new ObjectId(req.user.id) }],
    };
    if (status) query.status = status;

    const lists = await db
      .collection('shopping_lists')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'creator',
          },
        },
        { $unwind: '$creator' },
        {
          $lookup: {
            from: 'users',
            localField: 'sharedWith',
            foreignField: '_id',
            as: 'sharedUsers',
          },
        },
        { $sort: { updatedAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
      ])
      .toArray();

    const total = await db.collection('shopping_lists').countDocuments(query);

    res.json({
      lists,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Get specific shopping list
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const listId = new ObjectId(req.params.id);

    const list = await db
      .collection('shopping_lists')
      .aggregate([
        {
          $match: {
            _id: listId,
            $or: [{ userId: new ObjectId(req.user.id) }, { sharedWith: new ObjectId(req.user.id) }],
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'creator',
          },
        },
        { $unwind: '$creator' },
        {
          $lookup: {
            from: 'users',
            localField: 'sharedWith',
            foreignField: '_id',
            as: 'sharedUsers',
          },
        },
      ])
      .next();

    if (!list) {
      return res.status(404).json({ message: 'Shopping list not found' });
    }

    res.json(list);
  } catch (error) {
    throw error;
  }
});

// Add items to shopping list
router.post('/:id/items', authenticateToken, rateLimiter.medium(), async (req, res) => {
  try {
    const db = getDb();
    const listId = new ObjectId(req.params.id);
    const items = z.array(shoppingItemSchema).parse(req.body);

    // Convert string IDs to ObjectIds
    const processedItems = items.map(item => ({
      ...item,
      ingredientId: item.ingredientId ? new ObjectId(item.ingredientId) : undefined,
      recipeId: item.recipeId ? new ObjectId(item.recipeId) : undefined,
    }));

    const result = await db.collection('shopping_lists').findOneAndUpdate(
      {
        _id: listId,
        $or: [{ userId: new ObjectId(req.user.id) }, { sharedWith: new ObjectId(req.user.id) }],
      },
      {
        $push: { items: { $each: processedItems } },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Shopping list not found' });
    }

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

// Update item in shopping list
router.patch('/:id/items/:itemIndex', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const listId = new ObjectId(req.params.id);
    const itemIndex = parseInt(req.params.itemIndex);
    const updates = z
      .object({
        quantity: z.number().positive().optional(),
        notes: z.string().max(200).optional(),
        isChecked: z.boolean().optional(),
      })
      .parse(req.body);

    const result = await db.collection('shopping_lists').findOneAndUpdate(
      {
        _id: listId,
        $or: [{ userId: new ObjectId(req.user.id) }, { sharedWith: new ObjectId(req.user.id) }],
      },
      {
        $set: {
          [`items.${itemIndex}`]: {
            $mergeObjects: [`$items.${itemIndex}`, updates],
          },
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Shopping list or item not found' });
    }

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

// Remove item from shopping list
router.delete('/:id/items/:itemIndex', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const listId = new ObjectId(req.params.id);
    const itemIndex = parseInt(req.params.itemIndex);

    const result = await db.collection('shopping_lists').findOneAndUpdate(
      {
        _id: listId,
        $or: [{ userId: new ObjectId(req.user.id) }, { sharedWith: new ObjectId(req.user.id) }],
      },
      {
        $unset: { [`items.${itemIndex}`]: 1 },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Shopping list or item not found' });
    }

    // Remove null values from items array
    await db.collection('shopping_lists').updateOne({ _id: listId }, { $pull: { items: null } });

    res.json({ message: 'Item removed successfully' });
  } catch (error) {
    throw error;
  }
});

// Share shopping list
router.post('/:id/share', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const listId = new ObjectId(req.params.id);
    const { userIds, permissions } = shareListSchema.parse(req.body);

    const list = await db.collection('shopping_lists').findOne({
      _id: listId,
      userId: new ObjectId(req.user.id),
    });

    if (!list) {
      return res.status(404).json({ message: 'Shopping list not found' });
    }

    const userObjectIds = userIds.map(id => new ObjectId(id));

    // Update list sharing settings
    const result = await db.collection('shopping_lists').findOneAndUpdate(
      { _id: listId },
      {
        $set: {
          isShared: true,
          permissions,
          updatedAt: new Date(),
        },
        $addToSet: {
          sharedWith: { $each: userObjectIds },
        },
      },
      { returnDocument: 'after' }
    );

    // Create notifications for shared users
    const notifications = userObjectIds.map(userId => ({
      userId,
      type: 'SHOPPING_LIST_SHARED',
      title: 'Shopping List Shared',
      message: `${req.user.name} shared a shopping list with you`,
      data: {
        listId,
        permissions,
      },
      createdAt: new Date(),
    }));

    await db.collection('notifications').insertMany(notifications);

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

// Unshare shopping list
router.delete('/:id/share/:userId', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const listId = new ObjectId(req.params.id);
    const unshareUserId = new ObjectId(req.params.userId);

    const result = await db.collection('shopping_lists').findOneAndUpdate(
      {
        _id: listId,
        userId: new ObjectId(req.user.id),
      },
      {
        $pull: { sharedWith: unshareUserId },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Shopping list not found' });
    }

    // Update isShared flag if no more shared users
    if (result.value.sharedWith.length === 0) {
      await db.collection('shopping_lists').updateOne(
        { _id: listId },
        {
          $set: {
            isShared: false,
            permissions: null,
          },
        }
      );
    }

    res.json({ message: 'User removed from shared list' });
  } catch (error) {
    throw error;
  }
});

// Delete shopping list
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const listId = new ObjectId(req.params.id);

    const result = await db.collection('shopping_lists').findOneAndUpdate(
      {
        _id: listId,
        userId: new ObjectId(req.user.id),
      },
      {
        $set: {
          status: 'DELETED',
          updatedAt: new Date(),
        },
      }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Shopping list not found' });
    }

    res.json({ message: 'Shopping list deleted successfully' });
  } catch (error) {
    throw error;
  }
});

// Clear completed items
router.post('/:id/clear-completed', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const listId = new ObjectId(req.params.id);

    const result = await db.collection('shopping_lists').findOneAndUpdate(
      {
        _id: listId,
        $or: [{ userId: new ObjectId(req.user.id) }, { sharedWith: new ObjectId(req.user.id) }],
      },
      {
        $pull: {
          items: { isChecked: true },
        },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Shopping list not found' });
    }

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

export default router;
