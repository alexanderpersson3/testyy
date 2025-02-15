import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
const { authenticateToken } = require('../middleware/auth');
import rateLimiter from '../middleware/rate-limit.js';
import priceHistoryManager from '../services/price-history-manager.js';

const router = express.Router();

// Validation schemas
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform(val => new Date(val));

const historyQuerySchema = z
  .object({
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    period: z.enum(['daily', 'weekly', 'monthly']).optional(),
  })
  .strict();

// Get price history for a product
router.get(
  '/:productId',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    params: z.object({
      productId: z.string(),
    }),
    query: historyQuerySchema,
  }),
  async (req, res) => {
    try {
      const history = await priceHistoryManager.getPriceHistory(
        req.params.productId,
        req.user.id,
        req.query
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error('Error getting price history:', error);
      res.status(error.message.includes('Premium subscription required') ? 403 : 500).json({
        success: false,
        message: error.message || 'Failed to get price history',
      });
    }
  }
);

// Get lowest price stores for a product
router.get(
  '/:productId/lowest-prices',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    params: z.object({
      productId: z.string(),
    }),
  }),
  async (req, res) => {
    try {
      const stores = await priceHistoryManager.getLowestPriceStores(
        req.params.productId,
        req.user.id
      );

      res.json({
        success: true,
        data: stores,
      });
    } catch (error) {
      console.error('Error getting lowest price stores:', error);
      res.status(error.message.includes('Premium subscription required') ? 403 : 500).json({
        success: false,
        message: error.message || 'Failed to get lowest price stores',
      });
    }
  }
);

// Admin: Record a new price
router.post(
  '/record',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    body: z.object({
      productId: z.string(),
      storeId: z.string(),
      price: z.number().positive(),
    }),
  }),
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const record = await priceHistoryManager.recordPrice(
        req.body.productId,
        req.body.storeId,
        req.body.price
      );

      res.json({
        success: true,
        data: record,
      });
    } catch (error) {
      console.error('Error recording price:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to record price',
      });
    }
  }
);

// Admin: Clean up old records
router.delete(
  '/cleanup',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    query: z.object({
      days: z.string().regex(/^\d+$/).transform(Number).optional(),
    }),
  }),
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const result = await priceHistoryManager.cleanupOldRecords(req.query.days);

      res.json({
        success: true,
        data: {
          deletedCount: result.deletedCount,
        },
      });
    } catch (error) {
      console.error('Error cleaning up old records:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clean up old records',
      });
    }
  }
);

export default router;
