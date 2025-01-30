import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import * as ingredientService from '../services/ingredient-service.js';
import ingredientManager from '../services/ingredient-manager.js';
import rateLimiter from '../middleware/rate-limit.js';
import { getDb } from '../db';
import { ObjectId } from 'mongodb';
import elasticClient from '../services/elastic-client';

const router = express.Router();

const searchSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  storeId: z.string().optional(),
  nutritionFilters: z.record(z.object({
    min: z.number().optional(),
    max: z.number().optional()
  })).optional(),
  priceRange: z.object({
    min: z.number(),
    max: z.number()
  }).optional(),
  inStock: z.boolean().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional()
});

const priceHistorySchema = z.object({
  days: z.number().int().positive().max(365).optional(),
  storeId: z.string().optional()
});

const ingredientSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  category: z.string().min(2).max(50),
  alternateNames: z.array(z.string()).optional(),
  nutritionalInfo: z.object({
    calories: z.number().optional(),
    protein: z.number().optional(),
    carbs: z.number().optional(),
    fat: z.number().optional(),
    fiber: z.number().optional(),
    vitamins: z.array(z.string()).optional(),
    minerals: z.array(z.string()).optional()
  }).optional(),
  seasonality: z.array(z.number().min(1).max(12)).optional(),
  storageInfo: z.string().max(500).optional(),
  substitutes: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  unit: z.string(),
  conversionRates: z.record(z.number()).optional()
});

router.get('/search',
  rateLimiter.search(),
  validateRequest({ query: searchSchema }),
  async (req, res) => {
    try {
      const result = await ingredientManager.searchIngredients(req.query);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error searching ingredients:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search ingredients'
      });
    }
  }
);

router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await ingredientService.getIngredientCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error getting ingredient categories:', error);
    res.status(500).json({ error: 'Failed to get ingredient categories' });
  }
});

router.get('/:ingredientId', authenticateToken, async (req, res) => {
  try {
    const ingredient = await ingredientService.getIngredientDetails(req.params.ingredientId);
    if (!ingredient) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    res.json(ingredient);
  } catch (error) {
    console.error('Error getting ingredient details:', error);
    res.status(500).json({ error: 'Failed to get ingredient details' });
  }
});

router.post('/sync', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await ingredientService.syncScrapedIngredients(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error syncing ingredients:', error);
    res.status(500).json({ error: 'Failed to sync ingredients' });
  }
});

router.get('/:ingredientId/price-history',
  rateLimiter.api(),
  validateRequest({ query: priceHistorySchema }),
  async (req, res) => {
    try {
      const priceHistory = await ingredientManager.getPriceHistory(
        req.params.ingredientId,
        req.query
      );
      res.json({
        success: true,
        data: priceHistory
      });
    } catch (error) {
      console.error('Error getting price history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get price history'
      });
    }
  }
);

router.get('/:ingredientId/substitutes',
  rateLimiter.api(),
  async (req, res) => {
    try {
      const substitutes = await ingredientManager.getSubstitutes(req.params.ingredientId);
      res.json({
        success: true,
        data: substitutes
      });
    } catch (error) {
      console.error('Error getting substitutes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get substitutes'
      });
    }
  }
);

router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const {
      page = 1,
      limit = 20,
      category,
      season,
      search,
      sort = 'name'
    } = req.query;

    const query = {};
    if (category) query.category = category;
    if (season) query.seasonality = parseInt(season);
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    let sortQuery = { name: 1 };
    if (sort === 'popularity') sortQuery = { popularity: -1 };
    if (sort === 'price') sortQuery = { 'currentPrice.amount': 1 };

    const ingredients = await db.collection('ingredients')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'prices',
            let: { ingredientId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$ingredientId', '$$ingredientId'] }
                }
              },
              { $sort: { timestamp: -1 } },
              { $limit: 1 }
            ],
            as: 'currentPrice'
          }
        },
        { $unwind: { path: '$currentPrice', preserveNullAndEmptyArrays: true } },
        { $sort: sortQuery },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) }
      ])
      .toArray();

    const total = await db.collection('ingredients').countDocuments(query);
    const categories = await db.collection('ingredients').distinct('category');

    res.json({
      ingredients,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      categories
    });
  } catch (error) {
    throw error;
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const ingredientId = new ObjectId(req.params.id);

    const ingredient = await db.collection('ingredients').aggregate([
      { $match: { _id: ingredientId } },
      {
        $lookup: {
          from: 'prices',
          let: { ingredientId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$ingredientId', '$$ingredientId'] }
              }
            },
            { $sort: { timestamp: -1 } },
            { $limit: 1 }
          ],
          as: 'currentPrice'
        }
      },
      { $unwind: { path: '$currentPrice', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'recipes',
          localField: '_id',
          foreignField: 'ingredients.ingredientId',
          as: 'recipes'
        }
      }
    ]).next();

    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }

    // Get price history
    const priceHistory = await db.collection('prices')
      .find({ ingredientId })
      .sort({ timestamp: -1 })
      .limit(30)
      .toArray();

    // Get popular recipes using this ingredient
    const popularRecipes = await db.collection('recipes')
      .aggregate([
        {
          $match: {
            'ingredients.ingredientId': ingredientId,
            isPrivate: { $ne: true }
          }
        },
        { $sort: { popularity: -1 } },
        { $limit: 5 },
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
            image: 1,
            averageRating: 1,
            author: {
              _id: '$author._id',
              username: '$author.username',
              displayName: '$author.displayName'
            }
          }
        }
      ])
      .toArray();

    res.json({
      ...ingredient,
      priceHistory,
      popularRecipes
    });
  } catch (error) {
    throw error;
  }
});

router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDb();
    const validatedData = ingredientSchema.parse(req.body);

    // Check for duplicate name
    const existingIngredient = await db.collection('ingredients')
      .findOne({ name: validatedData.name });

    if (existingIngredient) {
      return res.status(400).json({ message: 'Ingredient with this name already exists' });
    }

    const ingredient = {
      ...validatedData,
      popularity: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('ingredients').insertOne(ingredient);

    // Index in Elasticsearch
    await elasticClient.index({
      index: 'ingredients',
      id: result.insertedId.toString(),
      body: {
        ...ingredient,
        _id: result.insertedId.toString()
      }
    });

    res.status(201).json({
      _id: result.insertedId,
      ...ingredient
    });
  } catch (error) {
    throw error;
  }
});

router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDb();
    const ingredientId = new ObjectId(req.params.id);
    const validatedData = ingredientSchema.parse(req.body);

    // Check for duplicate name
    const existingIngredient = await db.collection('ingredients')
      .findOne({
        name: validatedData.name,
        _id: { $ne: ingredientId }
      });

    if (existingIngredient) {
      return res.status(400).json({ message: 'Ingredient with this name already exists' });
    }

    const updateResult = await db.collection('ingredients').findOneAndUpdate(
      { _id: ingredientId },
      {
        $set: {
          ...validatedData,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!updateResult.value) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }

    // Update in Elasticsearch
    await elasticClient.update({
      index: 'ingredients',
      id: ingredientId.toString(),
      body: {
        doc: {
          ...validatedData,
          updatedAt: new Date()
        }
      }
    });

    res.json(updateResult.value);
  } catch (error) {
    throw error;
  }
});

router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDb();
    const ingredientId = new ObjectId(req.params.id);

    // Check if ingredient is used in any recipes
    const usedInRecipe = await db.collection('recipes').findOne({
      'ingredients.ingredientId': ingredientId
    });

    if (usedInRecipe) {
      return res.status(400).json({
        message: 'Cannot delete ingredient that is used in recipes'
      });
    }

    const result = await db.collection('ingredients').deleteOne({
      _id: ingredientId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }

    // Delete from Elasticsearch
    await elasticClient.delete({
      index: 'ingredients',
      id: ingredientId.toString()
    });

    // Delete related data
    await Promise.all([
      db.collection('prices').deleteMany({ ingredientId }),
      db.collection('price_alerts').deleteMany({ ingredientId })
    ]);

    res.json({ message: 'Ingredient deleted successfully' });
  } catch (error) {
    throw error;
  }
});

router.get('/:id/price-history', async (req, res) => {
  try {
    const db = getDb();
    const ingredientId = new ObjectId(req.params.id);
    const days = parseInt(req.query.days) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const priceHistory = await db.collection('price_history')
      .find({
        ingredientId,
        date: { $gte: startDate }
      })
      .sort({ date: 1 })
      .toArray();

    // Calculate statistics
    let stats = {
      min: Infinity,
      max: -Infinity,
      avg: 0,
      trend: 0
    };

    if (priceHistory.length > 0) {
      stats.min = Math.min(...priceHistory.map(p => p.price));
      stats.max = Math.max(...priceHistory.map(p => p.price));
      stats.avg = priceHistory.reduce((sum, p) => sum + p.price, 0) / priceHistory.length;
      
      if (priceHistory.length > 1) {
        const firstPrice = priceHistory[0].price;
        const lastPrice = priceHistory[priceHistory.length - 1].price;
        stats.trend = ((lastPrice - firstPrice) / firstPrice) * 100;
      }
    }

    res.json({
      priceHistory,
      stats
    });
  } catch (error) {
    throw error;
  }
});

router.get('/:id/substitutes', async (req, res) => {
  try {
    const db = getDb();
    const ingredientId = new ObjectId(req.params.id);

    const ingredient = await db.collection('ingredients').findOne(
      { _id: ingredientId },
      { projection: { substitutes: 1 } }
    );

    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }

    if (!ingredient.substitutes?.length) {
      return res.json({ substitutes: [] });
    }

    const substitutes = await db.collection('ingredients')
      .aggregate([
        {
          $match: {
            name: { $in: ingredient.substitutes }
          }
        },
        {
          $lookup: {
            from: 'prices',
            let: { ingredientId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$ingredientId', '$$ingredientId'] }
                }
              },
              { $sort: { timestamp: -1 } },
              { $limit: 1 }
            ],
            as: 'currentPrice'
          }
        },
        { $unwind: { path: '$currentPrice', preserveNullAndEmptyArrays: true } }
      ])
      .toArray();

    res.json({ substitutes });
  } catch (error) {
    throw error;
  }
});

router.post('/:id/prices', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDb();
    const ingredientId = new ObjectId(req.params.id);
    const prices = z.array(z.object({
      store: z.string(),
      amount: z.number().positive(),
      unit: z.string(),
      url: z.string().url().optional()
    })).parse(req.body);

    const timestamp = new Date();
    const priceRecords = prices.map(price => ({
      ingredientId,
      ...price,
      timestamp
    }));

    await db.collection('prices').insertMany(priceRecords);

    // Check price alerts
    const alerts = await db.collection('price_alerts')
      .find({
        ingredientId,
        targetPrice: { $gte: Math.min(...prices.map(p => p.amount)) }
      })
      .toArray();

    // Create notifications for triggered alerts
    if (alerts.length > 0) {
      const notifications = alerts.map(alert => ({
        userId: alert.userId,
        type: 'PRICE_ALERT',
        ingredientId,
        price: Math.min(...prices.map(p => p.amount)),
        read: false,
        createdAt: new Date()
      }));

      await db.collection('notifications').insertMany(notifications);

      // Add email jobs for price alerts
      await Promise.all(alerts.map(alert =>
        require('../services/job-queue').addJob('email', 'PRICE_ALERT', {
          userId: alert.userId,
          ingredientId,
          price: Math.min(...prices.map(p => p.amount)),
          targetPrice: alert.targetPrice
        })
      ));
    }

    res.json({ message: 'Prices updated successfully' });
  } catch (error) {
    throw error;
  }
});

router.get('/:id/prices', async (req, res) => {
  try {
    const db = getDb();
    const ingredientId = new ObjectId(req.params.id);
    const { days = 30, store } = req.query;

    const query = {
      ingredientId,
      timestamp: {
        $gte: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
      }
    };

    if (store) query.store = store;

    const prices = await db.collection('prices')
      .find(query)
      .sort({ timestamp: 1 })
      .toArray();

    // Calculate statistics
    const stats = {
      min: Math.min(...prices.map(p => p.amount)),
      max: Math.max(...prices.map(p => p.amount)),
      avg: prices.reduce((sum, p) => sum + p.amount, 0) / prices.length,
      trend: prices.length > 1
        ? (prices[prices.length - 1].amount - prices[0].amount) / prices[0].amount
        : 0
    };

    res.json({
      prices,
      stats,
      stores: [...new Set(prices.map(p => p.store))]
    });
  } catch (error) {
    throw error;
  }
});

router.post('/:id/alerts', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const ingredientId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user.id);
    const { targetPrice } = z.object({
      targetPrice: z.number().positive()
    }).parse(req.body);

    // Check if alert already exists
    const existingAlert = await db.collection('price_alerts').findOne({
      userId,
      ingredientId
    });

    if (existingAlert) {
      return res.status(400).json({ message: 'Price alert already exists for this ingredient' });
    }

    const alert = {
      userId,
      ingredientId,
      targetPrice,
      createdAt: new Date()
    };

    await db.collection('price_alerts').insertOne(alert);

    res.status(201).json({
      _id: alert._id,
      ...alert
    });
  } catch (error) {
    throw error;
  }
});

router.delete('/:id/alerts', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const ingredientId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user.id);

    const result = await db.collection('price_alerts').deleteOne({
      userId,
      ingredientId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Price alert not found' });
    }

    res.json({ message: 'Price alert deleted successfully' });
  } catch (error) {
    throw error;
  }
});

export default router; 