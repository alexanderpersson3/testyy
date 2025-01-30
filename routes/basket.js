import express from 'express';
const { authenticateToken } = require('../middleware/auth');
import rateLimiter from '../middleware/rate-limit.js';
import basketComparisonManager from '../services/basket-comparison-manager.js';

const router = express.Router();

// Get latest basket comparison
router.get(
  '/weekly-comparison',
  rateLimiter.api(),
  async (req, res) => {
    try {
      const comparison = await basketComparisonManager.getBasketComparison();

      res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      console.error('Error getting basket comparison:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get basket comparison'
      });
    }
  }
);

// Admin: Force update basket comparison
router.post(
  '/update',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      // Invalidate cache and calculate new comparison
      await basketComparisonManager.invalidateCache();
      const comparison = await basketComparisonManager.calculateBasketPrices();

      res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      console.error('Error updating basket comparison:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update basket comparison'
      });
    }
  }
);

export default router; 