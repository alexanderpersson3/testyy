import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
const { authenticateToken } = require('../middleware/auth');
import rateLimiter from '../middleware/rate-limit.js';
import dealManager from '../services/deal-manager.js';
import storeScraper from '../services/store-scraper.js';

const router = express.Router();

// Validation schemas
const paginationSchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  offset: z.string().regex(/^\d+$/).transform(Number).default('0'),
});

const filterSchema = z.object({
  storeId: z.string().optional(),
  category: z.string().optional(),
});

// Get top deals
router.get(
  '/top',
  rateLimiter.api(),
  validateRequest({
    query: paginationSchema.merge(filterSchema),
  }),
  async (req, res) => {
    try {
      const { limit, offset, storeId, category } = req.query;
      const userId = req.user?.id; // Optional user ID for personalization

      // Try to get cached deals first
      let deals = await dealManager.getCachedTopDeals();

      if (!deals) {
        // If no cache or filtered request, get fresh deals
        deals = await dealManager.getTopDeals({
          limit,
          offset,
          storeId,
          category,
          userId,
        });

        // Cache only unfiltered results
        if (!storeId && !category) {
          await dealManager.cacheTopDeals(deals);
        }
      }

      res.json({
        success: true,
        data: deals,
        pagination: {
          limit,
          offset,
          hasMore: deals.length === limit,
        },
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

// Get deal details
router.get('/:dealId', rateLimiter.api(), async (req, res) => {
  try {
    const db = getDb();
    const deal = await db
      .collection('deals')
      .aggregate([
        {
          $match: {
            _id: new ObjectId(req.params.dealId),
          },
        },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product',
          },
        },
        {
          $unwind: '$product',
        },
        {
          $lookup: {
            from: 'stores',
            localField: 'storeId',
            foreignField: '_id',
            as: 'store',
          },
        },
        {
          $unwind: '$store',
        },
      ])
      .next();

    if (!deal) {
      throw new Error('Deal not found');
    }

    // Track view
    await dealManager.trackDealInteraction(req.params.dealId, 'view');

    res.json({
      success: true,
      data: deal,
    });
  } catch (error) {
    console.error('Error getting deal:', error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

// Save deal
router.post('/:dealId/save', authenticateToken, rateLimiter.api(), async (req, res) => {
  try {
    // Track save
    await dealManager.trackDealInteraction(req.params.dealId, 'save');

    res.json({
      success: true,
      message: 'Deal saved successfully',
    });
  } catch (error) {
    console.error('Error saving deal:', error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Get recipes using deal ingredients
router.get(
  '/:dealId/recipes',
  rateLimiter.api(),
  validateRequest({ query: paginationSchema }),
  async (req, res) => {
    try {
      const db = getDb();
      const { limit, offset } = req.query;

      // Get deal and product details
      const deal = await db
        .collection('deals')
        .aggregate([
          {
            $match: {
              _id: new ObjectId(req.params.dealId),
            },
          },
          {
            $lookup: {
              from: 'products',
              localField: 'productId',
              foreignField: '_id',
              as: 'product',
            },
          },
          {
            $unwind: '$product',
          },
        ])
        .next();

      if (!deal) {
        throw new Error('Deal not found');
      }

      // Find recipes using the product
      const recipes = await db
        .collection('recipes')
        .aggregate([
          {
            $match: {
              'ingredients.name': deal.product.name,
            },
          },
          {
            $addFields: {
              relevanceScore: {
                $add: [{ $multiply: ['$averageRating', 2] }, { $multiply: ['$saveCount', 0.1] }],
              },
            },
          },
          { $sort: { relevanceScore: -1 } },
          { $skip: offset },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              title: 1,
              description: 1,
              images: 1,
              difficulty: 1,
              prepTime: 1,
              cookTime: 1,
              averageRating: 1,
              reviewCount: 1,
              author: 1,
            },
          },
        ])
        .toArray();

      res.json({
        success: true,
        data: recipes,
        pagination: {
          limit,
          offset,
          hasMore: recipes.length === limit,
        },
      });
    } catch (error) {
      console.error('Error getting recipes for deal:', error);
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Update deals (admin only)
router.post('/update', authenticateToken, rateLimiter.api(), async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      throw new Error('Unauthorized');
    }

    const results = await storeScraper.updateAllStores();

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Error updating deals:', error);
    res.status(error.message === 'Unauthorized' ? 403 : 500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
