import express, { Request, Response } from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';

import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { Recipe, MealPlan, ShoppingList } from '../types/recipe.js';
import nutritionService from '../services/nutrition-service.js';
import shoppingListService from '../services/shopping-list-service.js';

const router = express.Router();

// Get user's meal plans
router.get('/',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);

    const mealPlans = await db.collection<MealPlan>('meal_plans')
      .find({ userId, isArchived: false })
      .sort({ startDate: -1 })
      .toArray();

    res.json({ mealPlans });
  })
);

// Create meal plan
router.post('/',
  auth,
  [
    check('name').trim().notEmpty(),
    check('description').optional().trim(),
    check('startDate').isISO8601(),
    check('endDate').isISO8601(),
    check('meals').isArray().notEmpty(),
    check('meals.*.date').isISO8601(),
    check('meals.*.recipeId').isMongoId(),
    check('meals.*.servings').isInt({ min: 1 }),
    check('meals.*.mealType').isIn(['breakfast', 'lunch', 'dinner', 'snack']),
    check('meals.*.notes').optional().trim()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);

    // Verify all recipes exist
    const recipeIds = [...new Set(req.body.meals.map((meal: { recipeId: string }) => new ObjectId(meal.recipeId)))];
    const recipes = await db.collection<Recipe>('recipes')
      .find({ _id: { $in: recipeIds as ObjectId[] } })
      .toArray();

    if (recipes.length !== recipeIds.length) {
      return res.status(400).json({ message: 'One or more recipes not found' });
    }

    // Create meal plan
    const mealPlan: Omit<MealPlan, '_id'> = {
      userId,
      name: req.body.name,
      description: req.body.description,
      startDate: new Date(req.body.startDate),
      endDate: new Date(req.body.endDate),
      meals: req.body.meals.map((meal: any) => ({
        date: new Date(meal.date),
        recipeId: new ObjectId(meal.recipeId),
        servings: meal.servings,
        mealType: meal.mealType,
        notes: meal.notes
      })),
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection<MealPlan>('meal_plans').insertOne(mealPlan);

    res.status(201).json({
      success: true,
      mealPlanId: result.insertedId
    });
  })
);

// Update meal plan
router.put('/:id',
  auth,
  [
    check('name').optional().trim().notEmpty(),
    check('description').optional().trim(),
    check('startDate').optional().isISO8601(),
    check('endDate').optional().isISO8601(),
    check('meals').optional().isArray(),
    check('meals.*.date').optional().isISO8601(),
    check('meals.*.recipeId').optional().isMongoId(),
    check('meals.*.servings').optional().isInt({ min: 1 }),
    check('meals.*.mealType').optional().isIn(['breakfast', 'lunch', 'dinner', 'snack']),
    check('meals.*.notes').optional().trim()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);
    const mealPlanId = new ObjectId(req.params.id);

    // If updating meals, verify all recipes exist
    if (req.body.meals) {
      const recipeIds = [...new Set(req.body.meals.map((meal: { recipeId: string }) => new ObjectId(meal.recipeId)))];
      const recipes = await db.collection<Recipe>('recipes')
        .find({ _id: { $in: recipeIds as ObjectId[] } })
        .toArray();

      if (recipes.length !== recipeIds.length) {
        return res.status(400).json({ message: 'One or more recipes not found' });
      }
    }

    const updateData: Partial<MealPlan> = {
      ...req.body,
      updatedAt: new Date()
    };

    if (req.body.startDate) {
      updateData.startDate = new Date(req.body.startDate);
    }
    if (req.body.endDate) {
      updateData.endDate = new Date(req.body.endDate);
    }
    if (req.body.meals) {
      updateData.meals = req.body.meals.map((meal: any) => ({
        date: new Date(meal.date),
        recipeId: new ObjectId(meal.recipeId),
        servings: meal.servings,
        mealType: meal.mealType,
        notes: meal.notes
      }));
    }

    const result = await db.collection('meal_plans').updateOne(
      { _id: mealPlanId, userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Meal plan not found or unauthorized' });
    }

    res.json({ success: true });
  })
);

// Generate shopping list from meal plan
router.post('/:id/shopping-list',
  auth,
  [
    check('startDate').optional().isISO8601(),
    check('endDate').optional().isISO8601(),
    check('excludeIngredients').optional().isArray(),
    check('excludeIngredients.*').optional().isString()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const mealPlanId = req.params.id;
    const options = {
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      excludeIngredients: req.body.excludeIngredients
    };

    const shoppingListId = await shoppingListService.generateFromMealPlan(
      mealPlanId,
      options
    );

    res.status(201).json({
      success: true,
      data: {
        shoppingListId
      }
    });
  })
);

// Get organized shopping list
router.get('/:id/shopping-list',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const mealPlanId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user!.id);

    // Get meal plan to find shopping list ID
    const mealPlan = await db.collection<MealPlan>('meal_plans').findOne(
      {
        _id: mealPlanId,
        userId
      },
      {
        projection: { shoppingListId: 1 }
      }
    );

    if (!mealPlan?.shoppingListId) {
      return res.status(404).json({ message: 'No shopping list found for this meal plan' });
    }

    const organizedList = await shoppingListService.getOrganizedList(
      mealPlan.shoppingListId.toString()
    );

    res.json({
      success: true,
      data: organizedList
    });
  })
);

// Update shopping list items
router.patch('/:id/shopping-list/items',
  auth,
  [
    check('items').isArray(),
    check('items.*.name').isString(),
    check('items.*.amount').optional().isNumeric(),
    check('items.*.isChecked').optional().isBoolean(),
    check('items.*.notes').optional().isString()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const mealPlanId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user!.id);

    // Get meal plan to find shopping list ID
    const mealPlan = await db.collection<MealPlan>('meal_plans').findOne(
      {
        _id: mealPlanId,
        userId
      },
      {
        projection: { shoppingListId: 1 }
      }
    );

    if (!mealPlan?.shoppingListId) {
      return res.status(404).json({ message: 'No shopping list found for this meal plan' });
    }

    await shoppingListService.updateItems(
      mealPlan.shoppingListId.toString(),
      req.body.items
    );

    res.json({ success: true });
  })
);

// Archive meal plan
router.post('/:id/archive',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);
    const mealPlanId = new ObjectId(req.params.id);

    const result = await db.collection('meal_plans').updateOne(
      { _id: mealPlanId, userId },
      {
        $set: {
          isArchived: true,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Meal plan not found or unauthorized' });
    }

    res.json({ success: true });
  })
);

// Delete meal plan
router.delete('/:id',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);
    const mealPlanId = new ObjectId(req.params.id);

    const result = await db.collection('meal_plans').deleteOne({
      _id: mealPlanId,
      userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Meal plan not found or unauthorized' });
    }

    res.json({ success: true });
  })
);

// Update nutritional goals
router.post('/:id/nutritional-goals',
  auth,
  [
    check('calories.min').optional().isInt({ min: 0 }),
    check('calories.max').optional().isInt({ min: 0 }),
    check('macros.protein.min').optional().isInt({ min: 0 }),
    check('macros.protein.max').optional().isInt({ min: 0 }),
    check('macros.carbs.min').optional().isInt({ min: 0 }),
    check('macros.carbs.max').optional().isInt({ min: 0 }),
    check('macros.fat.min').optional().isInt({ min: 0 }),
    check('macros.fat.max').optional().isInt({ min: 0 }),
    check('fiber.min').optional().isInt({ min: 0 }),
    check('fiber.max').optional().isInt({ min: 0 }),
    check('sodium.min').optional().isInt({ min: 0 }),
    check('sodium.max').optional().isInt({ min: 0 })
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const mealPlanId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user!.id);

    // Verify meal plan ownership
    const mealPlan = await db.collection<MealPlan>('meal_plans').findOne({
      _id: mealPlanId,
      userId
    });

    if (!mealPlan) {
      return res.status(404).json({ message: 'Meal plan not found or unauthorized' });
    }

    // Update meal plan's nutritional goals
    await db.collection('meal_plans').updateOne(
      { _id: mealPlanId },
      {
        $set: {
          nutritionalGoals: req.body,
          updatedAt: new Date()
        }
      }
    );

    // Recalculate nutritional summary with new goals
    await nutritionService.calculateMealPlanNutrition(mealPlanId.toString());

    res.json({ success: true });
  })
);

// Get nutritional warnings for a specific date
router.get('/:id/nutritional-warnings/:date',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const mealPlanId = req.params.id;
    const date = req.params.date;

    const warnings = await nutritionService.getDailyNutritionalWarnings(mealPlanId, date);

    res.json({
      success: true,
      data: warnings
    });
  })
);

// Get nutritional summary for meal plan
router.get('/:id/nutritional-summary',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const mealPlanId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user!.id);

    const mealPlan = await db.collection<MealPlan>('meal_plans').findOne(
      {
        _id: mealPlanId,
        userId
      },
      {
        projection: {
          dailyNutritionalSummary: 1,
          nutritionalGoals: 1
        }
      }
    );

    if (!mealPlan) {
      return res.status(404).json({ message: 'Meal plan not found or unauthorized' });
    }

    res.json({
      success: true,
      data: {
        summary: mealPlan.dailyNutritionalSummary,
        goals: mealPlan.nutritionalGoals
      }
    });
  })
);

export default router; 
