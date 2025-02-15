import { Router } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
const { authenticateToken } = require('../middleware/auth');
import rateLimiter from '../middleware/rate-limit.js';

const router = Router();

// Validation schemas
const mealPlanSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  servings: z.number().int().positive(),
  preferences: z
    .object({
      dietary: z.array(z.string()).optional(),
      allergies: z.array(z.string()).optional(),
      excludeIngredients: z.array(z.string()).optional(),
    })
    .optional(),
  isTemplate: z.boolean().default(false),
  isShared: z.boolean().default(false),
  sharedWith: z.array(z.string()).optional(),
});

const mealSchema = z.object({
  recipeId: z.string(),
  date: z.string().datetime(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  servings: z.number().int().positive(),
  notes: z.string().max(500).optional(),
});

const shareSchema = z.object({
  userIds: z.array(z.string()),
  permissions: z.enum(['view', 'edit']).default('view'),
});

// Create meal plan
router.post('/', authenticateToken, rateLimiter.medium(), async (req, res) => {
  try {
    const db = getDb();
    const validatedData = mealPlanSchema.parse(req.body);

    const mealPlan = {
      ...validatedData,
      userId: new ObjectId(req.user.id),
      meals: [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('meal_plans').insertOne(mealPlan);

    const createdPlan = await db.collection('meal_plans').findOne({
      _id: result.insertedId,
    });

    res.status(201).json(createdPlan);
  } catch (error) {
    throw error;
  }
});

// Get user's meal plans
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 10, isTemplate } = req.query;

    const query = {
      userId: new ObjectId(req.user.id),
      status: 'active',
    };
    if (isTemplate !== undefined) {
      query.isTemplate = isTemplate === 'true';
    }

    const mealPlans = await db
      .collection('meal_plans')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'recipes',
            localField: 'meals.recipeId',
            foreignField: '_id',
            as: 'recipes',
          },
        },
        { $sort: { startDate: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
      ])
      .toArray();

    const total = await db.collection('meal_plans').countDocuments(query);

    res.json({
      mealPlans,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Get specific meal plan
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const mealPlanId = new ObjectId(req.params.id);

    const mealPlan = await db
      .collection('meal_plans')
      .aggregate([
        {
          $match: {
            _id: mealPlanId,
            $or: [
              { userId: new ObjectId(req.user.id) },
              { isShared: true, sharedWith: req.user.id },
            ],
          },
        },
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

    if (!mealPlan) {
      return res.status(404).json({ message: 'Meal plan not found' });
    }

    res.json(mealPlan);
  } catch (error) {
    throw error;
  }
});

// Add meal to plan
router.post('/:id/meals', authenticateToken, rateLimiter.medium(), async (req, res) => {
  try {
    const db = getDb();
    const mealPlanId = new ObjectId(req.params.id);
    const meal = mealSchema.parse(req.body);

    // Verify recipe exists
    const recipe = await db.collection('recipes').findOne({
      _id: new ObjectId(meal.recipeId),
    });

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const result = await db.collection('meal_plans').findOneAndUpdate(
      {
        _id: mealPlanId,
        userId: new ObjectId(req.user.id),
      },
      {
        $push: {
          meals: {
            ...meal,
            recipeId: new ObjectId(meal.recipeId),
            addedAt: new Date(),
          },
        },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Meal plan not found' });
    }

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

// Remove meal from plan
router.delete('/:id/meals/:mealIndex', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const mealPlanId = new ObjectId(req.params.id);
    const mealIndex = parseInt(req.params.mealIndex);

    const result = await db.collection('meal_plans').findOneAndUpdate(
      {
        _id: mealPlanId,
        userId: new ObjectId(req.user.id),
      },
      {
        $unset: { [`meals.${mealIndex}`]: 1 },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Meal plan or meal not found' });
    }

    // Remove null values from meals array
    await db.collection('meal_plans').updateOne({ _id: mealPlanId }, { $pull: { meals: null } });

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

// Generate shopping list from meal plan
router.post('/:id/shopping-list', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const mealPlanId = new ObjectId(req.params.id);

    // Get meal plan with recipes
    const mealPlan = await db
      .collection('meal_plans')
      .aggregate([
        {
          $match: {
            _id: mealPlanId,
            userId: new ObjectId(req.user.id),
          },
        },
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

    if (!mealPlan) {
      return res.status(404).json({ message: 'Meal plan not found' });
    }

    // Aggregate ingredients from all meals
    const ingredients = mealPlan.meals.reduce((acc, meal) => {
      const recipe = mealPlan.recipes.find(r => r._id.equals(meal.recipeId));
      if (!recipe) return acc;

      recipe.ingredients.forEach(ingredient => {
        const key = `${ingredient.name}-${ingredient.unit}`;
        if (acc[key]) {
          acc[key].quantity += (ingredient.quantity * meal.servings) / recipe.servings;
        } else {
          acc[key] = {
            name: ingredient.name,
            quantity: (ingredient.quantity * meal.servings) / recipe.servings,
            unit: ingredient.unit,
            category: ingredient.category,
          };
        }
      });

      return acc;
    }, {});

    // Create shopping list
    const shoppingList = {
      userId: new ObjectId(req.user.id),
      name: `Shopping List for ${mealPlan.name}`,
      mealPlanId: mealPlanId,
      items: Object.values(ingredients).map(item => ({
        ...item,
        status: 'pending',
        addedAt: new Date(),
      })),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('shopping_lists').insertOne(shoppingList);

    const createdList = await db.collection('shopping_lists').findOne({
      _id: result.insertedId,
    });

    res.status(201).json(createdList);
  } catch (error) {
    throw error;
  }
});

// Share meal plan
router.post('/:id/share', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const mealPlanId = new ObjectId(req.params.id);
    const { userIds, permissions } = shareSchema.parse(req.body);

    // Verify users exist
    const users = await db
      .collection('users')
      .find({ _id: { $in: userIds.map(id => new ObjectId(id)) } })
      .toArray();

    if (users.length !== userIds.length) {
      return res.status(400).json({ message: 'One or more users not found' });
    }

    const result = await db.collection('meal_plans').findOneAndUpdate(
      {
        _id: mealPlanId,
        userId: new ObjectId(req.user.id),
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
      return res.status(404).json({ message: 'Meal plan not found' });
    }

    // Create notifications for shared users
    const notifications = users.map(user => ({
      userId: user._id,
      type: 'MEAL_PLAN_SHARED',
      title: 'Meal Plan Shared',
      message: `${req.user.username} shared a meal plan with you: ${result.value.name}`,
      data: {
        mealPlanId: mealPlanId,
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

// Delete meal plan
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const mealPlanId = new ObjectId(req.params.id);

    const result = await db.collection('meal_plans').findOneAndUpdate(
      {
        _id: mealPlanId,
        userId: new ObjectId(req.user.id),
      },
      {
        $set: {
          status: 'deleted',
          updatedAt: new Date(),
        },
      }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Meal plan not found' });
    }

    res.json({ message: 'Meal plan deleted successfully' });
  } catch (error) {
    throw error;
  }
});

export default router;
