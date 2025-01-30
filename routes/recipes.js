import express from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
import { authenticateToken } from '../middleware/auth.js';
import { apiLimiter } from '../middleware/rate-limit.js';
import nutritionCalculator from '../services/nutrition-calculator.js';
import { getDb } from '../config/db.js';
import elasticClient from '../services/elastic-client.js';

const router = express.Router();

// Validation schemas
const ingredientSchema = z.object({
  name: z.string().min(1, 'Ingredient name is required'),
  amount: z.number().positive('Amount must be positive'),
  unit: z.string().min(1, 'Unit is required')
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
  nutritionalInfo: z.object({
    calories: z.number().optional(),
    protein: z.number().optional(),
    carbs: z.number().optional(),
    fat: z.number().optional()
  }).optional()
});

const commentSchema = z.object({
  text: z.string().min(1).max(500)
});

// Create recipe
router.post('/', 
  authenticateToken,
  apiLimiter,
  validateRequest({ body: createRecipeSchema }),
  async (req, res) => {
    try {
      const db = getDb();
      
      const recipe = {
        ...req.body,
        userId: new ObjectId(req.user.id),
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'published',
        likes: [],
        comments: [],
        averageRating: 0,
        ratingCount: 0
      };

      const result = await db.collection('recipes').insertOne(recipe);
      const recipeId = result.insertedId;

      // Calculate initial nutrition information
      const nutritionInfo = await nutritionCalculator.calculateRecipeNutrition(recipeId);

      // Update recipe with nutrition information
      await db.collection('recipes').updateOne(
        { _id: recipeId },
        { 
          $set: { 
            nutrition: {
              perServing: nutritionInfo.nutritionPerPerson,
              total: nutritionInfo.totalNutrition,
              missingIngredients: nutritionInfo.missingNutritionInfo
            }
          } 
        }
      );

      // Get the complete recipe with nutrition info
      const completeRecipe = await db.collection('recipes').findOne({ _id: recipeId });

      // Index recipe in Elasticsearch
      await elasticClient.index({
        index: 'recipes',
        id: recipeId.toString(),
        body: {
          ...completeRecipe,
          _id: recipeId.toString()
        }
      });

      // Update ingredient popularity
      const ingredientIds = recipe.ingredients.map(i => new ObjectId(i.ingredientId));
      await db.collection('ingredients').updateMany(
        { _id: { $in: ingredientIds } },
        { $inc: { popularity: 1 } }
      );

      res.status(201).json({
        success: true,
        data: completeRecipe
      });
    } catch (err) {
      console.error('Error creating recipe:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to create recipe'
      });
    }
  }
);

// Get recipe details
router.get("/:recipeId", async (req, res) => {
  try {
    const db = getDb();
    const recipeId = new ObjectId(req.params.recipeId);
    
    // Get recipe details
    const recipe = await db.collection('recipes').findOne({
      _id: recipeId
    });

    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found'
      });
    }

    // Calculate nutrition information
    const nutritionInfo = await nutritionCalculator.calculateRecipeNutrition(recipeId);

    // Get ingredient store information
    const ingredientsCollection = await db.collection('ingredients');
    let ingredientNames = recipe.ingredients.map(ingredient => ingredient.name);
    let ingredientsWithStores = {};
    let featuredIngredients = [];

    for (let index = 0; index < ingredientNames.length; index++) {
      const searchRegex = new RegExp(ingredientNames[index], "i");
      const ingredients = await ingredientsCollection
        .find({
          name: searchRegex
        })
        .toArray();

      ingredientsWithStores[ingredientNames[index]] = ingredients;

      if (ingredients.length > 0) {
        const lowestPriceIngredient = ingredients.reduce((lowest, current) => {
          return (current.newPrice < lowest.newPrice) ? current : lowest;
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
          hasNutritionInfo: !nutritionInfo.missingNutritionInfo?.includes(recipeIngredient.name)
        });
      }
    }

    // Calculate store totals
    const storeIngredients = {};
    const storeTotalPrices = {};
    const storeOldTotalPrices = {};

    for (const category of Object.values(ingredientsWithStores)) {
      const storeGroups = {};
      for (const item of category) {
        if (!storeGroups[item.store]) {
          storeGroups[item.store] = [];
        }
        storeGroups[item.store].push(item);
      }

      for (const [store, items] of Object.entries(storeGroups)) {
        if (!storeIngredients[store]) {
          storeIngredients[store] = {
            storeLogo: items[0].storeLogo,
            items: []
          };
          storeTotalPrices[store] = 0;
          storeOldTotalPrices[store] = 0;
        }

        const lowestPriceItem = items.reduce((lowest, current) => {
          return (current.newPrice < lowest.newPrice) ? current : lowest;
        }, items[0]);

        storeIngredients[store].items.push({
          name: lowestPriceItem.name,
          newPrice: lowestPriceItem.newPrice,
          oldPrice: lowestPriceItem.oldPrice,
          image: lowestPriceItem.image
        });

        storeTotalPrices[store] += lowestPriceItem.newPrice;
        storeOldTotalPrices[store] += lowestPriceItem.oldPrice;
      }
    }

    // Get top 3 stores by price
    const storeData = Object.entries(storeIngredients)
      .sort((a, b) => storeTotalPrices[a[0]] - storeTotalPrices[b[0]])
      .slice(0, 3)
      .map(([store, data]) => ({
        storeName: store,
        storeLogo: data.storeLogo,
        totalPrice: storeTotalPrices[store],
        oldTotalPrice: storeOldTotalPrices[store]
      }));

    res.json({
      success: true,
      data: {
        ...recipe,
        nutrition: {
          perServing: nutritionInfo.nutritionPerPerson,
          total: nutritionInfo.totalNutrition,
          servings: nutritionInfo.servings,
          missingIngredients: nutritionInfo.missingNutritionInfo
        },
        storeData,
        featuredIngredients
      }
    });
  } catch (err) {
    console.error('Error getting recipe details:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get recipe details'
    });
  }
});

// Get recipes list
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const {
      page = 1,
      limit = 10,
      sort = 'date',
      cuisine,
      difficulty,
      maxTime,
      tags
    } = req.query;

    const query = {};
    if (cuisine) query.cuisine = cuisine;
    if (difficulty) query.difficulty = difficulty;
    if (maxTime) query.cookingTime = { $lte: parseInt(maxTime) };
    if (tags) query.tags = { $all: tags.split(',') };

    // Only show public recipes unless user is authenticated
    if (!req.user) {
      query.isPrivate = { $ne: true };
    }

    let sortQuery = { createdAt: -1 };
    if (sort === 'rating') sortQuery = { averageRating: -1 };
    if (sort === 'popularity') sortQuery = { popularity: -1 };

    const recipes = await db.collection('recipes')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'author'
          }
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
              avatar: '$author.avatar'
            }
          }
        },
        { $sort: sortQuery },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) }
      ])
      .toArray();

    const total = await db.collection('recipes').countDocuments(query);

    res.json({
      recipes,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    throw error;
  }
});

// Get recipe by ID
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const recipeId = new ObjectId(req.params.id);

    const recipe = await db.collection('recipes').aggregate([
      { $match: { _id: recipeId } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'author'
        }
      },
      { $unwind: '$author' },
      {
        $lookup: {
          from: 'ingredients',
          localField: 'ingredients.ingredientId',
          foreignField: '_id',
          as: 'ingredientDetails'
        }
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
                as: 'user'
              }
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
                  avatar: '$user.avatar'
                }
              }
            }
          ],
          as: 'comments'
        }
      }
    ]).next();

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    // Check if recipe is private and user has access
    if (recipe.isPrivate && (!req.user || req.user.id !== recipe.userId.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if user has liked the recipe
    let isLiked = false;
    if (req.user) {
      isLiked = await db.collection('likes').findOne({
        userId: new ObjectId(req.user.id),
        recipeId
      }) !== null;
    }

    res.json({
      ...recipe,
      isLiked
    });
  } catch (error) {
    throw error;
  }
});

// Update recipe
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const recipeId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user._id);
    const validatedData = createRecipeSchema.parse(req.body);

    // Check ownership
    const existingRecipe = await db.collection('recipes').findOne({
      _id: recipeId,
      userId: new ObjectId(req.user._id)
    });

    if (!existingRecipe) {
      return res.status(404).json({ message: 'Recipe not found or unauthorized' });
    }

    const updateResult = await db.collection('recipes').findOneAndUpdate(
      { _id: recipeId },
      {
        $set: {
          ...validatedData,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    // Update in Elasticsearch
    await elasticClient.update({
      index: 'recipes',
      id: recipeId.toString(),
      body: {
        doc: {
          ...validatedData,
          updatedAt: new Date()
        }
      }
    });

    // Update ingredient popularity
    const oldIngredientIds = existingRecipe.ingredients.map(i => i.ingredientId);
    const newIngredientIds = validatedData.ingredients.map(i => i.ingredientId);
    
    const removedIngredients = oldIngredientIds.filter(id => !newIngredientIds.includes(id));
    const addedIngredients = newIngredientIds.filter(id => !oldIngredientIds.includes(id));

    if (removedIngredients.length) {
      await db.collection('ingredients').updateMany(
        { _id: { $in: removedIngredients.map(id => new ObjectId(id)) } },
        { $inc: { popularity: -1 } }
      );
    }

    if (addedIngredients.length) {
      await db.collection('ingredients').updateMany(
        { _id: { $in: addedIngredients.map(id => new ObjectId(id)) } },
        { $inc: { popularity: 1 } }
      );
    }

    res.json(updateResult.value);
  } catch (error) {
    throw error;
  }
});

// Delete recipe
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const recipeId = new ObjectId(req.params.id);

    // Check ownership
    const recipe = await db.collection('recipes').findOne({
      _id: recipeId,
      userId: new ObjectId(req.user._id)
    });

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found or unauthorized' });
    }

    // Delete recipe and related data
    await Promise.all([
      db.collection('recipes').deleteOne({ _id: recipeId }),
      db.collection('likes').deleteMany({ recipeId }),
      db.collection('comments').deleteMany({ recipeId }),
      elasticClient.delete({
        index: 'recipes',
        id: recipeId.toString()
      })
    ]);

    // Update ingredient popularity
    const ingredientIds = recipe.ingredients.map(i => new ObjectId(i.ingredientId));
    await db.collection('ingredients').updateMany(
      { _id: { $in: ingredientIds } },
      { $inc: { popularity: -1 } }
    );

    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    throw error;
  }
});

// Like recipe
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const recipeId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user._id);

    // Check if recipe exists
    const recipe = await db.collection('recipes').findOne({ _id: recipeId });
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    // Check if already liked
    const existingLike = await db.collection('likes').findOne({
      userId,
      recipeId
    });

    if (existingLike) {
      // Unlike
      await db.collection('likes').deleteOne({ _id: existingLike._id });
      await db.collection('recipes').updateOne(
        { _id: recipeId },
        { $inc: { likeCount: -1 } }
      );
      res.json({ liked: false });
    } else {
      // Like
      await db.collection('likes').insertOne({
        userId,
        recipeId,
        createdAt: new Date()
      });
      await db.collection('recipes').updateOne(
        { _id: recipeId },
        { $inc: { likeCount: 1 } }
      );

      // Create notification for recipe owner
      if (recipe.userId.toString() !== userId.toString()) {
        await db.collection('notifications').insertOne({
          userId: recipe.userId,
          type: 'RECIPE_LIKED',
          actorId: userId,
          recipeId,
          read: false,
          createdAt: new Date()
        });
      }

      res.json({ liked: true });
    }
  } catch (error) {
    throw error;
  }
});

// Add comment
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const recipeId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user._id);
    const validatedData = commentSchema.parse(req.body);

    // Check if recipe exists
    const recipe = await db.collection('recipes').findOne({ _id: recipeId });
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const comment = {
      recipeId,
      userId,
      text: validatedData.text,
      createdAt: new Date()
    };

    const result = await db.collection('comments').insertOne(comment);

    // Create notification for recipe owner
    if (recipe.userId.toString() !== userId.toString()) {
      await db.collection('notifications').insertOne({
        userId: recipe.userId,
        type: 'RECIPE_COMMENTED',
        actorId: userId,
        recipeId,
        commentId: result.insertedId,
        read: false,
        createdAt: new Date()
      });
    }

    // Get user details for response
    const user = await db.collection('users').findOne(
      { _id: userId },
      { projection: { username: 1, displayName: 1, avatar: 1 } }
    );

    res.status(201).json({
      _id: result.insertedId,
      ...comment,
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar
      }
    });
  } catch (error) {
    throw error;
  }
});

// Delete comment
router.delete('/:recipeId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const recipeId = new ObjectId(req.params.recipeId);
    const commentId = new ObjectId(req.params.commentId);
    const userId = new ObjectId(req.user._id);

    const comment = await db.collection('comments').findOne({
      _id: commentId,
      recipeId
    });

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is comment author or recipe owner or admin
    const recipe = await db.collection('recipes').findOne({ _id: recipeId });
    const canDelete = comment.userId.toString() === userId.toString() ||
      recipe.userId.toString() === userId.toString() ||
      req.user.role === 'ADMIN';

    if (!canDelete) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    await db.collection('comments').deleteOne({ _id: commentId });
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    throw error;
  }
});

// Share recipe
router.post('/:id/share', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const recipeId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user._id);
    const { email } = req.body;

    // Check if recipe exists and is public
    const recipe = await db.collection('recipes').findOne({ _id: recipeId });
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    if (recipe.isPrivate && recipe.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Cannot share private recipe' });
    }

    // Record share
    await db.collection('shares').insertOne({
      recipeId,
      userId,
      sharedWith: email,
      createdAt: new Date()
    });

    // Create notification for recipe owner
    if (recipe.userId.toString() !== userId.toString()) {
      await db.collection('notifications').insertOne({
        userId: recipe.userId,
        type: 'RECIPE_SHARED',
        actorId: userId,
        recipeId,
        read: false,
        createdAt: new Date()
      });
    }

    // Send email
    await require('../services/job-queue').addJob('email', 'RECIPE_SHARED', {
      email,
      recipe: {
        id: recipe._id,
        title: recipe.title,
        image: recipe.image
      },
      sharedBy: {
        id: userId,
        username: req.user.username
      }
    });

    res.json({ message: 'Recipe shared successfully' });
  } catch (error) {
    throw error;
  }
});

// Get featured recipes
router.get('/featured', async (req, res) => {
  try {
    const db = getDb();
    const { limit = 5 } = req.query;

    const recipes = await db.collection('recipes')
      .aggregate([
        { $match: { isPrivate: { $ne: true } } },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'author'
          }
        },
        { $unwind: '$author' },
        {
          $addFields: {
            score: {
              $add: [
                { $multiply: ['$likeCount', 2] },
                { $multiply: ['$averageRating', 3] },
                '$commentCount'
              ]
            }
          }
        },
        { $sort: { score: -1 } },
        { $limit: parseInt(limit) },
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
              avatar: '$author.avatar'
            }
          }
        }
      ])
      .toArray();

    res.json({ recipes });
  } catch (error) {
    throw error;
  }
});

// Get user's saved recipes
router.get('/saved', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const { page = 1, limit = 10 } = req.query;

    const savedRecipes = await db.collection('saved_recipes')
      .aggregate([
        { $match: { userId } },
        { $sort: { savedAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'recipes',
            localField: 'recipeId',
            foreignField: '_id',
            as: 'recipe'
          }
        },
        { $unwind: '$recipe' },
        {
          $lookup: {
            from: 'users',
            localField: 'recipe.userId',
            foreignField: '_id',
            as: 'author'
          }
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
              avatar: '$author.avatar'
            }
          }
        }
      ])
      .toArray();

    const total = await db.collection('saved_recipes').countDocuments({ userId });

    res.json({
      recipes: savedRecipes,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    throw error;
  }
});

// Save/unsave recipe
router.post('/:id/save', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const recipeId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user.id);

    const existingSave = await db.collection('saved_recipes').findOne({
      userId,
      recipeId
    });

    if (existingSave) {
      await db.collection('saved_recipes').deleteOne({ _id: existingSave._id });
      res.json({ saved: false });
    } else {
      await db.collection('saved_recipes').insertOne({
        userId,
        recipeId,
        savedAt: new Date()
      });
      res.json({ saved: true });
    }
  } catch (error) {
    throw error;
  }
});

// Rate recipe
router.post('/:id/rate', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const recipeId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user.id);
    const { rating } = z.object({ rating: z.number().min(1).max(5) }).parse(req.body);

    const recipe = await db.collection('recipes').findOne({ _id: recipeId });
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const existingRating = await db.collection('ratings').findOne({
      userId,
      recipeId
    });

    if (existingRating) {
      // Update existing rating
      await db.collection('ratings').updateOne(
        { _id: existingRating._id },
        { 
          $set: { 
            rating,
            updatedAt: new Date()
          } 
        }
      );
    } else {
      // Create new rating
      await db.collection('ratings').insertOne({
        userId,
        recipeId,
        rating,
        createdAt: new Date()
      });

      // Create notification for recipe owner
      if (recipe.userId.toString() !== userId.toString()) {
        await db.collection('notifications').insertOne({
          userId: recipe.userId,
          type: 'RECIPE_RATED',
          actorId: userId,
          recipeId,
          rating,
          read: false,
          createdAt: new Date()
        });
      }
    }

    // Update recipe average rating
    const ratings = await db.collection('ratings')
      .find({ recipeId })
      .toArray();

    const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

    await db.collection('recipes').updateOne(
      { _id: recipeId },
      {
        $set: {
          averageRating,
          ratingCount: ratings.length
        }
      }
    );

    res.json({
      rating,
      averageRating,
      totalRatings: ratings.length
    });
  } catch (error) {
    throw error;
  }
});

// Get similar recipes
router.get('/:id/similar', async (req, res) => {
  try {
    const db = getDb();
    const recipeId = new ObjectId(req.params.id);
    const { limit = 3 } = req.query;

    const recipe = await db.collection('recipes').findOne({ _id: recipeId });
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const similarRecipes = await db.collection('recipes')
      .aggregate([
        {
          $match: {
            _id: { $ne: recipeId },
            isPrivate: { $ne: true },
            $or: [
              { cuisine: recipe.cuisine },
              { tags: { $in: recipe.tags || [] } }
            ]
          }
        },
        {
          $addFields: {
            commonTags: {
              $size: {
                $setIntersection: ['$tags', recipe.tags || []]
              }
            }
          }
        },
        { $sort: { commonTags: -1, averageRating: -1 } },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'author'
          }
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
              avatar: '$author.avatar'
            }
          }
        }
      ])
      .toArray();

    res.json({ recipes: similarRecipes });
  } catch (error) {
    throw error;
  }
});

// Get recipe recommendations
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const { limit = 5 } = req.query;

    // Get user's preferences and history
    const [userPreferences, likedRecipes] = await Promise.all([
      db.collection('users').findOne(
        { _id: userId },
        { projection: { preferences: 1 } }
      ),
      db.collection('likes')
        .find({ userId })
        .toArray()
    ]);

    // Build recommendation query based on preferences and liked recipes
    const likedRecipeIds = likedRecipes.map(like => like.recipeId);
    const query = {
      _id: { $nin: likedRecipeIds },
      isPrivate: { $ne: true }
    };

    if (userPreferences?.preferences?.cuisine?.length) {
      query.cuisine = { $in: userPreferences.preferences.cuisine };
    }

    const recommendations = await db.collection('recipes')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'author'
          }
        },
        { $unwind: '$author' },
        { $sample: { size: parseInt(limit) } },
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
              avatar: '$author.avatar'
            }
          }
        }
      ])
      .toArray();

    res.json({ recipes: recommendations });
  } catch (error) {
    throw error;
  }
});

// Get recipe collections
router.get('/collections', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const { page = 1, limit = 10 } = req.query;

    const collections = await db.collection('recipe_collections')
      .aggregate([
        { $match: { userId } },
        { $sort: { updatedAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'recipes',
            localField: 'recipeIds',
            foreignField: '_id',
            as: 'recipes'
          }
        },
        {
          $project: {
            name: 1,
            description: 1,
            isPrivate: 1,
            createdAt: 1,
            updatedAt: 1,
            recipeCount: { $size: '$recipeIds' },
            previewRecipes: { $slice: ['$recipes', 3] }
          }
        }
      ])
      .toArray();

    const total = await db.collection('recipe_collections').countDocuments({ userId });

    res.json({
      collections,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    throw error;
  }
});

// Create recipe collection
router.post('/collections', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const { name, description, isPrivate = false } = z.object({
      name: z.string().min(1).max(50),
      description: z.string().max(500).optional(),
      isPrivate: z.boolean().optional()
    }).parse(req.body);

    const collection = {
      userId,
      name,
      description,
      isPrivate,
      recipeIds: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('recipe_collections').insertOne(collection);

    res.status(201).json({
      _id: result.insertedId,
      ...collection
    });
  } catch (error) {
    throw error;
  }
});

// Add recipe to collection
router.post('/collections/:collectionId/recipes/:recipeId', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const collectionId = new ObjectId(req.params.collectionId);
    const recipeId = new ObjectId(req.params.recipeId);

    const collection = await db.collection('recipe_collections').findOne({
      _id: collectionId,
      userId
    });

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    if (collection.recipeIds.some(id => id.equals(recipeId))) {
      return res.status(400).json({ message: 'Recipe already in collection' });
    }

    await db.collection('recipe_collections').updateOne(
      { _id: collectionId },
      {
        $push: { recipeIds: recipeId },
        $set: { updatedAt: new Date() }
      }
    );

    res.json({ message: 'Recipe added to collection' });
  } catch (error) {
    throw error;
  }
});

// Remove recipe from collection
router.delete('/collections/:collectionId/recipes/:recipeId', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const collectionId = new ObjectId(req.params.collectionId);
    const recipeId = new ObjectId(req.params.recipeId);

    const result = await db.collection('recipe_collections').updateOne(
      { _id: collectionId, userId },
      {
        $pull: { recipeIds: recipeId },
        $set: { updatedAt: new Date() }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    res.json({ message: 'Recipe removed from collection' });
  } catch (error) {
    throw error;
  }
});

// Delete collection
router.delete('/collections/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const collectionId = new ObjectId(req.params.id);

    const result = await db.collection('recipe_collections').deleteOne({
      _id: collectionId,
      userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    res.json({ message: 'Collection deleted successfully' });
  } catch (error) {
    throw error;
  }
});

export default router;
