import { Router } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import rateLimiter from '../middleware/rate-limit.js';
import { elasticClient } from '../services/elastic-client.js';

const router = Router();

// Validation schemas
const scrapedPriceSchema = z.object({
  storeId: z.string(),
  ingredientId: z.string(),
  price: z.number().positive(),
  unit: z.string(),
  url: z.string().url(),
  timestamp: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
});

const scrapedDealSchema = z.object({
  storeId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  url: z.string().url(),
  type: z.enum(['DISCOUNT', 'BOGO', 'CLEARANCE', 'SPECIAL']),
  discount: z.object({
    type: z.enum(['PERCENTAGE', 'FIXED', 'CUSTOM']),
    value: z.number().optional(),
    description: z.string().optional(),
  }),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  terms: z.string().max(1000).optional(),
  ingredients: z
    .array(
      z.object({
        ingredientId: z.string(),
        originalPrice: z.number(),
        discountedPrice: z.number(),
      })
    )
    .optional(),
});

const scrapedStoreSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  location: z.object({
    address: z.string(),
    city: z.string(),
    state: z.string(),
    country: z.string(),
    postalCode: z.string(),
    coordinates: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .optional(),
  }),
});

const batchPriceUpdateSchema = z.object({
  storeId: z.string(),
  prices: z.array(
    z.object({
      ingredientId: z.string(),
      price: z.number().positive(),
      unit: z.string(),
      url: z.string().url(),
    })
  ),
  timestamp: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
});

// Submit scraped prices in batch
router.post('/prices/batch', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { storeId, prices, timestamp } = batchPriceUpdateSchema.parse(req.body);
    const storeObjectId = new ObjectId(storeId);

    // Process prices in chunks to avoid memory issues
    const chunkSize = 100;
    const priceUpdates = [];
    const notifications = [];

    for (let i = 0; i < prices.length; i += chunkSize) {
      const chunk = prices.slice(i, i + chunkSize);

      // Get previous prices for comparison
      const ingredientIds = chunk.map(p => new ObjectId(p.ingredientId));
      const previousPrices = await db
        .collection('price_history')
        .find({
          storeId: storeObjectId,
          ingredientId: { $in: ingredientIds },
          isVerified: true,
        })
        .sort({ date: -1 })
        .toArray();

      const previousPriceMap = previousPrices.reduce((acc, p) => {
        acc[p.ingredientId.toString()] = p;
        return acc;
      }, {});

      // Create price updates and check for alerts
      for (const price of chunk) {
        const priceUpdate = {
          storeId: storeObjectId,
          ingredientId: new ObjectId(price.ingredientId),
          price: price.price,
          unit: price.unit,
          date: new Date(timestamp),
          source: 'SCRAPER',
          isVerified: true,
          url: price.url,
          createdAt: new Date(),
        };

        priceUpdates.push(priceUpdate);

        const previousPrice = previousPriceMap[price.ingredientId];
        if (!previousPrice || price.price < previousPrice.price) {
          // Find relevant price alerts
          const alerts = await db
            .collection('price_alerts')
            .find({
              ingredientId: priceUpdate.ingredientId,
              targetPrice: { $gte: price.price },
            })
            .toArray();

          notifications.push(
            ...alerts.map(alert => ({
              userId: alert.userId,
              type: 'PRICE_ALERT',
              title: 'Price Drop Alert',
              message: `Price dropped for an ingredient you're tracking!`,
              data: {
                ingredientId: alert.ingredientId,
                storeId: storeObjectId,
                oldPrice: previousPrice?.price,
                newPrice: price.price,
                url: price.url,
              },
              createdAt: new Date(),
            }))
          );
        }
      }
    }

    // Insert price updates
    if (priceUpdates.length > 0) {
      await db.collection('price_history').insertMany(priceUpdates);

      // Update current prices in ingredients collection
      const bulkOps = priceUpdates.map(update => ({
        updateOne: {
          filter: { _id: update.ingredientId },
          update: {
            $set: {
              [`prices.${update.storeId}`]: {
                price: update.price,
                unit: update.unit,
                updatedAt: update.date,
              },
            },
          },
        },
      }));

      await db.collection('ingredients').bulkWrite(bulkOps);
    }

    // Send notifications
    if (notifications.length > 0) {
      await db.collection('notifications').insertMany(notifications);
    }

    res.status(201).json({
      message: 'Batch price update processed successfully',
      processed: priceUpdates.length,
      notifications: notifications.length,
    });
  } catch (error) {
    throw error;
  }
});

// Submit scraped deals
router.post('/deals', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const deals = z.array(scrapedDealSchema).parse(req.body);

    const processedDeals = deals.map(deal => ({
      ...deal,
      storeId: new ObjectId(deal.storeId),
      ingredients: deal.ingredients?.map(i => ({
        ...i,
        ingredientId: new ObjectId(i.ingredientId),
      })),
      source: 'SCRAPER',
      isVerified: false,
      createdAt: new Date(),
    }));

    const result = await db.collection('deals').insertMany(processedDeals);

    // Process price alerts for deals with ingredients
    const notifications = [];
    for (const deal of processedDeals) {
      if (deal.ingredients?.length > 0) {
        const priceAlerts = await db
          .collection('price_alerts')
          .find({
            ingredientId: { $in: deal.ingredients.map(i => i.ingredientId) },
            targetPrice: {
              $gte: deal.ingredients.map(i => i.discountedPrice).reduce((a, b) => Math.min(a, b)),
            },
          })
          .toArray();

        notifications.push(
          ...priceAlerts.map(alert => ({
            userId: alert.userId,
            type: 'PRICE_ALERT',
            title: 'New Deal Alert',
            message: `There's a new deal for an ingredient you're tracking!`,
            data: {
              dealId: result.insertedIds[deals.indexOf(deal)],
              storeId: deal.storeId,
              ingredientId: alert.ingredientId,
              url: deal.url,
            },
            createdAt: new Date(),
          }))
        );
      }
    }

    if (notifications.length > 0) {
      await db.collection('notifications').insertMany(notifications);
    }

    res.status(201).json({
      message: 'Deals processed successfully',
      insertedCount: result.insertedCount,
      notifications: notifications.length,
    });
  } catch (error) {
    throw error;
  }
});

// Submit new store location
router.post('/stores', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const storeData = scrapedStoreSchema.parse(req.body);

    // Check if store exists with similar name and location
    const existingStore = await db.collection('stores').findOne({
      name: { $regex: new RegExp(storeData.name, 'i') },
      'locations.city': storeData.location.city,
      'locations.state': storeData.location.state,
    });

    if (existingStore) {
      // Update existing store with new location if not already present
      const locationExists = existingStore.locations.some(
        loc =>
          loc.address === storeData.location.address &&
          loc.city === storeData.location.city &&
          loc.state === storeData.location.state
      );

      if (!locationExists) {
        await db.collection('stores').updateOne(
          { _id: existingStore._id },
          {
            $push: { locations: storeData.location },
            $set: { updatedAt: new Date() },
          }
        );

        return res.json({
          message: 'Store location added to existing store',
          storeId: existingStore._id,
        });
      }

      return res.json({
        message: 'Store location already exists',
        storeId: existingStore._id,
      });
    }

    // Create new store
    const store = {
      name: storeData.name,
      url: storeData.url,
      locations: [storeData.location],
      isActive: true,
      source: 'SCRAPER',
      createdAt: new Date(),
    };

    const result = await db.collection('stores').insertOne(store);

    // Index store in Elasticsearch
    await elasticClient.index({
      index: 'stores',
      id: result.insertedId.toString(),
      document: {
        ...store,
        _id: result.insertedId.toString(),
      },
    });

    res.status(201).json({
      message: 'New store created successfully',
      storeId: result.insertedId,
    });
  } catch (error) {
    throw error;
  }
});

// Get scraping status
router.get('/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { days = 1 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const [priceUpdates, deals, errors] = await Promise.all([
      db.collection('price_history').countDocuments({
        source: 'SCRAPER',
        createdAt: { $gte: startDate },
      }),
      db.collection('deals').countDocuments({
        source: 'SCRAPER',
        createdAt: { $gte: startDate },
      }),
      db
        .collection('scraper_errors')
        .find({ createdAt: { $gte: startDate } })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray(),
    ]);

    res.json({
      period: `${days} days`,
      stats: {
        priceUpdates,
        deals,
        errors: errors.length,
      },
      recentErrors: errors,
    });
  } catch (error) {
    throw error;
  }
});

// Log scraper error
router.post('/errors', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const error = z
      .object({
        storeId: z.string(),
        url: z.string().url(),
        type: z.enum(['PRICE', 'DEAL', 'STORE']),
        message: z.string(),
        stack: z.string().optional(),
      })
      .parse(req.body);

    const errorDoc = {
      ...error,
      storeId: new ObjectId(error.storeId),
      createdAt: new Date(),
    };

    await db.collection('scraper_errors').insertOne(errorDoc);

    res.status(201).json({
      message: 'Error logged successfully',
    });
  } catch (error) {
    throw error;
  }
});

export default router;
