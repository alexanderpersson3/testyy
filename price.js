const express = require('express');
const { ObjectId } = require('mongodb');
const { body, validationResult } = require('express-validator');
const auth = require('./middleware/auth');
const { ingredient, priceHistory, priceAlerts } = require('./collection');

const router = express.Router();

// Validation middleware
const validatePriceAlert = [
  body('ingredientId').notEmpty().withMessage('Ingredient ID is required'),
  body('targetPrice').isNumeric().withMessage('Target price must be a number'),
  body('type').isIn(['below', 'above']).withMessage('Alert type must be either "below" or "above"'),
];

// Track price history for an ingredient
const trackPriceHistory = async (ingredientId, price, store) => {
  const priceHistoryCollection = await priceHistory();
  await priceHistoryCollection.insertOne({
    ingredientId,
    price,
    store,
    timestamp: new Date(),
  });
};

// Check price alerts for an ingredient
const checkPriceAlerts = async (ingredientId, currentPrice) => {
  const alertsCollection = await priceAlerts();
  const alerts = await alertsCollection.find({ ingredientId }).toArray();

  const triggeredAlerts = alerts.filter(alert => {
    if (alert.type === 'below' && currentPrice <= alert.targetPrice) return true;
    if (alert.type === 'above' && currentPrice >= alert.targetPrice) return true;
    return false;
  });

  // In a real application, you would send notifications here
  // For now, we'll just mark the alerts as triggered
  for (const alert of triggeredAlerts) {
    await alertsCollection.updateOne(
      { _id: alert._id },
      { 
        $set: { 
          triggered: true,
          triggeredAt: new Date(),
          triggerPrice: currentPrice
        } 
      }
    );
  }

  return triggeredAlerts;
};

// Get price history for an ingredient
router.get('/ingredients/:ingredientId/history', async (req, res) => {
  try {
    const ingredientId = new ObjectId(req.params.ingredientId);
    const priceHistoryCollection = await priceHistory();

    const history = await priceHistoryCollection
      .find({ ingredientId })
      .sort({ timestamp: -1 })
      .toArray();

    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Get price history error:', error);
    res.status(500).json({ success: false, message: 'Failed to get price history' });
  }
});

// Create price alert
router.post('/alerts', auth, validatePriceAlert, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ingredientId, targetPrice, type } = req.body;
    const alertsCollection = await priceAlerts();

    const alert = {
      ingredientId: new ObjectId(ingredientId),
      userId: req.userId,
      targetPrice: Number(targetPrice),
      type,
      createdAt: new Date(),
      triggered: false,
    };

    const result = await alertsCollection.insertOne(alert);
    res.status(201).json({
      success: true,
      data: { ...alert, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Create price alert error:', error);
    res.status(500).json({ success: false, message: 'Failed to create price alert' });
  }
});

// Get user's price alerts
router.get('/alerts/my-alerts', auth, async (req, res) => {
  try {
    const alertsCollection = await priceAlerts();
    const ingredientCollection = await ingredient();

    const alerts = await alertsCollection
      .find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .toArray();

    // Get ingredient details for each alert
    const alertsWithDetails = await Promise.all(
      alerts.map(async (alert) => {
        const ingredient = await ingredientCollection.findOne(
          { _id: alert.ingredientId }
        );
        return {
          ...alert,
          ingredient: {
            name: ingredient.name,
            currentPrice: ingredient.newPrice,
            store: ingredient.store,
          },
        };
      })
    );

    res.json({ success: true, data: alertsWithDetails });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ success: false, message: 'Failed to get price alerts' });
  }
});

// Delete price alert
router.delete('/alerts/:alertId', auth, async (req, res) => {
  try {
    const alertId = new ObjectId(req.params.alertId);
    const alertsCollection = await priceAlerts();

    // Check if alert exists and belongs to user
    const alert = await alertsCollection.findOne({
      _id: alertId,
      userId: req.userId,
    });

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found or you do not have permission to delete it'
      });
    }

    await alertsCollection.deleteOne({ _id: alertId });
    res.json({ success: true, message: 'Price alert deleted successfully' });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete price alert' });
  }
});

module.exports = {
  router,
  trackPriceHistory,
  checkPriceAlerts,
}; 