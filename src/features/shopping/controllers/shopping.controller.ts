import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { ShoppingService } from '../services/shopping.service';
import { authenticateToken } from '../../../middleware/auth';
import { rateLimiter } from '../../../middleware/rate-limit';
import { ValidationError } from '../../../core/errors/validation.error';
import { z } from 'zod';

const router = Router();
const shoppingService = ShoppingService.getInstance();

// Validation schemas
const createShoppingListSchema = z.object({
  name: z.string().min(1).max(100),
  items: z.array(z.object({
    ingredientId: z.string(),
    name: z.string(),
    quantity: z.number().positive(),
    unit: z.string(),
    category: z.string().optional(),
    notes: z.string().optional(),
  })).optional(),
  recipeId: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const updateShoppingListSchema = createShoppingListSchema.partial();

const storeSearchSchema = z.object({
  query: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  features: z.array(z.string()).optional(),
  radius: z.number().positive().optional(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  sortBy: z.string().optional(),
  limit: z.number().min(1).max(50).optional(),
  offset: z.number().min(0).optional(),
});

// Shopping List Routes
router.post(
  '/lists',
  authenticateToken,
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = new ObjectId(req.user!._id);
      const input = createShoppingListSchema.parse(req.body);

      const list = await shoppingService.createShoppingList(userId, {
        ...input,
        items: input.items?.map(item => ({
          ...item,
          ingredientId: new ObjectId(item.ingredientId),
          checked: false,
          addedAt: new Date(),
        })) || [],
      });

      res.status(201).json(list);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid input data',
          errors: error.errors,
        });
      }
      if (error instanceof ValidationError) {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error creating shopping list:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

router.get(
  '/lists/:listId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const listId = new ObjectId(req.params.listId);
      const userId = new ObjectId(req.user!._id);

      const list = await shoppingService.getShoppingList(listId, userId);
      res.json(list);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(403).json({ message: error.message });
      }
      console.error('Error fetching shopping list:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

router.put(
  '/lists/:listId',
  authenticateToken,
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const listId = new ObjectId(req.params.listId);
      const userId = new ObjectId(req.user!._id);
      const update = updateShoppingListSchema.parse(req.body);

      const updatedList = await shoppingService.updateShoppingList(listId, userId, {
        ...update,
        items: update.items?.map(item => ({
          ...item,
          ingredientId: new ObjectId(item.ingredientId),
          checked: false,
          addedAt: new Date(),
        })),
      });

      res.json(updatedList);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid input data',
          errors: error.errors,
        });
      }
      if (error instanceof ValidationError) {
        return res.status(403).json({ message: error.message });
      }
      console.error('Error updating shopping list:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

router.delete(
  '/lists/:listId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const listId = new ObjectId(req.params.listId);
      const userId = new ObjectId(req.user!._id);

      const deleted = await shoppingService.deleteShoppingList(listId, userId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(404).json({ message: 'Shopping list not found' });
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(403).json({ message: error.message });
      }
      console.error('Error deleting shopping list:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

router.post(
  '/lists/:listId/share',
  authenticateToken,
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const listId = new ObjectId(req.params.listId);
      const ownerId = new ObjectId(req.user!._id);
      const shareWithUserId = new ObjectId(req.body.userId);

      const updatedList = await shoppingService.shareShoppingList(
        listId,
        ownerId,
        shareWithUserId
      );

      res.json(updatedList);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(403).json({ message: error.message });
      }
      console.error('Error sharing shopping list:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// Store Routes
router.get(
  '/stores/search',
  async (req: Request, res: Response) => {
    try {
      const params = storeSearchSchema.parse(req.query);
      const stores = await shoppingService.searchStores(params);
      res.json(stores);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid search parameters',
          errors: error.errors,
        });
      }
      console.error('Error searching stores:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

router.get(
  '/stores/:storeId/deals',
  async (req: Request, res: Response) => {
    try {
      const storeId = new ObjectId(req.params.storeId);
      const deals = await shoppingService.getStoreDeals(storeId);
      res.json(deals);
    } catch (error) {
      console.error('Error fetching store deals:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

router.get(
  '/stores/:storeId/products',
  async (req: Request, res: Response) => {
    try {
      const storeId = new ObjectId(req.params.storeId);
      const category = req.query.category as string | undefined;
      const products = await shoppingService.getStoreProducts(storeId, category);
      res.json(products);
    } catch (error) {
      console.error('Error fetching store products:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// Statistics Route
router.get(
  '/lists/stats',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = new ObjectId(req.user!._id);
      const stats = await shoppingService.getShoppingListStats(userId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching shopping list stats:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router; 