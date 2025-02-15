import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../db.js';
import { auth as authenticateToken } from '../middleware/auth.js'
import rateLimiter from '../middleware/rate-limit.js';

const router = Router();

// Validation schemas
const itemSchema = z.object({
  name: z.string().min(1).max(100),
  quantity: z.number().positive(),
  unit: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().max(500).optional(),
  ingredientId: z.string().optional(),
});

const shoppingListSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  items: z.array(itemSchema).default([]),
  isShared: z.boolean().default(false),
  sharedWith: z.array(z.string()).optional(),
});

const shareSchema = z.object({
  userIds: z.array(z.string()),
  permissions: z.enum(['view', 'edit']).default('view'),
});

interface AuthenticatedRequest extends Request {
    user?: {
      id: string;
      username: string;
    };
}

interface Item {
    name: string;
    quantity: number;
    unit?: string;
    category?: string;
    notes?: string;
    ingredientId?: string | ObjectId;
    status: 'pending' | 'completed' | 'cancelled';
    addedAt: Date;
    completedAt?: Date;
}
  
interface ShoppingList {
    _id: ObjectId;
    userId: ObjectId;
    items: Item[];
    status: 'active' | 'deleted';
    createdAt: Date;
    updatedAt: Date;
    mealPlanId?: ObjectId;    
    name: string;
    description?: string;
    isShared: boolean;
    sharedWith?: string[];
}

// Create shopping list
router.post('/', authenticateToken, rateLimiter.api, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const database = await db.getDb();
    const validatedData = shoppingListSchema.parse(req.body);

    const shoppingList: Omit<ShoppingList, '_id'> = {
      ...validatedData,
      userId: new ObjectId(req.user!.id),
      items: validatedData.items.map(item => ({
        ...item,
        status: 'pending',
        addedAt: new Date(),
        ...(item.ingredientId && { ingredientId: new ObjectId(item.ingredientId) }),
      })),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await database.collection('shopping_lists').insertOne(shoppingList);

    const createdList = await database.collection('shopping_lists').findOne({
      _id: result.insertedId,
    });

    res.status(201).json(createdList);
  } catch (error: any) {
    res.status(500).json({ message: 'Error creating shopping list', error: error.message });
  }
});

// Get user's shopping lists
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const database = await db.getDb();
      const { page = '1', limit = '10', status = 'active' } = req.query;
  
      const query = {
        userId: new ObjectId(req.user!.id),
        status,
      };
  
      const lists = await database
        .collection('shopping_lists')
        .aggregate([
          { $match: query },
          {
            $lookup: {
              from: 'meal_plans',
              localField: 'mealPlanId',
              foreignField: '_id',
              as: 'mealPlan',
            },
          },
          { $unwind: { path: '$mealPlan', preserveNullAndEmptyArrays: true } },
          { $sort: { updatedAt: -1 } },
          { $skip: (parseInt(page as string) - 1) * parseInt(limit as string) },
          { $limit: parseInt(limit as string) },
        ])
        .toArray();
  
      const total = await database.collection('shopping_lists').countDocuments(query);
  
      res.json({
        lists,
        total,
        page: parseInt(page as string),
        pages: Math.ceil(total / parseInt(limit as string)),
      });
    } catch (error: any) {
        res.status(500).json({ message: 'Error getting shopping lists', error: error.message });
    }
  });

// Get specific shopping list
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const database = await db.getDb();
      const listId = new ObjectId(req.params.id);
  
      const list = await database
        .collection('shopping_lists')
        .aggregate([
          {
            $match: {
              _id: listId,
              $or: [
                { userId: new ObjectId(req.user!.id) },
                { isShared: true, sharedWith: req.user!.id },
              ],
            },
          },
          {
            $lookup: {
              from: 'meal_plans',
              localField: 'mealPlanId',
              foreignField: '_id',
              as: 'mealPlan',
            },
          },
          { $unwind: { path: '$mealPlan', preserveNullAndEmptyArrays: true } },
        ])
        .next() as ShoppingList | null;
  
      if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
      }
  
      res.json(list);
    } catch (error: any) {
        res.status(500).json({ message: 'Error getting shopping list', error: error.message });
    }
  });

// Add items to list
router.post('/:id/items', authenticateToken, rateLimiter.api, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const database = await db.getDb();
      const listId = new ObjectId(req.params.id);
      const items = z.array(itemSchema).parse(req.body);
  
      const processedItems: Item[] = items.map(item => ({
        ...item,
        status: 'pending',
        addedAt: new Date(),
        ...(item.ingredientId && { ingredientId: new ObjectId(item.ingredientId) }),
      }));
  
      const result = await database.collection('shopping_lists').findOneAndUpdate(
        {
          _id: listId,
          $or: [
            { userId: new ObjectId(req.user!.id) },
            { isShared: true, sharedWith: req.user!.id, sharePermissions: 'edit' },
          ],
        },
        {
          $push: { items: { $each: processedItems } } as any,
          $set: { updatedAt: new Date() },
        },
        { returnDocument: 'after' }
      );
  
      if (!result.value) {
        return res.status(404).json({ message: 'Shopping list not found or permission denied' });
      }
  
      res.json(result.value);
    } catch (error: any) {
        res.status(500).json({ message: 'Error adding items to shopping list', error: error.message });
    }
  });

// Update item status
router.patch('/:id/items/:itemIndex', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const database = await db.getDb();
      const listId = new ObjectId(req.params.id);
      const itemIndex = parseInt(req.params.itemIndex);
      const { status } = z
        .object({ status: z.enum(['pending', 'completed', 'cancelled']) })
        .parse(req.body);
  
      const result = await database.collection('shopping_lists').findOneAndUpdate(
        {
          _id: listId,
          $or: [
            { userId: new ObjectId(req.user!.id) },
            { isShared: true, sharedWith: req.user!.id, sharePermissions: 'edit' },
          ],
        },
        {
          $set: {
            [`items.${itemIndex}.status`]: status,
            [`items.${itemIndex}.completedAt`]: status === 'completed' ? new Date() : null,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );
  
      if (!result.value) {
        return res.status(404).json({ message: 'Shopping list not found or permission denied' });
      }
  
      res.json(result.value);
    } catch (error: any) {
        res.status(500).json({ message: 'Error updating item status', error: error.message });
    }
  });

// Remove item from list
router.delete('/:id/items/:itemIndex', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const database = await db.getDb();
      const listId = new ObjectId(req.params.id);
      const itemIndex = parseInt(req.params.itemIndex);
  
      const result = await database.collection('shopping_lists').findOneAndUpdate(
        {
          _id: listId,
          $or: [
            { userId: new ObjectId(req.user!.id) },
            { isShared: true, sharedWith: req.user!.id, sharePermissions: 'edit' },
          ],
        },
        {
          $unset: { [`items.${itemIndex}`]: 1 },
          $set: { updatedAt: new Date() },
        },
        { returnDocument: 'after' }
      );
  
      if (!result.value) {
        return res.status(404).json({ message: 'Shopping list not found or permission denied' });
      }
  
      // Remove null values from items array
      await database.collection('shopping_lists').updateOne({ _id: listId }, { $pull: { items: null } });
  
      res.json(result.value);
    } catch (error: any) {
        res.status(500).json({ message: 'Error removing item from shopping list', error: error.message });
    }
  });

// Clear completed items
router.post('/:id/clear-completed', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const database = await db.getDb();
      const listId = new ObjectId(req.params.id);
  
      const result = await database.collection('shopping_lists').findOneAndUpdate(
        {
          _id: listId,
          $or: [
            { userId: new ObjectId(req.user!.id) },
            { isShared: true, sharedWith: req.user!.id, sharePermissions: 'edit' },
          ],
        },
        {
          $pull: { items: { status: 'completed' } } as any,
          $set: { updatedAt: new Date() },
        },
        { returnDocument: 'after' }
      );
  
      if (!result.value) {
        return res.status(404).json({ message: 'Shopping list not found or permission denied' });
      }
  
      res.json(result.value);
    } catch (error: any) {
        res.status(500).json({ message: 'Error clearing completed items', error: error.message });
    }
  });

// Share shopping list
router.post('/:id/share', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const database = await db.getDb();
      const listId = new ObjectId(req.params.id);
      const { userIds, permissions } = shareSchema.parse(req.body);
  
      // Verify users exist
      const users = await database
        .collection('users')
        .find({ _id: { $in: userIds.map(id => new ObjectId(id)) } })
        .toArray();
  
      if (users.length !== userIds.length) {
        return res.status(400).json({ message: 'One or more users not found' });
      }
  
      const result = await database.collection('shopping_lists').findOneAndUpdate(
        {
          _id: listId,
          userId: new ObjectId(req.user!.id),
        },
        {
          $set: {
            isShared: true,
            sharedWith: userIds,
            sharePermissions: permissions,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );
  
      if (!result.value) {
        return res.status(404).json({ message: 'Shopping list not found' });
      }
  
      // Create notifications for shared users
      const notifications = users.map(user => ({
        userId: user._id,
        type: 'SHOPPING_LIST_SHARED',
        title: 'Shopping List Shared',
        message: `${req.user!.username} shared a shopping list with you: ${result.value!.name}`,
        data: {
          listId: listId,
          permissions,
        },
        createdAt: new Date(),
      }));
  
      await database.collection('notifications').insertMany(notifications);
  
      res.json(result.value);
    } catch (error: any) {
        res.status(500).json({ message: 'Error sharing shopping list', error: error.message });
    }
  });

// Delete shopping list
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const database = await db.getDb();
      const listId = new ObjectId(req.params.id);
  
      const result = await database.collection('shopping_lists').findOneAndUpdate(
        {
          _id: listId,
          userId: new ObjectId(req.user!.id),
        },
        {
          $set: {
            status: 'deleted',
            updatedAt: new Date(),
          },
        }
      );
  
      if (!result.value) {
        return res.status(404).json({ message: 'Shopping list not found' });
      }
  
      res.json({ message: 'Shopping list deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error deleting shopping list', error: error.message });
    }
  });
  
  export default router;