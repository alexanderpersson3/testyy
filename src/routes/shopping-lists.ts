import express, { Request, Response } from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';

import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { Recipe, ShoppingList } from '../types/recipe.js';

const router = express.Router();

// Get user's shopping lists
router.get('/',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);

    const lists = await db.collection<ShoppingList>('shopping_lists')
      .find({ userId, isArchived: false })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ lists });
  })
);

// Create shopping list from recipes
router.post('/from-recipes',
  auth,
  [
    check('name').trim().notEmpty(),
    check('description').optional().trim(),
    check('recipeIds').isArray().notEmpty(),
    check('recipeIds.*').isMongoId(),
    check('servingsMultiplier').optional().isObject(),
    check('servingsMultiplier.*').optional().isFloat({ min: 0.1 })
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);
    const recipeIds = req.body.recipeIds.map((id: string) => new ObjectId(id));
    const servingsMultiplier: Record<string, number> = req.body.servingsMultiplier || {};

    // Get all recipes
    const recipes = await db.collection<Recipe>('recipes')
      .find({ _id: { $in: recipeIds } })
      .toArray();

    if (recipes.length !== recipeIds.length) {
      return res.status(400).json({ message: 'One or more recipes not found' });
    }

    // Combine ingredients from all recipes
    const combinedIngredients = new Map<string, {
      name: string;
      amount: number;
      unit: string;
      notes?: string;
      recipeId?: ObjectId;
      isChecked: boolean;
      category?: string;
    }>();

    recipes.forEach(recipe => {
      const multiplier = recipe._id ? servingsMultiplier[recipe._id.toString()] || 1 : 1;
      recipe.ingredients.forEach(ingredient => {
        const key = `${ingredient.name.toLowerCase()}_${ingredient.unit.toLowerCase()}`;
        const existing = combinedIngredients.get(key);

        if (existing) {
          existing.amount += ingredient.amount * multiplier;
          if (ingredient.notes && !existing.notes?.includes(ingredient.notes)) {
            existing.notes = existing.notes 
              ? `${existing.notes}, ${ingredient.notes}`
              : ingredient.notes;
          }
        } else {
          combinedIngredients.set(key, {
            name: ingredient.name,
            amount: ingredient.amount * multiplier,
            unit: ingredient.unit,
            notes: ingredient.notes,
            recipeId: recipe._id,
            isChecked: false
          });
        }
      });
    });

    // Create shopping list
    const shoppingList: Omit<ShoppingList, '_id'> = {
      userId,
      name: req.body.name,
      description: req.body.description,
      items: Array.from(combinedIngredients.values()),
      recipeIds,
      servingsMultiplier: Object.fromEntries(
        recipeIds.map((recipeId: ObjectId) => [recipeId.toString(), servingsMultiplier[recipeId.toString()] || 1])
      ),
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection<ShoppingList>('shopping_lists').insertOne(shoppingList);

    res.status(201).json({
      success: true,
      shoppingListId: result.insertedId
    });
  })
);

// Add items to shopping list
router.post('/:id/items',
  auth,
  [
    check('items').isArray().notEmpty(),
    check('items.*.name').trim().notEmpty(),
    check('items.*.amount').isFloat({ min: 0 }),
    check('items.*.unit').trim().notEmpty(),
    check('items.*.notes').optional().trim(),
    check('items.*.category').optional().trim()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);
    const listId = new ObjectId(req.params.id);

    const items = req.body.items.map((item: any) => ({
      ...item,
      isChecked: false
    }));

    const result = await db.collection('shopping_lists').updateOne(
      { _id: listId, userId },
      { 
        $push: { 
          items: { 
            $each: items 
          } as any // Type assertion needed due to MongoDB types limitation
        },
        $set: { updatedAt: new Date() }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Shopping list not found or unauthorized' });
    }

    res.json({ success: true });
  })
);

// Update item in shopping list
router.put('/:id/items/:itemIndex',
  auth,
  [
    check('name').optional().trim().notEmpty(),
    check('amount').optional().isFloat({ min: 0 }),
    check('unit').optional().trim().notEmpty(),
    check('notes').optional().trim(),
    check('isChecked').optional().isBoolean(),
    check('category').optional().trim()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);
    const listId = new ObjectId(req.params.id);
    const itemIndex = parseInt(req.params.itemIndex);

    const updateFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(req.body)) {
      updateFields[`items.${itemIndex}.${key}`] = value;
    }
    updateFields.updatedAt = new Date();

    const result = await db.collection('shopping_lists').updateOne(
      { _id: listId, userId },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Shopping list not found or unauthorized' });
    }

    res.json({ success: true });
  })
);

// Remove item from shopping list
router.delete('/:id/items/:itemIndex',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);
    const listId = new ObjectId(req.params.id);
    const itemIndex = parseInt(req.params.itemIndex);

    const result = await db.collection('shopping_lists').updateOne(
      { _id: listId, userId },
      {
        $unset: { [`items.${itemIndex}`]: 1 },
        $set: { updatedAt: new Date() }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Shopping list not found or unauthorized' });
    }

    // Remove null items from array
    await db.collection('shopping_lists').updateOne(
      { _id: listId },
      { 
        $pull: { 
          items: null as any // Type assertion needed due to MongoDB types limitation
        } 
      }
    );

    res.json({ success: true });
  })
);

// Archive shopping list
router.post('/:id/archive',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);
    const listId = new ObjectId(req.params.id);

    const result = await db.collection('shopping_lists').updateOne(
      { _id: listId, userId },
      {
        $set: {
          isArchived: true,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Shopping list not found or unauthorized' });
    }

    res.json({ success: true });
  })
);

// Delete shopping list
router.delete('/:id',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);
    const listId = new ObjectId(req.params.id);

    const result = await db.collection('shopping_lists').deleteOne({
      _id: listId,
      userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Shopping list not found or unauthorized' });
    }

    res.json({ success: true });
  })
);

// Export shopping list as text
router.get('/:id/export',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);
    const listId = new ObjectId(req.params.id);

    const list = await db.collection<ShoppingList>('shopping_lists').findOne({
      _id: listId,
      userId
    });

    if (!list) {
      return res.status(404).json({ message: 'Shopping list not found or unauthorized' });
    }

    // Format shopping list as text
    let text = `${list.name}\n`;
    if (list.description) {
      text += `\n${list.description}\n`;
    }
    text += '\nItems:\n';

    // Group items by category
    const categorizedItems = new Map<string, typeof list.items>();
    list.items.forEach(item => {
      const category = item.category || 'Uncategorized';
      const items = categorizedItems.get(category) || [];
      items.push(item);
      categorizedItems.set(category, items);
    });

    // Add items by category
    for (const [category, items] of categorizedItems) {
      text += `\n${category}:\n`;
      items.forEach(item => {
        text += `${item.isChecked ? '[x]' : '[ ]'} ${item.amount} ${item.unit} ${item.name}`;
        if (item.notes) {
          text += ` (${item.notes})`;
        }
        text += '\n';
      });
    }

    // Add recipe information
    if (list.recipeIds.length > 0) {
      const recipes = await db.collection<Recipe>('recipes')
        .find({ _id: { $in: list.recipeIds } })
        .toArray();

      text += '\nRecipes:\n';
      recipes.forEach(recipe => {
        const servings = list.servingsMultiplier[recipe._id!.toString()] || 1;
        text += `- ${recipe.name} (${servings}x servings)\n`;
      });
    }

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${list.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt"`);
    res.send(text);
  })
);

export default router; 
