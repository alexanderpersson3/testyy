const express = require('express');
const router = express.Router();
const adManager = require('../services/ad-manager');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { z } = require('zod');

// Validation schemas
const createAdSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  image_url: z.string().url(),
  target_url: z.string().url(),
  type: z.enum(['banner', 'interstitial', 'native']),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  targeting: z.object({
    region: z.string().optional(),
    language: z.string().optional(),
    cuisine: z.string().optional(),
    diet: z.string().optional()
  }).optional()
});

const updateAdSchema = createAdSchema.partial();

// Routes
router.post('/',
  authenticateToken,
  isAdmin,
  validateRequest(createAdSchema),
  async (req, res) => {
    try {
      const result = await adManager.createAd(req.body);
      res.status(201).json(result);
    } catch (err) {
      console.error('Error creating ad:', err);
      res.status(500).json({ error: 'Failed to create ad' });
    }
  }
);

router.put('/:adId',
  authenticateToken,
  isAdmin,
  validateRequest(updateAdSchema),
  async (req, res) => {
    try {
      const result = await adManager.updateAd(req.params.adId, req.body);
      if (result.modifiedCount === 0) {
        return res.status(404).json({ error: 'Ad not found' });
      }
      res.json({ message: 'Ad updated successfully' });
    } catch (err) {
      console.error('Error updating ad:', err);
      res.status(500).json({ error: 'Failed to update ad' });
    }
  }
);

router.get('/',
  authenticateToken,
  async (req, res) => {
    try {
      const { type = 'banner', count = 1 } = req.query;
      const ads = await adManager.getAds(req.user.id, type, parseInt(count));
      res.json(ads);
    } catch (err) {
      console.error('Error getting ads:', err);
      res.status(500).json({ error: 'Failed to get ads' });
    }
  }
);

router.post('/:adId/click',
  authenticateToken,
  async (req, res) => {
    try {
      await adManager.trackClick(req.user.id, req.params.adId);
      res.json({ message: 'Click tracked successfully' });
    } catch (err) {
      console.error('Error tracking click:', err);
      res.status(500).json({ error: 'Failed to track click' });
    }
  }
);

router.get('/:adId/stats',
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const stats = await adManager.getAdStats(req.params.adId);
      res.json(stats);
    } catch (err) {
      console.error('Error getting ad stats:', err);
      res.status(500).json({ error: 'Failed to get ad stats' });
    }
  }
);

module.exports = router; 