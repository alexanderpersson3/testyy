import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
import rateLimiter from '../middleware/rate-limit.js';
import storeDealAggregator from '../services/store-deals-aggregator.js';
import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { elasticClient } from '../services/elastic-client.js';

const router = Router();

// Validation schemas
const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
});

const dealFilterSchema = z.object({
  category: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  sortBy: z
    .enum(['discountDesc', 'priceAsc', 'priceDesc', 'popularityDesc'])
    .default('discountDesc'),
});

const locationSchema = z.object({
  address: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  country: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  coordinates: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
});

const storeSchema = z.object({
  name: z.string().min(1).max(100),
  chain: z.string().min(1).max(100),
  logo: z.string().url().optional(),
  website: z.string().url().optional(),
  locations: z.array(locationSchema),
  operatingHours: z.record(z.string(), z.string()).optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const dealSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  type: z.enum(['discount', 'bogo', 'bundle', 'clearance']),
  discount: z
    .object({
      type: z.enum(['percentage', 'fixed']),
      value: z.number().positive(),
    })
    .optional(),
  conditions: z.string().max(500).optional(),
  ingredientIds: z.array(z.string()).optional(),
  status: z.enum(['active', 'expired', 'cancelled']).default('active'),
});

const priceUpdateSchema = z.object({
  ingredientId: z.string(),
  price: z.number().positive(),
  unit: z.string(),
  date: z.string().datetime(),
  source: z.enum(['manual', 'scraper', 'api']),
  locationId: z.string().optional(),
});

// Get all stores
router.get('/', rateLimiter.api(), async (req, res) => {
  try {
    const stores = await storeDealAggregator.getStores();

    res.json({
      success: true,
      data: stores,
    });
  } catch (error) {
    console.error('Error getting stores:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stores',
    });
  }
});

// Get store deals
router.get(
  '/:storeId/deals',
  rateLimiter.api(),
  validateRequest({
    query: paginationSchema.merge(dealFilterSchema),
  }),
  async (req, res) => {
    try {
      const result = await storeDealAggregator.getStoreDeals(req.params.storeId, req.query);

      res.json({
        success: true,
        data: result.deals,
        pagination: {
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          totalItems: result.totalCount,
        },
      });
    } catch (error) {
      console.error('Error getting store deals:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get store deals',
      });
    }
  }
);

// Get top deals across all stores
router.get(
  '/deals/top',
  rateLimiter.api(),
  validateRequest({
    query: z.object({
      limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
      category: z.string().optional(),
    }),
  }),
  async (req, res) => {
    try {
      const deals = await storeDealAggregator.getTopDeals(req.query);

      res.json({
        success: true,
        data: deals,
      });
    } catch (error) {
      console.error('Error getting top deals:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get top deals',
      });
    }
  }
);

// Track deal view
router.post('/deals/:dealId/view', rateLimiter.api(), async (req, res) => {
  try {
    await storeDealAggregator.trackDealView(req.params.dealId);

    res.json({
      success: true,
      message: 'View tracked successfully',
    });
  } catch (error) {
    console.error('Error tracking deal view:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track view',
    });
  }
});

// Get all stores with filtering and search
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 10, search, city, status = 'active' } = req.query;

    const query = { status };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { chain: { $regex: search, $options: 'i' } },
      ];
    }
    if (city) {
      query['locations.city'] = { $regex: city, $options: 'i' };
    }

    const stores = await db
      .collection('stores')
      .find(query)
      .sort({ name: 1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection('stores').countDocuments(query);

    res.json({
      stores,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Get store by ID
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const storeId = new ObjectId(req.params.id);

    const store = await db
      .collection('stores')
      .aggregate([
        { $match: { _id: storeId } },
        {
          $lookup: {
            from: 'deals',
            let: { storeId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$storeId', '$$storeId'] },
                  status: 'active',
                  endDate: { $gt: new Date().toISOString() },
                },
              },
              { $limit: 10 },
            ],
            as: 'activeDeals',
          },
        },
      ])
      .next();

    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    res.json(store);
  } catch (error) {
    throw error;
  }
});

// Create store (admin only)
router.post('/', authenticateToken, requireAdmin, rateLimiter.medium(), async (req, res) => {
  try {
    const db = getDb();
    const validatedData = storeSchema.parse(req.body);

    // Check for duplicate store name and chain combination
    const existingStore = await db.collection('stores').findOne({
      name: validatedData.name,
      chain: validatedData.chain,
    });

    if (existingStore) {
      return res.status(400).json({ message: 'Store with this name and chain already exists' });
    }

    const store = {
      ...validatedData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('stores').insertOne(store);

    const createdStore = await db.collection('stores').findOne({
      _id: result.insertedId,
    });

    res.status(201).json(createdStore);
  } catch (error) {
    throw error;
  }
});

// Update store (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const storeId = new ObjectId(req.params.id);
    const validatedData = storeSchema.parse(req.body);

    // Check for duplicate store name and chain combination
    const existingStore = await db.collection('stores').findOne({
      _id: { $ne: storeId },
      name: validatedData.name,
      chain: validatedData.chain,
    });

    if (existingStore) {
      return res.status(400).json({ message: 'Store with this name and chain already exists' });
    }

    const result = await db.collection('stores').findOneAndUpdate(
      { _id: storeId },
      {
        $set: {
          ...validatedData,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Store not found' });
    }

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

// Get store deals
router.get('/:id/deals', async (req, res) => {
  try {
    const db = getDb();
    const storeId = new ObjectId(req.params.id);
    const { page = 1, limit = 10, status = 'active' } = req.query;

    const query = {
      storeId,
      status,
      ...(status === 'active' && { endDate: { $gt: new Date().toISOString() } }),
    };

    const deals = await db
      .collection('deals')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'ingredients',
            localField: 'ingredientIds',
            foreignField: '_id',
            as: 'ingredients',
          },
        },
        { $sort: { startDate: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
      ])
      .toArray();

    const total = await db.collection('deals').countDocuments(query);

    res.json({
      deals,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Create deal for store (admin only)
router.post(
  '/:id/deals',
  authenticateToken,
  requireAdmin,
  rateLimiter.medium(),
  async (req, res) => {
    try {
      const db = getDb();
      const storeId = new ObjectId(req.params.id);
      const validatedData = dealSchema.parse(req.body);

      // Verify store exists
      const store = await db.collection('stores').findOne({ _id: storeId });
      if (!store) {
        return res.status(404).json({ message: 'Store not found' });
      }

      // Convert ingredient IDs to ObjectIds
      const deal = {
        ...validatedData,
        storeId,
        ingredientIds: validatedData.ingredientIds?.map(id => new ObjectId(id)),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection('deals').insertOne(deal);

      // Create notifications for users with price alerts
      if (deal.ingredientIds?.length > 0) {
        const alerts = await db
          .collection('price_alerts')
          .find({
            ingredientId: { $in: deal.ingredientIds },
            status: 'active',
          })
          .toArray();

        if (alerts.length > 0) {
          const notifications = alerts.map(alert => ({
            userId: alert.userId,
            type: 'DEAL_ALERT',
            title: 'New Deal Available',
            message: `There's a new deal for ${validatedData.title} at ${store.name}`,
            data: {
              dealId: result.insertedId,
              storeId,
            },
            createdAt: new Date(),
          }));

          await db.collection('notifications').insertMany(notifications);
        }
      }

      const createdDeal = await db
        .collection('deals')
        .aggregate([
          { $match: { _id: result.insertedId } },
          {
            $lookup: {
              from: 'ingredients',
              localField: 'ingredientIds',
              foreignField: '_id',
              as: 'ingredients',
            },
          },
        ])
        .next();

      res.status(201).json(createdDeal);
    } catch (error) {
      throw error;
    }
  }
);

// Update ingredient prices
router.post(
  '/:id/prices',
  authenticateToken,
  requireAdmin,
  rateLimiter.medium(),
  async (req, res) => {
    try {
      const db = getDb();
      const storeId = new ObjectId(req.params.id);
      const updates = z.array(priceUpdateSchema).parse(req.body);

      // Verify store exists
      const store = await db.collection('stores').findOne({ _id: storeId });
      if (!store) {
        return res.status(404).json({ message: 'Store not found' });
      }

      const priceUpdates = updates.map(update => ({
        ...update,
        storeId,
        ingredientId: new ObjectId(update.ingredientId),
        ...(update.locationId && { locationId: new ObjectId(update.locationId) }),
        createdAt: new Date(),
      }));

      await db.collection('price_history').insertMany(priceUpdates);

      // Update current prices in ingredients collection
      const bulkOps = priceUpdates.map(update => ({
        updateOne: {
          filter: { _id: update.ingredientId },
          update: {
            $set: {
              [`currentPrices.${storeId}`]: {
                price: update.price,
                unit: update.unit,
                updatedAt: new Date(),
              },
            },
          },
        },
      }));

      await db.collection('ingredients').bulkWrite(bulkOps);

      // Check price alerts
      const alerts = await db
        .collection('price_alerts')
        .find({
          ingredientId: { $in: priceUpdates.map(u => u.ingredientId) },
          status: 'active',
        })
        .toArray();

      if (alerts.length > 0) {
        const notifications = [];
        for (const alert of alerts) {
          const update = priceUpdates.find(u => u.ingredientId.equals(alert.ingredientId));
          if (update && update.price <= alert.targetPrice) {
            notifications.push({
              userId: alert.userId,
              type: 'PRICE_ALERT',
              title: 'Price Drop Alert',
              message: `The price of ${update.name} has dropped to ${update.price} ${update.unit} at ${store.name}`,
              data: {
                ingredientId: update.ingredientId,
                storeId,
                price: update.price,
              },
              createdAt: new Date(),
            });
          }
        }

        if (notifications.length > 0) {
          await db.collection('notifications').insertMany(notifications);
        }
      }

      res.json({
        message: 'Price updates processed successfully',
        updatedCount: priceUpdates.length,
      });
    } catch (error) {
      throw error;
    }
  }
);

// Get price history for ingredient
router.get('/:id/prices/:ingredientId', async (req, res) => {
  try {
    const db = getDb();
    const storeId = new ObjectId(req.params.id);
    const ingredientId = new ObjectId(req.params.ingredientId);
    const { days = 30, locationId } = req.query;

    const query = {
      storeId,
      ingredientId,
      date: {
        $gte: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString(),
      },
    };

    if (locationId) {
      query.locationId = new ObjectId(locationId);
    }

    const history = await db.collection('price_history').find(query).sort({ date: 1 }).toArray();

    // Calculate statistics
    const prices = history.map(h => h.price);
    const stats = {
      current: prices[prices.length - 1] || null,
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
      trend: prices.length > 1 ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100 : 0,
    };

    res.json({
      history,
      stats,
    });
  } catch (error) {
    throw error;
  }
});

export default router;
