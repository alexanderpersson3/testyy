import { Router } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
const { authenticateToken } = require('../middleware/auth');
import rateLimiter from '../middleware/rate-limit.js';

const router = Router();

// Validation schemas
const collectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPrivate: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
  coverImageUrl: z.string().url().optional()
});

const recipeReferenceSchema = z.object({
  recipeId: z.string(),
  notes: z.string().max(500).optional(),
  order: z.number().int().nonnegative().optional()
});

// Create collection
router.post('/collections', authenticateToken, rateLimiter.medium(), async (req, res) => {
  try {
    const db = getDb();
    const validatedData = collectionSchema.parse(req.body);

    const collection = {
      ...validatedData,
      userId: new ObjectId(req.user.id),
      recipes: [],
      recipeCount: 0,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('recipe_collections').insertOne(collection);
    
    const createdCollection = await db.collection('recipe_collections').findOne({
      _id: result.insertedId
    });

    res.status(201).json(createdCollection);
  } catch (error) {
    throw error;
  }
});

// Get user's collections
router.get('/collections', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 10, status } = req.query;

    const query = {
      userId: new ObjectId(req.user.id)
    };
    if (status) query.status = status;

    const collections = await db.collection('recipe_collections')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'recipes',
            localField: 'recipes.recipeId',
            foreignField: '_id',
            as: 'recipeDetails'
          }
        },
        { $sort: { updatedAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) }
      ])
      .toArray();

    const total = await db.collection('recipe_collections').countDocuments(query);

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

// Get specific collection
router.get('/collections/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const collectionId = new ObjectId(req.params.id);

    const collection = await db.collection('recipe_collections')
      .aggregate([
        {
          $match: {
            _id: collectionId,
            $or: [
              { userId: new ObjectId(req.user.id) },
              { isPrivate: false }
            ]
          }
        },
        {
          $lookup: {
            from: 'recipes',
            localField: 'recipes.recipeId',
            foreignField: '_id',
            as: 'recipeDetails'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'creator'
          }
        },
        { $unwind: '$creator' }
      ])
      .next();

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    res.json(collection);
  } catch (error) {
    throw error;
  }
});

// Add recipe to collection
router.post('/collections/:id/recipes', authenticateToken, rateLimiter.medium(), async (req, res) => {
  try {
    const db = getDb();
    const collectionId = new ObjectId(req.params.id);
    const recipeRef = recipeReferenceSchema.parse(req.body);

    // Verify recipe exists
    const recipe = await db.collection('recipes').findOne({
      _id: new ObjectId(recipeRef.recipeId)
    });

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const processedRef = {
      ...recipeRef,
      recipeId: new ObjectId(recipeRef.recipeId),
      addedAt: new Date()
    };

    const result = await db.collection('recipe_collections').findOneAndUpdate(
      {
        _id: collectionId,
        userId: new ObjectId(req.user.id),
        'recipes.recipeId': { $ne: processedRef.recipeId }
      },
      {
        $push: { recipes: processedRef },
        $inc: { recipeCount: 1 },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ 
        message: 'Collection not found or recipe already in collection' 
      });
    }

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

// Remove recipe from collection
router.delete('/collections/:id/recipes/:recipeId', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const collectionId = new ObjectId(req.params.id);
    const recipeId = new ObjectId(req.params.recipeId);

    const result = await db.collection('recipe_collections').findOneAndUpdate(
      {
        _id: collectionId,
        userId: new ObjectId(req.user.id)
      },
      {
        $pull: { recipes: { recipeId } },
        $inc: { recipeCount: -1 },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Collection or recipe not found' });
    }

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

// Update recipe order in collection
router.patch('/collections/:id/order', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const collectionId = new ObjectId(req.params.id);
    const updates = z.array(z.object({
      recipeId: z.string(),
      order: z.number().int().nonnegative()
    })).parse(req.body);

    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: {
          _id: collectionId,
          userId: new ObjectId(req.user.id),
          'recipes.recipeId': new ObjectId(update.recipeId)
        },
        update: {
          $set: {
            'recipes.$.order': update.order,
            updatedAt: new Date()
          }
        }
      }
    }));

    await db.collection('recipe_collections').bulkWrite(bulkOps);

    const updatedCollection = await db.collection('recipe_collections')
      .findOne({ _id: collectionId });

    res.json(updatedCollection);
  } catch (error) {
    throw error;
  }
});

// Update collection
router.patch('/collections/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const collectionId = new ObjectId(req.params.id);
    const updates = collectionSchema.partial().parse(req.body);

    const result = await db.collection('recipe_collections').findOneAndUpdate(
      {
        _id: collectionId,
        userId: new ObjectId(req.user.id)
      },
      {
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

// Delete collection
router.delete('/collections/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const collectionId = new ObjectId(req.params.id);

    const result = await db.collection('recipe_collections').findOneAndUpdate(
      {
        _id: collectionId,
        userId: new ObjectId(req.user.id)
      },
      {
        $set: {
          status: 'DELETED',
          updatedAt: new Date()
        }
      }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    res.json({ message: 'Collection deleted successfully' });
  } catch (error) {
    throw error;
  }
});

// Get user's favorite recipes
router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 10 } = req.query;

    const favorites = await db.collection('recipes')
      .aggregate([
        {
          $match: {
            'likes': new ObjectId(req.user.id)
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'creator'
          }
        },
        { $unwind: '$creator' },
        { $sort: { createdAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) }
      ])
      .toArray();

    const total = await db.collection('recipes').countDocuments({
      'likes': new ObjectId(req.user.id)
    });

    res.json({
      favorites,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    throw error;
  }
});

// Get recently viewed recipes
router.get('/recent', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { limit = 10 } = req.query;

    const recentViews = await db.collection('recipe_views')
      .aggregate([
        {
          $match: {
            userId: new ObjectId(req.user.id)
          }
        },
        {
          $sort: { viewedAt: -1 }
        },
        {
          $group: {
            _id: '$recipeId',
            lastViewed: { $first: '$viewedAt' }
          }
        },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'recipes',
            localField: '_id',
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
            as: 'creator'
          }
        },
        { $unwind: '$creator' }
      ])
      .toArray();

    res.json(recentViews);
  } catch (error) {
    throw error;
  }
});

// Record recipe view
router.post('/recent/:recipeId', authenticateToken, rateLimiter.high(), async (req, res) => {
  try {
    const db = getDb();
    const recipeId = new ObjectId(req.params.recipeId);

    await db.collection('recipe_views').insertOne({
      userId: new ObjectId(req.user.id),
      recipeId,
      viewedAt: new Date()
    });

    res.status(201).json({ message: 'View recorded successfully' });
  } catch (error) {
    throw error;
  }
});

export default router; 