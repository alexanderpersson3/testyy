import { Router } from 'express';;
import type { Recipe } from '../types/express.js';
import type { Router } from '../types/express.js';;
import { z } from 'zod';;
import multer from 'multer';
import path from 'path';
import { auth } from '../middleware/auth.js';;
import { validate } from '../middleware/validate.js';;
import { ShoppingListService } from '../services/shopping-list.service.js';;
import { handleError } from '../utils/errors.js';;
import { ItemCategory, ITEM_CATEGORIES } from '../types/shopping-list.js';;

const router = Router();
const shoppingListService = ShoppingListService.getInstance();

// Configure multer for voice input uploads
const upload = multer({
  dest: path.join(process.cwd(), 'uploads/temp'),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only WAV, MP3, and WebM audio files are allowed'), false);
    }
  },
});

// Validation schemas
const createListSchema = z.object({
  name: z.string().min(1).max(100),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().positive(),
        unit: z.string(),
        category: z.enum(Object.keys(ITEM_CATEGORIES) as [ItemCategory, ...ItemCategory[]]).optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .optional(),
  store: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
});

const addItemsSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string(),
      category: z.enum(Object.keys(ITEM_CATEGORIES) as [ItemCategory, ...ItemCategory[]]).optional(),
      notes: z.string().max(500).optional(),
    })
  ),
});

const addItemsFromRecipeSchema = z.object({
  recipeId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  servings: z.number().positive().optional(),
  excludeItems: z.array(z.string()).optional(),
});

const updateItemSchema = z.object({
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  checked: z.boolean().optional(),
  notes: z.string().max(500).optional(),
  category: z.enum(Object.keys(ITEM_CATEGORIES) as [ItemCategory, ...ItemCategory[]]).optional(),
});

const shareListSchema = z.object({
  collaboratorId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  role: z.enum(['editor', 'viewer']),
});

// Routes
router.post('/', auth, validate(createListSchema), async (req: any, res: any) => {
  try {
    const listId = await shoppingListService.createList(req.user!.id, req.body);
    res.status(201).json({ listId });
  } catch (error) {
    handleError(error instanceof Error ? error : new Error('Unknown error'), res);
  }
});

router.get('/', auth, async (req: any, res: any) => {
  try {
    const lists = await shoppingListService.getLists(req.user!.id);
    res.json(lists);
  } catch (error) {
    handleError(error instanceof Error ? error : new Error('Unknown error'), res);
  }
});

router.get('/:listId', auth, async (req: any, res: any) => {
  try {
    const list = await shoppingListService.getList(req.user!.id, req.params.listId);
    if (!list) {
      return res.status(404).json({ error: 'Shopping list not found' });
    }
    res.json(list);
  } catch (error) {
    handleError(error instanceof Error ? error : new Error('Unknown error'), res);
  }
});

router.post('/:listId/items', auth, validate(addItemsSchema), async (req: any, res: any) => {
  try {
    const list = await shoppingListService.addItems(req.user!.id, req.params.listId, req.body.items);
    res.status(201).json(list);
  } catch (error) {
    handleError(error instanceof Error ? error : new Error('Unknown error'), res);
  }
});

router.post(
  '/:listId/items/recipe',
  auth,
  validate(addItemsFromRecipeSchema),
  async (req: any, res: any) => {
    try {
      const list = await shoppingListService.addItemsFromRecipe(
        req.user!.id,
        req.params.listId,
        req.body
      );
      res.status(201).json(list);
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
  }
);

router.patch('/:listId/items/:itemId', auth, validate(updateItemSchema), async (req: any, res: any) => {
  try {
    const list = await shoppingListService.updateItem(
      req.user!.id,
      req.params.listId,
      req.params.itemId,
      req.body
    );
    res.json(list);
  } catch (error) {
    handleError(error instanceof Error ? error : new Error('Unknown error'), res);
  }
});

router.delete('/:listId/items/:itemId', auth, async (req: any, res: any) => {
  try {
    await shoppingListService.deleteItem(req.user!.id, req.params.listId, req.params.itemId);
    res.status(204).send();
  } catch (error) {
    handleError(error instanceof Error ? error : new Error('Unknown error'), res);
  }
});

router.post(
  '/:listId/voice',
  auth,
  upload.single('audio'),
  async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      const result = await shoppingListService.processVoiceInput(
        req.user!.id,
        req.params.listId,
        req.file.buffer
      );

      res.json(result);
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
  }
);

router.post('/:listId/share', auth, validate(shareListSchema), async (req: any, res: any) => {
  try {
    await shoppingListService.shareList(
      req.user!.id,
      req.params.listId,
      req.body.collaboratorId,
      req.body.role
    );
    res.status(204).send();
  } catch (error) {
    handleError(error instanceof Error ? error : new Error('Unknown error'), res);
  }
});

export default router; 