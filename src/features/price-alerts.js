import { Router } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
const { authenticateToken } = require('../middleware/auth');

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get user's price alerts
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const { page = 1, limit = 20, status } = req.query;

    const query = { userId };
    if (status) query.status = status;

    const alerts = await db
      .collection('price_alerts')
      .aggregate([
        { $match: query },
        { $sort: { createdAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'ingredients',
            localField: 'ingredientId',
            foreignField: '_id',
            as: 'ingredient',
          },
        },
        { $unwind: '$ingredient' },
        {
          $lookup: {
            from: 'prices',
            let: { ingredientId: '$ingredientId' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$ingredientId', '$$ingredientId'] },
                },
              },
              { $sort: { timestamp: -1 } },
              { $limit: 1 },
            ],
            as: 'currentPrice',
          },
        },
        { $unwind: { path: '$currentPrice', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            ingredientId: 1,
            targetPrice: 1,
            status: 1,
            createdAt: 1,
            triggeredAt: 1,
            ingredient: {
              _id: '$ingredient._id',
              name: '$ingredient.name',
              image: '$ingredient.image',
              unit: '$ingredient.unit',
            },
            currentPrice: {
              amount: '$currentPrice.amount',
              store: '$currentPrice.store',
              timestamp: '$currentPrice.timestamp',
            },
          },
        },
      ])
      .toArray();

    const total = await db.collection('price_alerts').countDocuments(query);

    res.json({
      alerts,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Create price alert
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const { ingredientId, targetPrice } = z
      .object({
        ingredientId: z.string(),
        targetPrice: z.number().positive(),
      })
      .parse(req.body);

    // Check if ingredient exists
    const ingredient = await db.collection('ingredients').findOne({
      _id: new ObjectId(ingredientId),
    });

    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }

    // Check if alert already exists
    const existingAlert = await db.collection('price_alerts').findOne({
      userId,
      ingredientId: new ObjectId(ingredientId),
    });

    if (existingAlert) {
      return res.status(400).json({ message: 'Price alert already exists for this ingredient' });
    }

    // Get current price
    const currentPrice = await db
      .collection('prices')
      .findOne({ ingredientId: new ObjectId(ingredientId) }, { sort: { timestamp: -1 } });

    const alert = {
      userId,
      ingredientId: new ObjectId(ingredientId),
      targetPrice,
      status: currentPrice && currentPrice.amount <= targetPrice ? 'TRIGGERED' : 'ACTIVE',
      createdAt: new Date(),
      triggeredAt: currentPrice && currentPrice.amount <= targetPrice ? new Date() : null,
    };

    const result = await db.collection('price_alerts').insertOne(alert);

    res.status(201).json({
      _id: result.insertedId,
      ...alert,
      ingredient: {
        _id: ingredient._id,
        name: ingredient.name,
        image: ingredient.image,
        unit: ingredient.unit,
      },
      currentPrice: currentPrice
        ? {
            amount: currentPrice.amount,
            store: currentPrice.store,
            timestamp: currentPrice.timestamp,
          }
        : null,
    });
  } catch (error) {
    throw error;
  }
});

// Update price alert
router.put('/:id', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const alertId = new ObjectId(req.params.id);
    const { targetPrice } = z
      .object({
        targetPrice: z.number().positive(),
      })
      .parse(req.body);

    const alert = await db.collection('price_alerts').findOne({
      _id: alertId,
      userId,
    });

    if (!alert) {
      return res.status(404).json({ message: 'Price alert not found' });
    }

    // Get current price
    const currentPrice = await db
      .collection('prices')
      .findOne({ ingredientId: alert.ingredientId }, { sort: { timestamp: -1 } });

    const updateResult = await db.collection('price_alerts').findOneAndUpdate(
      { _id: alertId, userId },
      {
        $set: {
          targetPrice,
          status: currentPrice && currentPrice.amount <= targetPrice ? 'TRIGGERED' : 'ACTIVE',
          triggeredAt: currentPrice && currentPrice.amount <= targetPrice ? new Date() : null,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!updateResult.value) {
      return res.status(404).json({ message: 'Price alert not found' });
    }

    res.json(updateResult.value);
  } catch (error) {
    throw error;
  }
});

// Delete price alert
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const alertId = new ObjectId(req.params.id);

    const result = await db.collection('price_alerts').deleteOne({
      _id: alertId,
      userId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Price alert not found' });
    }

    res.json({ message: 'Price alert deleted successfully' });
  } catch (error) {
    throw error;
  }
});

// Get price history for ingredient
router.get('/:ingredientId/history', async (req, res) => {
  try {
    const db = getDb();
    const ingredientId = new ObjectId(req.params.ingredientId);
    const { days = 30, store } = req.query;

    const query = {
      ingredientId,
      timestamp: {
        $gte: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000),
      },
    };

    if (store) query.store = store;

    const prices = await db.collection('prices').find(query).sort({ timestamp: 1 }).toArray();

    // Calculate statistics
    const stats =
      prices.length > 0
        ? {
            min: Math.min(...prices.map(p => p.amount)),
            max: Math.max(...prices.map(p => p.amount)),
            avg: prices.reduce((sum, p) => sum + p.amount, 0) / prices.length,
            trend:
              prices.length > 1
                ? (prices[prices.length - 1].amount - prices[0].amount) / prices[0].amount
                : 0,
          }
        : null;

    res.json({
      prices,
      stats,
      stores: [...new Set(prices.map(p => p.store))],
    });
  } catch (error) {
    throw error;
  }
});

// Get price comparison across stores
router.get('/:ingredientId/compare', async (req, res) => {
  try {
    const db = getDb();
    const ingredientId = new ObjectId(req.params.ingredientId);

    const prices = await db
      .collection('prices')
      .aggregate([
        {
          $match: {
            ingredientId,
            timestamp: {
              $gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
        },
        {
          $sort: { timestamp: -1 },
        },
        {
          $group: {
            _id: '$store',
            currentPrice: { $first: '$amount' },
            priceHistory: { $push: { amount: '$amount', timestamp: '$timestamp' } },
            url: { $first: '$url' },
          },
        },
        {
          $project: {
            store: '$_id',
            currentPrice: 1,
            priceHistory: { $slice: ['$priceHistory', 5] },
            url: 1,
          },
        },
        {
          $sort: { currentPrice: 1 },
        },
      ])
      .toArray();

    res.json({ prices });
  } catch (error) {
    throw error;
  }
});

export default router;
