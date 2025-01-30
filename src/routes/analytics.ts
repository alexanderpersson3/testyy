import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { getDb } from '../db.js';
import { ObjectId } from 'mongodb';

const router = Router();

// Validation schemas
const timeRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime()
});

const eventSchema = z.object({
  type: z.enum(['view', 'like', 'share', 'save', 'cook', 'search']),
  itemId: z.string(),
  itemType: z.enum(['recipe', 'ingredient', 'collection']),
  metadata: z.record(z.any()).optional()
});

// Rate limiters
const analyticsLimiter = rateLimitMiddleware.custom({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many analytics requests, please try again later.'
});

// Track event
router.post('/events',
  requireAuth,
  analyticsLimiter,
  validateRequest({ body: eventSchema }),
  async (req, res) => {
    try {
      const db = await getDb();
      const { type, itemId, itemType, metadata } = req.body;

      const event = {
        userId: req.user!._id,
        type,
        itemId: new ObjectId(itemId),
        itemType,
        metadata,
        createdAt: new Date()
      };

      await db.collection('analytics_events').insertOne(event);

      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking event:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to track event'
      });
    }
  }
);

// Get user stats
router.get('/user/stats',
  requireAuth,
  analyticsLimiter,
  validateRequest({ query: timeRangeSchema }),
  async (req, res) => {
    try {
      const db = await getDb();
      const { start, end } = req.query as z.infer<typeof timeRangeSchema>;

      const pipeline = [
        {
          $match: {
            userId: req.user!._id,
            createdAt: {
              $gte: new Date(start),
              $lte: new Date(end)
            }
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ];

      const stats = await db.collection('analytics_events')
        .aggregate(pipeline)
        .toArray();

      res.json({
        success: true,
        stats: stats.reduce((acc, { _id, count }) => ({
          ...acc,
          [_id]: count
        }), {})
      });
    } catch (error) {
      console.error('Error getting user stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user stats'
      });
    }
  }
);

// Get item stats
router.get('/items/:itemId/stats',
  requireAuth,
  analyticsLimiter,
  validateRequest({ query: timeRangeSchema }),
  async (req, res) => {
    try {
      const db = await getDb();
      const { itemId } = req.params;
      const { start, end } = req.query as z.infer<typeof timeRangeSchema>;

      const pipeline = [
        {
          $match: {
            itemId: new ObjectId(itemId),
            createdAt: {
              $gte: new Date(start),
              $lte: new Date(end)
            }
          }
        },
        {
          $group: {
            _id: {
              type: '$type',
              day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.type',
            data: {
              $push: {
                date: '$_id.day',
                count: '$count'
              }
            }
          }
        }
      ];

      const stats = await db.collection('analytics_events')
        .aggregate(pipeline)
        .toArray();

      res.json({
        success: true,
        stats: stats.reduce((acc, { _id, data }) => ({
          ...acc,
          [_id]: data
        }), {})
      });
    } catch (error) {
      console.error('Error getting item stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get item stats'
      });
    }
  }
);

// Get trending items
router.get('/trending',
  requireAuth,
  analyticsLimiter,
  validateRequest({ query: timeRangeSchema }),
  async (req, res) => {
    try {
      const db = await getDb();
      const { start, end } = req.query as z.infer<typeof timeRangeSchema>;

      const pipeline = [
        {
          $match: {
            createdAt: {
              $gte: new Date(start),
              $lte: new Date(end)
            }
          }
        },
        {
          $group: {
            _id: {
              itemId: '$itemId',
              itemType: '$itemType'
            },
            score: {
              $sum: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$type', 'view'] }, then: 1 },
                    { case: { $eq: ['$type', 'like'] }, then: 5 },
                    { case: { $eq: ['$type', 'share'] }, then: 10 },
                    { case: { $eq: ['$type', 'save'] }, then: 3 },
                    { case: { $eq: ['$type', 'cook'] }, then: 8 }
                  ],
                  default: 0
                }
              }
            }
          }
        },
        {
          $sort: { score: -1 }
        },
        {
          $limit: 10
        }
      ];

      const trending = await db.collection('analytics_events')
        .aggregate(pipeline)
        .toArray();

      res.json({
        success: true,
        trending: trending.map(({ _id, score }) => ({
          itemId: _id.itemId,
          itemType: _id.itemType,
          score
        }))
      });
    } catch (error) {
      console.error('Error getting trending items:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get trending items'
      });
    }
  }
);

export default router; 