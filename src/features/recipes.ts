import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import validateRequest from '../middleware/validation';
import { auth as authenticateToken } from '../middleware/auth';
import rateLimitMiddleware from '../middleware/rate-limit';
import nutritionCalculator from '../services/nutrition-calculator';
import { db } from '../db';
import elasticClient from '../services/elastic-client';
import { asyncHandler } from '../utils/asyncHandler';

const router = express.Router();

// Validation schemas
const ingredientSchema = z.object({
  name: z.string().min(1, 'Ingredient name is required'),
  amount: z.number().positive('Amount must be positive'),
  unit: z.string().min(1, 'Unit is required'),
});

const createRecipeSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  servings: z.number().int().positive('Number of servings must be positive'),
  ingredients: z.array(ingredientSchema).min(1, 'At least one ingredient is required'),
  instructions: z.array(z.string()).min(1, 'At least one instruction is required'),
  cookingTime: z.number().int().positive().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  cuisine: z.string().optional(),
  tags: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  video: z.string().optional(),
  isPrivate: z.boolean().optional(),
  nutritionalInfo: z
    .object({
      calories: z.number().optional(),
      protein: z.number().optional(),
      carbs: z.number().optional(),
      fat: z.number().optional(),
    })
    .optional(),
});

const commentSchema = z.object({
  text: z.string().min(1).max(500),
});

// Create recipe
router.post(
  '/',
  authenticateToken,
  rateLimitMiddleware.api,
  validateRequest({ body: createRecipeSchema }),
  asyncHandler(async (req: Request, res: Response) => {
      const recipe = {
        ...req.body,
        userId: new ObjectId((req as any).user.id),
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'published',
        likes: [],
        comments: [],
        averageRating: 0,
        ratingCount: 0,
      };

      const result = await db.getDb().then(db => db.collection('recipes').insertOne(recipe));
      const recipeId = result.insertedId;

      // Calculate initial nutrition information
      const nutritionInfo = await nutritionCalculator.calculateRecipeNutrition(recipeId.toString());

      // Update recipe with nutrition information
      await db.getDb().then(db => db.collection('recipes').updateOne(
        { _id: recipeId },
        {
          $set: {
            nutrition: {
              perServing: nutritionInfo.nutritionPerPerson,
              total: nutritionInfo.totalNutrition,
              missingIngredients: nutritionInfo.missingNutritionInfo,
            },
          },
        }
      ));

      // Get the complete recipe with nutrition info
      const completeRecipe = await db.getDb().then(db => db.collection('recipes').findOne({ _id: recipeId }));

      // Index recipe in Elasticsearch
      await elasticClient.index({
        index: 'recipes',
        id: recipeId.toString(),
        body: {
          ...completeRecipe,
          _id: recipeId.toString(),
        },
      });

      // Update ingredient popularity
      const ingredientIds = recipe.ingredients.map((i: any) => new ObjectId(i.ingredientId));
      await db.getDb().then(db => 
        db.collection('ingredients')
        .updateMany({ _id: { $in: ingredientIds } }, { $inc: { popularity: 1 } })
      );

      res.status(201).json({
        success: true,
        data: completeRecipe,
      });
  })
);

// Get recipe details
router.get('/:recipeId', asyncHandler(async (req: Request, res: Response) => {
    const recipeId = new ObjectId(req.params.recipeId);

    // Get recipe details
    const recipe = await db.getDb().then(db => db.collection('recipes').findOne({
      _id: recipeId,
    }));

    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found',
      });
    }

    // Calculate nutrition information
    const nutritionInfo = await nutritionCalculator.calculateRecipeNutrition(recipeId.toString());

    // Get ingredient store information
    const ingredientsCollection = await db.getDb().then(db => db.collection('ingredients'));
    let ingredientNames = recipe.ingredients.map((ingredient: any) => ingredient.name);
    let ingredientsWithStores: any = {};
    let featuredIngredients: any = [];

    for (let index = 0; index < ingredientNames.length; index++) {
      const searchRegex = new RegExp(ingredientNames[index], 'i');
      const ingredients = await ingredientsCollection
        .find({
          name: searchRegex,
        })
        .toArray();

      ingredientsWithStores[ingredientNames[index]] = ingredients;

      if (ingredients.length > 0) {
        const lowestPriceIngredient = ingredients.reduce((lowest: any, current: any) => {
          return current.newPrice < lowest.newPrice ? current : lowest;
        }, ingredients[0]);

        const recipeIngredient = recipe.ingredients[index];
        featuredIngredients.push({
          name: lowestPriceIngredient.name,
          store: lowestPriceIngredient.store,
          storeLogo: lowestPriceIngredient.storeLogo,
          newPrice: lowestPriceIngredient.newPrice,
          oldPrice: lowestPriceIngredient.oldPrice,
          image: lowestPriceIngredient.image,
          amount: recipeIngredient.amount,
          unit: recipeIngredient.unit,
          hasNutritionInfo: !nutritionInfo.missingNutritionInfo?.includes(recipeIngredient.name),
        });
      }
    }

    // Calculate store totals
    const storeIngredients: any = {};
    const storeTotalPrices: any = {};
    const storeOldTotalPrices: any = {};

    for (const category of Object.values(ingredientsWithStores)) {
      const storeGroups: any = {};
      for (const item of (category as any[])) {
        if (!storeGroups[item.store]) {
          storeGroups[item.store] = [];
        }
        storeGroups[item.store].push(item);
      }

      for (const [store, items] of Object.entries(storeGroups)) {
        if (!storeIngredients[store]) {
          storeIngredients[store] = {
            storeLogo: ((items as any[])[0]).storeLogo,
            items: [],
          };
          storeTotalPrices[store] = 0;
          storeOldTotalPrices[store] = 0;
        }

        const lowestPriceItem = (items as any[]).reduce((lowest: any, current: any) => {
          return current.newPrice < lowest.newPrice ? current : lowest;
        }, (items as any[])[0]);

        storeIngredients[store].items.push({
          name: lowestPriceItem.name,
          newPrice: lowestPriceItem.newPrice,
          oldPrice: lowestPriceItem.oldPrice,
          image: lowestPriceItem.image,
        });

        storeTotalPrices[store] += lowestPriceItem.newPrice;
        storeOldTotalPrices[store] += lowestPriceItem.oldPrice;
      }
    }

    // Get top 3 stores by price
    const storeData = Object.entries(storeIngredients)
      .sort((a, b) => storeTotalPrices[a[0]] - storeTotalPrices[b[0]])
      .slice(0, 3)
      .map(([store, data]: [any, any]) => ({
        storeName: store,
        storeLogo: data.storeLogo,
        totalPrice: storeTotalPrices[store],
        oldTotalPrice: storeOldTotalPrices[store],
      }));

    res.json({
      success: true,
      data: {
        ...recipe,
        nutrition: {
          perServing: nutritionInfo.nutritionPerPerson,
          total: nutritionInfo.totalNutrition,
          servings: nutritionInfo.servings,
          missingIngredients: nutritionInfo.missingNutritionInfo,
        },
        storeData,
        featuredIngredients,
      },
    });
}));

// Get recipes list
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 10, sort = 'date', cuisine, difficulty, maxTime, tags } = req.query;

    const query: any = {};
    if (cuisine) query.cuisine = cuisine;
    if (difficulty) query.difficulty = difficulty;
    if (maxTime) query.cookingTime = { $lte: parseInt(maxTime as string) };
    if (tags) query.tags = { $all: (tags as string).split(',') };

    // Only show public recipes unless user is authenticated
    if (!(req as any).user) {
      query.isPrivate = { $ne: true };
    }

    let sortQuery: any = { createdAt: -1 };
    if (sort === 'rating') sortQuery = { averageRating: -1 };
    if (sort === 'popularity') sortQuery = { popularity: -1 };

    const recipes = await db.getDb().then(db => db.collection('recipes')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'author',
          },
        },
        { $unwind: '$author' },
        {
          $project: {
            title: 1,
            description: 1,
            image: 1,
            cookingTime: 1,
            difficulty: 1,
            averageRating: 1,
            totalRatings: 1,
            createdAt: 1,
            author: {
              _id: '$author._id',
              username: '$author.username',
              displayName: '$author.displayName',
              avatar: '$author.avatar',
            },
          },
        },
        { $sort: sortQuery },
        { $skip: (parseInt(page as string) - 1) * parseInt(limit as string) },
        { $limit: parseInt(limit as string) },
      ])
      .toArray());

    const total = await db.getDb().then(db => db.collection('recipes').countDocuments(query));

    res.json({
      recipes,
      total,
      page: parseInt(page as string),
      pages: Math.ceil(total / parseInt(limit as string)),
    });
}));

// Get recipe by ID
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const recipeId = new ObjectId(req.params.id);

    const recipe = await db.getDb().then(db => db.collection('recipes')
      .aggregate([
        { $match: { _id: recipeId } },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'author',
          },
        },
        { $unwind: '$author' },
        {
          $lookup: {
            from: 'ingredients',
            localField: 'ingredients.ingredientId',
            foreignField: '_id',
            as: 'ingredientDetails',
          },
        },
        {
          $lookup: {
            from: 'comments',
            let: { recipeId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$recipeId', '$$recipeId'] } } },
              { $sort: { createdAt: -1 } },
              { $limit: 10 },
              {
                $lookup: {
                  from: 'users',
                  localField: 'userId',
                  foreignField: '_id',
                  as: 'user',
                },
              },
              { $unwind: '$user' },
              {
                $project: {
                  _id: 1,
                  text: 1,
                  createdAt: 1,
                  user: {
                    _id: '$user._id',
                    username: '$user.username',
                    displayName: '$user.displayName',
                    avatar: '$user.avatar',
                  },
                },
              },
            ],
            as: 'comments',
          },
        },
      ])
      .next());

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    // Check if recipe is private and user has access
    if (recipe.isPrivate && (!(req as any).user || (req as any).user.id !== recipe.userId.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if user has liked the recipe
    let isLiked = false;
    if ((req as any).user) {
      isLiked =
        (await db.getDb().then(db => db.collection('likes').findOne({
          userId: new ObjectId((req as any).user.id),
          recipeId,
        }))) !== null;
    }

    res.json({
      ...recipe,
      isLiked,
    });
}));

// Update recipe
router.put('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const recipeId = new ObjectId(req.params.id);
    const userId = new ObjectId((req as any).user._id);
    const validatedData = createRecipeSchema.parse(req.body);

    // Check ownership
    const existingRecipe = await db.getDb().then(db => db.collection('recipes').findOne({
      _id: recipeId,
      userId: new ObjectId((req as any).user._id),
    }));

    if (!existingRecipe) {
      return res.status(404).json({ message: 'Recipe not found or unauthorized' });
    }

    const updateResult = await db.getDb().then(db => db.collection('recipes').findOneAndUpdate(
      { _id: recipeId },
      {
        $set: {
          ...validatedData,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    ));

    // Update in Elasticsearch
    await elasticClient.update({
      index: 'recipes',
      id: recipeId.toString(),
      body: {
        doc: {
          ...validatedData,
          updatedAt: new Date(),
        },
      },
    });

    // Update ingredient popularity
    const oldIngredientIds = existingRecipe.ingredients.map((i: any) => i.ingredientId);
    const newIngredientIds = validatedData.ingredients.map((i: any) => i.ingredientId);

    const removedIngredients = oldIngredientIds.filter((id: any) => !newIngredientIds.includes(id));
    const addedIngredients = newIngredientIds.filter((id: any) => !oldIngredientIds.includes(id));

    if (removedIngredients.length) {
      await db.getDb().then(db => 
        db.collection('ingredients')
        .updateMany(
          { _id: { $in: removedIngredients.map((id: any) => new ObjectId(id)) } },
          { $inc: { popularity: -1 } }
        )
      );
    }

    if (addedIngredients.length) {
      await db.getDb().then(db =>
        db.collection('ingredients')
        .updateMany(
          { _id: { $in: addedIngredients.map((id: any) => new ObjectId(id)) } },
          { $inc: { popularity: 1 } }
        )
      );
    }

    res.json(updateResult.value);
}));

// Delete recipe
router.delete('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const recipeId = new ObjectId(req.params.id);

    // Check ownership
    const recipe = await db.getDb().then(db => db.collection('recipes').findOne({
      _id: recipeId,
      userId: new ObjectId((req as any).user._id),
    }));

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found or unauthorized' });
    }

    // Delete recipe and related data
    await Promise.all([
      db.getDb().then(db => db.collection('recipes').deleteOne({ _id: recipeId })),
      db.getDb().then(db => db.collection('likes').deleteMany({ recipeId })),
      db.getDb().then(db => db.collection('comments').deleteMany({ recipeId })),
      elasticClient.delete({
        index: 'recipes',
        id: recipeId.toString(),
      }),
    ]);

    // Update ingredient popularity
    const ingredientIds = recipe.ingredients.map((i: any) => new ObjectId(i.ingredientId));
    await db.getDb().then(db =>
      db.collection('ingredients')
      .updateMany({ _id: { $in: ingredientIds } }, { $inc: { popularity: -1 } })
    );

    res.json({ message: 'Recipe deleted successfully' });
}));

// Like recipe
router.post('/:id/like', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const recipeId = new ObjectId(req.params.id);
    const userId = new ObjectId((req as any).user._id);

    // Check if recipe exists
    const recipe = await db.getDb().then(db => db.collection('recipes').findOne({ _id: recipeId }));
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    // Check if already liked
    const existingLike = await db.getDb().then(db => db.collection('likes').findOne({
      userId,
      recipeId,
    }));

    if (existingLike) {
      // Unlike
      await db.getDb().then(db => db.collection('likes').deleteOne({ _id: existingLike._id }));
      await db.getDb().then(db => db.collection('recipes').updateOne({ _id: recipeId }, { $inc: { likeCount: -1 } }));
      res.json({ liked: false });
    } else {
      // Like
      await db.getDb().then(db => db.collection('likes').insertOne({
        userId,
        recipeId,
        createdAt: new Date(),
      }));
      await db.getDb().then(db => db.collection('recipes').updateOne({ _id: recipeId }, { $inc: { likeCount: 1 } }));

      // Create notification for recipe owner
      if (recipe.userId.toString() !== userId.toString()) {
        await db.getDb().then(db => db.collection('notifications').insertOne({
          userId: recipe.userId,
          type: 'RECIPE_LIKED',
          actorId: userId,
          recipeId,
          read: false,
          createdAt: new Date(),
        }));
      }

      res.json({ liked: true });
    }
}));

// Add comment
router.post('/:id/comments', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const recipeId = new ObjectId(req.params.id);
    const userId = new ObjectId((req as any).user._id);
    const validatedData = commentSchema.parse(req.body);

    // Check if recipe exists
    const recipe = await db.getDb().then(db => db.collection('recipes').findOne({ _id: recipeId }));
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const comment = {
      recipeId,
      userId,
      text: validatedData.text,
      createdAt: new Date(),
    };

    const result = await db.getDb().then(db => db.collection('comments').insertOne(comment));

    // Create notification for recipe owner
    if (recipe.userId.toString() !== userId.toString()) {
      await db.getDb().then(db => db.collection('notifications').insertOne({
        userId: recipe.userId,
        type: 'RECIPE_COMMENTED',
        actorId: userId,
        recipeId,
        commentId: result.insertedId,
        read: false,
        createdAt: new Date(),
      }));
    }

    // Get user details for response
    const user = await db.getDb().then(db =>
      db.collection('users')
      .findOne({ _id: userId }, { projection: { username: 1, displayName: 1, avatar: 1 } })
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(201).json({
      _id: result.insertedId,
      ...comment,
      user: {
        _id: user?._id,
        username: user?.username,
        displayName: user?.displayName,
        avatar: user?.avatar,
      },
    });
}));

// Delete comment
router.delete('/:recipeId/comments/:commentId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const recipeId = new ObjectId(req.params.recipeId);
    const commentId = new ObjectId(req.params.commentId);
    const userId = new ObjectId((req as any).user._id);

    const comment = await db.getDb().then(db => db.collection('comments').findOne({
      _id: commentId,
      recipeId,
    }));

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is comment author or recipe owner or admin
    const recipe = await db.getDb().then(db => db.collection('recipes').findOne({ _id: recipeId }));

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const canDelete =
      comment.userId.toString() === userId.toString() ||
      recipe?.userId.toString() === userId.toString() ||
      (req as any).user.role === 'ADMIN';

    if (!canDelete) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    await db.getDb().then(db => db.collection('comments').deleteOne({ _id: commentId }));
    res.json({ message: 'Comment deleted successfully' });
}));

// Share recipe
router.post('/:id/share', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const recipeId = new ObjectId(req.params.id);
    const userId = new ObjectId((req as any).user._id);
    const { email } = req.body;

    // Check if recipe exists and is public
    const recipe = await db.getDb().then(db => db.collection('recipes').findOne({ _id: recipeId }));
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    if (recipe.isPrivate && recipe.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Cannot share private recipe' });
    }

    // Record share
    await db.getDb().then(db => db.collection('shares').insertOne({
      recipeId,
      userId,
      sharedWith: email,
      createdAt: new Date(),
    }));

    // Create notification for recipe owner
    if (recipe.userId.toString() !== userId.toString()) {
      await db.getDb().then(db => db.collection('notifications').insertOne({
        userId: recipe.userId,
        type: 'RECIPE_SHARED',
        actorId: userId,
        recipeId,
        read: false,
        createdAt: new Date(),
      }));
    }

    // Send email (implementation depends on your email service)
    // await require('../services/job-queue').addJob('email', 'RECIPE_SHARED', {
    //   email,
    //   recipe: {
    //     id: recipe._id,
    //     title: recipe.title,
    //     image: recipe.image,
    //   },
    //   sharedBy: {
    //     id: userId,
    //     username: (req as any).user.username,
    //   },
    // });

    res.json({ message: 'Recipe shared successfully' });
}));

// Get featured recipes
router.get('/featured', asyncHandler(async (req: Request, res: Response) => {
    const { limit = 5 } = req.query;

    const recipes = await db.getDb().then(db => db.collection('recipes')
      .aggregate([
        { $match: { isPrivate: { $ne: true } } },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'author',
          },
        },
        { $unwind: '$author' },
        {
          $addFields: {
            score: {
              $add: [
                { $multiply: ['$likeCount', 2] },
                { $multiply: ['$averageRating', 3] },
                '$commentCount',
              ],
            },
          },
        },
        { $sort: { score: -1 } },
        { $limit: parseInt(limit as string) },
        {
          $project: {
            title: 1,
            description: 1,
            image: 1,
            cookingTime: 1,
            difficulty: 1,
            averageRating: 1,
            likeCount: 1,
            commentCount: 1,
            author: {
              _id: '$author._id',
              username: '$author.username',
              displayName: '$author.displayName',
              avatar: '$author.avatar',
            },
          },
        },
      ])
      .toArray());

    res.json({ recipes });
}));

// Get user's saved recipes
router.get('/saved', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const userId = new ObjectId((req as any).user.id);
    const { page = 1, limit = 10 } = req.query;

    const savedRecipes = await db.getDb().then(db => db.collection('saved_recipes')
      .aggregate([
        { $match: { userId } },
        { $sort: { savedAt: -1 } },
        { $skip: (parseInt(page as string) - 1) * parseInt(limit as string) },
        { $limit: parseInt(limit as string) },
        {
          $lookup: {
            from: 'recipes',
            localField: 'recipeId',
            foreignField: '_id',
            as: 'recipe',
          },
        },
        { $unwind: '$recipe' },
        {
          $lookup: {
            from: 'users',
            localField: 'recipe.userId',
            foreignField: '_id',
            as: 'author',
          },
        },
        { $unwind: '$author' },
        {
          $project: {
            _id: '$recipe._id',
            title: '$recipe.title',
            description: '$recipe.description',
            image: '$recipe.image',
            cookingTime: '$recipe.cookingTime',
            difficulty: '$recipe.difficulty',
            averageRating: '$recipe.averageRating',
            savedAt: 1,
            author: {
              _id: '$author._id',
              username: '$author.username',
              displayName: '$author.displayName',
              avatar: '$author.avatar',
            },
          },
        },
      ])
      .toArray());

    const total = await db.getDb().then(db => db.collection('saved_recipes').countDocuments({ userId }));

    res.json({
      recipes: savedRecipes,
      total,
      page: parseInt(page as string),
      pages: Math.ceil(total / parseInt(limit as string)),
    });
}));

// Save/unsave recipe
router.post('/:id/save', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const recipeId = new ObjectId(req.params.id);
    const userId = new ObjectId((req as any).user.id);

    const existingSave = await db.getDb().then(db => db.collection('saved_recipes').findOne({
      userId,
      recipeId,
    }));

    if (existingSave) {
      await db.getDb().then(db => db.collection('saved_recipes').deleteOne({ _id: existingSave._id }));
      res.json({ saved: false });
    } else {
      await db.getDb().then(db => db.collection('saved_recipes').insertOne({
        userId,
        recipeId,
        savedAt: new Date(),
      }));
      res.json({ saved: true });
    }
}));

// Rate recipe
router.post('/:id/rate', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const recipeId = new ObjectId(req.params.id);
    const userId = new ObjectId((req as any).user.id);
    const { rating } = z.object({ rating: z.number().min(1).max(5) }).parse(req.body);

    const recipe = await db.getDb().then(db => db.collection('recipes').findOne({ _id: recipeId }));
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const existingRating = await db.getDb().then(db => db.collection('ratings').findOne({
      userId,
      recipeId,
    }));

    if (existingRating) {
      // Update existing rating
      await db.getDb().then(db => db.collection('ratings').updateOne(
        { _id: existingRating._id },
        {
          $set: {
            rating,
            updatedAt: new Date(),
          },
        }
      ));
    } else {
      // Create new rating
      await db.getDb().then(db => db.collection('ratings').insertOne({
        userId,
        recipeId,
        rating,
        createdAt: new Date(),
      }));

      // Create notification for recipe owner
      if (recipe.userId.toString() !== userId.toString()) {
        await db.getDb().then(db => db.collection('notifications').insertOne({
          userId: recipe.userId,
          type: 'RECIPE_RATED',
          actorId: userId,
          recipeId,
          rating,
          read: false,
          createdAt: new Date(),
        }));
      }
    }

    // Update recipe average rating
    const ratings = await db.getDb().then(db => db.collection('ratings').find({ recipeId }).toArray());

    const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

    await db.getDb().then(db => db.collection('recipes').updateOne(
      { _id: recipeId },
      {
        $set: {
          averageRating,
          ratingCount: ratings.length,
        },
      }
    ));

    res.json({
      rating,
      averageRating,
      totalRatings: ratings.length,
    });
}));

// Get similar recipes
router.get('/:id/similar', asyncHandler(async (req: Request, res: Response) => {
    const recipeId = new ObjectId(req.params.id);
    const { limit = 3 } = req.query;

    const recipe = await db.getDb().then(db => db.collection('recipes').findOne({ _id: recipeId }));
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const similarRecipes = await db.getDb().then(db => db.collection('recipes')
      .aggregate([
        {
          $match: {
            _id: { $ne: recipeId },
            isPrivate: { $ne: true },
            $or: [{ cuisine: recipe.cuisine }, { tags: { $in: recipe.tags || [] } }],
          },
        },
        {
          $addFields: {
            commonTags: {
              $size: {
                $setIntersection: ['$tags', recipe.tags || []],
              },
            },
          },
        },
        { $sort: { commonTags: -1, averageRating: -1 } },
        { $limit: parseInt(limit as string) },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'author',
          },
        },
        { $unwind: '$author' },
        {
          $project: {
            title: 1,
            description: 1,
            image: 1,
            cookingTime: 1,
            difficulty: 1,
            averageRating: 1,
            author: {
              _id: '$author._id',
              username: '$author.username',
              displayName: '$author.displayName',
              avatar: '$author.avatar',
            },
          },
        },
      ])
      .toArray());

    res.json({ recipes: similarRecipes });
}));

// Get recipe recommendations
router.get('/recommendations', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const userId = new ObjectId((req as any).user.id);
    const { limit = 5 } = req.query;

    // Get user's preferences and history
    const [userPreferences, likedRecipes] = await Promise.all([
      db.getDb().then(db => db.collection('users').findOne({ _id: userId }, { projection: { preferences: 1 } })),
      db.getDb().then(db => db.collection('likes').find({ userId }).toArray()),
    ]);

    // Build recommendation query based on preferences and liked recipes
    const likedRecipeIds = likedRecipes.map(like => like.recipeId);
    const query: any = {
      _id: { $nin: likedRecipeIds },
      isPrivate: { $ne: true },
    };

    if (userPreferences?.preferences?.cuisine?.length) {
      query.cuisine = { $in: userPreferences.preferences.cuisine };
    }

    const recommendations = await db.getDb().then(db => db.collection('recipes')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'author',
          },
        },
        { $unwind: '$author' },
        { $sample: { size: parseInt(limit as string) } },
        {
          $project: {
            title: 1,
            description: 1,
            image: 1,
            cookingTime: 1,
            difficulty: 1,
            averageRating: 1,
            author: {
              _id: '$author._id',
              username: '$author.username',
              displayName: '$author.displayName',
              avatar: '$author.avatar',
            },
          },
        },
      ])
      .toArray());

    res.json({ recipes: recommendations });
}));

export default router;
