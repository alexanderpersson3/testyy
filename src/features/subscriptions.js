import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import rateLimiter from '../middleware/rate-limit.js';
import subscriptionManager from '../services/subscription-manager.js';
import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import { validateReceipt } from '../services/payment-service.js';
import axios from 'axios';
import { google } from 'googleapis';

const router = Router();

// Environment validation
const requiredEnvVars = {
  APPLE_BUNDLE_ID: process.env.APPLE_BUNDLE_ID,
  APPLE_SHARED_SECRET: process.env.APPLE_SHARED_SECRET,
  GOOGLE_PLAY_PACKAGE_NAME: process.env.GOOGLE_PLAY_PACKAGE_NAME,
  GOOGLE_PLAY_SERVICE_ACCOUNT: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT,
};

Object.entries(requiredEnvVars).forEach(([key, value]) => {
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
});

// Initialize Google Play API client
const androidPublisher = google.androidpublisher('v3');
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT),
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});

// Validation schemas
const validatePurchaseSchema = z
  .object({
    platform: z.enum(['android', 'ios']),
    purchaseData: z
      .object({
        // Android fields
        packageName: z.string().optional(),
        subscriptionId: z.string().optional(),
        purchaseToken: z.string().optional(),
        // iOS fields
        receiptData: z.string().optional(),
      })
      .refine(
        data => {
          if (data.platform === 'android') {
            return data.packageName && data.subscriptionId && data.purchaseToken;
          } else {
            return data.receiptData;
          }
        },
        {
          message: 'Missing required fields for the specified platform',
        }
      ),
  })
  .strict();

const googlePlayNotificationSchema = z
  .object({
    message: z.object({
      data: z.string(),
      messageId: z.string(),
      publishTime: z.string(),
    }),
  })
  .strict();

const appStoreNotificationSchema = z
  .object({
    notification_type: z.string(),
    password: z.string(),
    environment: z.string(),
    latest_receipt: z.string(),
  })
  .strict();

const checkFeatureSchema = z
  .object({
    feature: z.enum([
      'recipes_per_month',
      'meal_plans',
      'price_alerts',
      'collections',
      'advanced_search',
      'ad_free',
    ]),
    increment: z.boolean().optional(),
  })
  .strict();

const purchaseSchema = z.object({
  planId: z.string(),
  paymentMethod: z.string(),
  receipt: z.string().optional(),
  platform: z.enum(['IOS', 'ANDROID', 'WEB']).optional(),
});

const appleReceiptSchema = z.object({
  receiptData: z.string(),
  password: z.string().optional(), // App-specific shared secret
  excludeOldTransactions: z.boolean().optional(),
});

const googlePurchaseSchema = z.object({
  purchaseToken: z.string(),
  productId: z.string(),
  packageName: z.string().optional(),
});

const subscriptionTierSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  duration: z.enum(['monthly', 'yearly']),
  features: z.array(z.string()),
  isActive: z.boolean().default(true),
  platforms: z.array(z.enum(['ios', 'android', 'web'])),
  productIds: z.object({
    ios: z.string().optional(),
    android: z.string().optional(),
  }),
});

// Helper function to verify Apple receipt
async function verifyAppleReceipt(receiptData, isProduction = true) {
  const verifyUrl = isProduction
    ? 'https://buy.itunes.apple.com/verifyReceipt'
    : 'https://sandbox.itunes.apple.com/verifyReceipt';

  const response = await axios.post(verifyUrl, {
    'receipt-data': receiptData,
    password: process.env.APPLE_SHARED_SECRET,
    'exclude-old-transactions': true,
  });

  if (response.data.status === 21007) {
    // Receipt is from sandbox, retry with sandbox URL
    return verifyAppleReceipt(receiptData, false);
  }

  return response.data;
}

// Helper function to verify Google Play purchase
async function verifyGooglePurchase(purchaseToken, productId, packageName) {
  const client = await auth.getClient();
  const response = await androidPublisher.purchases.subscriptions.get({
    auth: client,
    packageName: packageName || process.env.GOOGLE_PLAY_PACKAGE_NAME,
    subscriptionId: productId,
    token: purchaseToken,
  });

  return response.data;
}

// Routes
router.post(
  '/validate',
  authenticateToken,
  validateRequest(validatePurchaseSchema, 'body'),
  async (req, res) => {
    try {
      const subscription = await subscriptionManager.createOrUpdateSubscription(
        req.user.id,
        req.body.platform,
        req.body.purchaseData
      );
      res.json(subscription);
    } catch (err) {
      console.error('Purchase validation error:', err);
      res.status(500).json({ error: 'Failed to validate purchase' });
    }
  }
);

router.post(
  '/restore',
  authenticateToken,
  validateRequest(validatePurchaseSchema, 'body'),
  async (req, res) => {
    try {
      const subscription = await subscriptionManager.restorePurchases(
        req.user.id,
        req.body.platform,
        req.body.purchaseData
      );
      res.json(subscription);
    } catch (err) {
      console.error('Restore purchases error:', err);
      res.status(500).json({ error: 'Failed to restore purchases' });
    }
  }
);

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const isActive = await subscriptionManager.isSubscriptionActive(req.user.id);
    res.json({ active: isActive });
  } catch (err) {
    console.error('Get subscription status error:', err);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

router.get('/details', authenticateToken, async (req, res) => {
  try {
    const details = await subscriptionManager.getSubscriptionDetails(req.user.id);
    if (!details) {
      return res.status(404).json({ error: 'No subscription found' });
    }
    res.json(details);
  } catch (err) {
    console.error('Get subscription details error:', err);
    res.status(500).json({ error: 'Failed to get subscription details' });
  }
});

router.get('/limits', authenticateToken, async (req, res) => {
  try {
    const limits = await subscriptionManager.getFeatureLimits(req.user.id);
    res.json(limits);
  } catch (err) {
    console.error('Get feature limits error:', err);
    res.status(500).json({ error: 'Failed to get feature limits' });
  }
});

router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const usage = await subscriptionManager.getFeatureUsage(req.user.id);
    res.json(usage);
  } catch (err) {
    console.error('Get feature usage error:', err);
    res.status(500).json({ error: 'Failed to get feature usage' });
  }
});

router.post(
  '/check-feature',
  authenticateToken,
  validateRequest(checkFeatureSchema, 'body'),
  async (req, res) => {
    try {
      const hasAccess = await subscriptionManager.checkFeatureAccess(
        req.user.id,
        req.body.feature,
        req.body.increment
      );
      res.json({ hasAccess });
    } catch (err) {
      console.error('Check feature access error:', err);
      res.status(500).json({ error: 'Failed to check feature access' });
    }
  }
);

router.get('/history', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const logs = await db
      .collection('subscription_logs')
      .find({ user_id: new ObjectId(req.user.id) })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
    res.json(logs);
  } catch (err) {
    console.error('Get subscription history error:', err);
    res.status(500).json({ error: 'Failed to get subscription history' });
  }
});

// Webhook endpoints for store notifications
router.post(
  '/webhooks/google-play',
  validateRequest(googlePlayNotificationSchema, 'body'),
  async (req, res) => {
    try {
      await subscriptionManager.handleGooglePlayNotification(req.body.message);
      res.sendStatus(200);
    } catch (err) {
      console.error('Google Play webhook error:', err);
      res.sendStatus(500);
    }
  }
);

router.post(
  '/webhooks/app-store',
  validateRequest(appStoreNotificationSchema, 'body'),
  async (req, res) => {
    try {
      // Verify shared secret
      if (req.body.password !== process.env.APPLE_SHARED_SECRET) {
        return res.sendStatus(401);
      }

      await subscriptionManager.handleAppStoreNotification(req.body);
      res.sendStatus(200);
    } catch (err) {
      console.error('App Store webhook error:', err);
      res.sendStatus(500);
    }
  }
);

// Start free trial
router.post('/trial/start', authenticateToken, rateLimiter.api(), async (req, res) => {
  try {
    const result = await subscriptionManager.startTrial(req.user.id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error starting trial:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to start trial',
    });
  }
});

// Get subscription details
router.get('/', authenticateToken, rateLimiter.api(), async (req, res) => {
  try {
    const details = await subscriptionManager.getSubscriptionDetails(req.user.id);

    res.json({
      success: true,
      data: details,
    });
  } catch (error) {
    console.error('Error getting subscription details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription details',
    });
  }
});

// Check premium access
router.get('/access/:feature', authenticateToken, rateLimiter.api(), async (req, res) => {
  try {
    const hasAccess = await subscriptionManager.hasPremiumAccess(req.user.id, req.params.feature);

    res.json({
      success: true,
      data: { hasAccess },
    });
  } catch (error) {
    console.error('Error checking premium access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check premium access',
    });
  }
});

// Upgrade to premium
router.post('/premium/upgrade', authenticateToken, rateLimiter.api(), async (req, res) => {
  try {
    const result = await subscriptionManager.upgradeToPremium(req.user.id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error upgrading to premium:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upgrade to premium',
    });
  }
});

// Admin: End expired trials
router.post('/trials/end-expired', authenticateToken, rateLimiter.api(), async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const result = await subscriptionManager.endExpiredTrials();

    res.json({
      success: true,
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error('Error ending expired trials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end expired trials',
    });
  }
});

// Get available subscription plans
router.get('/plans', async (req, res) => {
  try {
    const db = getDb();
    const plans = await db
      .collection('subscription_plans')
      .find({ isActive: true })
      .sort({ price: 1 })
      .toArray();

    res.json({ plans });
  } catch (error) {
    throw error;
  }
});

// Start free trial
router.post('/trial', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);

    // Check if user already had a trial
    const existingTrial = await db.collection('subscriptions').findOne({ userId, type: 'TRIAL' });

    if (existingTrial) {
      return res.status(400).json({ message: 'User already used trial period' });
    }

    const trial = {
      userId,
      type: 'TRIAL',
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      createdAt: new Date(),
    };

    await db.collection('subscriptions').insertOne(trial);

    res.status(201).json({
      message: 'Trial started successfully',
      trial,
    });
  } catch (error) {
    throw error;
  }
});

// Purchase subscription
router.post('/purchase', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const { planId, paymentMethod, receipt, platform } = purchaseSchema.parse(req.body);

    // Verify receipt if platform is iOS or Android
    if (platform && receipt) {
      const verificationResult = await validateReceipt(platform, receipt);
      if (!verificationResult.isValid) {
        return res.status(400).json({ message: 'Invalid receipt' });
      }
    }

    const plan = await db
      .collection('subscription_plans')
      .findOne({ _id: new ObjectId(planId), isActive: true });

    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    // Cancel any existing subscriptions
    await db
      .collection('subscriptions')
      .updateMany(
        { userId, status: 'ACTIVE' },
        { $set: { status: 'CANCELLED', cancelledAt: new Date() } }
      );

    const subscription = {
      userId,
      planId: new ObjectId(planId),
      type: 'PAID',
      status: 'ACTIVE',
      platform,
      paymentMethod,
      amount: plan.price,
      startDate: new Date(),
      endDate: new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    const result = await db.collection('subscriptions').insertOne(subscription);

    // Create payment record
    await db.collection('payments').insertOne({
      userId,
      subscriptionId: result.insertedId,
      planId: new ObjectId(planId),
      amount: plan.price,
      platform,
      paymentMethod,
      status: 'COMPLETED',
      createdAt: new Date(),
    });

    res.status(201).json({
      message: 'Subscription purchased successfully',
      subscription: {
        _id: result.insertedId,
        ...subscription,
        plan,
      },
    });
  } catch (error) {
    throw error;
  }
});

// Cancel subscription
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);

    const result = await db.collection('subscriptions').findOneAndUpdate(
      { userId, status: 'ACTIVE' },
      {
        $set: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'No active subscription found' });
    }

    res.json({
      message: 'Subscription cancelled successfully',
      subscription: result.value,
    });
  } catch (error) {
    throw error;
  }
});

// Get current user's subscription
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);

    const subscription = await db
      .collection('subscriptions')
      .aggregate([
        {
          $match: {
            userId,
            status: 'ACTIVE',
            endDate: { $gt: new Date() },
          },
        },
        {
          $lookup: {
            from: 'subscription_plans',
            localField: 'planId',
            foreignField: '_id',
            as: 'plan',
          },
        },
        { $unwind: { path: '$plan', preserveNullAndEmptyArrays: true } },
      ])
      .next();

    if (!subscription) {
      return res.json({
        isSubscribed: false,
        subscription: null,
      });
    }

    res.json({
      isSubscribed: true,
      subscription,
    });
  } catch (error) {
    throw error;
  }
});

// Get subscription history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const { page = 1, limit = 10 } = req.query;

    const subscriptions = await db
      .collection('subscriptions')
      .aggregate([
        { $match: { userId } },
        { $sort: { createdAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'subscription_plans',
            localField: 'planId',
            foreignField: '_id',
            as: 'plan',
          },
        },
        { $unwind: { path: '$plan', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'payments',
            localField: '_id',
            foreignField: 'subscriptionId',
            as: 'payments',
          },
        },
      ])
      .toArray();

    const total = await db.collection('subscriptions').countDocuments({ userId });

    res.json({
      subscriptions,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Admin: Create subscription plan
router.post('/plans', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const plan = z
      .object({
        name: z.string(),
        description: z.string(),
        price: z.number().positive(),
        durationDays: z.number().int().positive(),
        features: z.array(z.string()),
        isActive: z.boolean().default(true),
      })
      .parse(req.body);

    const result = await db.collection('subscription_plans').insertOne({
      ...plan,
      createdAt: new Date(),
      createdBy: new ObjectId(req.user.id),
    });

    res.status(201).json({
      _id: result.insertedId,
      ...plan,
    });
  } catch (error) {
    throw error;
  }
});

// Admin: Update subscription plan
router.put('/plans/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const planId = new ObjectId(req.params.id);
    const updates = z
      .object({
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.number().positive().optional(),
        durationDays: z.number().int().positive().optional(),
        features: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body);

    const result = await db.collection('subscription_plans').findOneAndUpdate(
      { _id: planId },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
          updatedBy: new ObjectId(req.user.id),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

// Get subscription tiers
router.get('/tiers', async (req, res) => {
  try {
    const db = getDb();
    const tiers = await db.collection('subscription_tiers').find({ isActive: true }).toArray();

    res.json(tiers);
  } catch (error) {
    throw error;
  }
});

// Verify iOS purchase
router.post('/verify/ios', authenticateToken, rateLimiter.medium(), async (req, res) => {
  try {
    const db = getDb();
    const { receiptData } = appleReceiptSchema.parse(req.body);

    // Verify receipt with Apple
    const verificationData = await verifyAppleReceipt(receiptData);

    if (verificationData.status !== 0) {
      return res.status(400).json({
        message: 'Invalid receipt',
        status: verificationData.status,
      });
    }

    const latestReceipt = verificationData.latest_receipt_info?.[0];
    if (!latestReceipt) {
      return res.status(400).json({ message: 'No valid subscription found' });
    }

    // Find subscription tier
    const tier = await db.collection('subscription_tiers').findOne({
      'productIds.ios': latestReceipt.product_id,
    });

    if (!tier) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    // Update or create subscription
    const subscription = {
      userId: new ObjectId(req.user.id),
      platform: 'ios',
      tierId: tier._id,
      productId: latestReceipt.product_id,
      purchaseToken: verificationData.latest_receipt,
      originalTransactionId: latestReceipt.original_transaction_id,
      status: 'active',
      startDate: new Date(parseInt(latestReceipt.purchase_date_ms)),
      expiresAt: new Date(parseInt(latestReceipt.expires_date_ms)),
      isAutoRenewing: latestReceipt.auto_renew_status === '1',
      lastVerifiedAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('user_subscriptions').updateOne(
      {
        userId: new ObjectId(req.user.id),
        platform: 'ios',
        originalTransactionId: latestReceipt.original_transaction_id,
      },
      { $set: subscription },
      { upsert: true }
    );

    // Update user's subscription status
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.id) },
      {
        $set: {
          subscriptionType: tier.name,
          subscriptionExpiresAt: subscription.expiresAt,
          updatedAt: new Date(),
        },
      }
    );

    res.json({
      subscription,
      tier,
    });
  } catch (error) {
    throw error;
  }
});

// Verify Android purchase
router.post('/verify/android', authenticateToken, rateLimiter.medium(), async (req, res) => {
  try {
    const db = getDb();
    const { purchaseToken, productId } = googlePurchaseSchema.parse(req.body);

    // Verify purchase with Google Play
    const purchaseData = await verifyGooglePurchase(purchaseToken, productId);

    // Find subscription tier
    const tier = await db.collection('subscription_tiers').findOne({
      'productIds.android': productId,
    });

    if (!tier) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    // Update or create subscription
    const subscription = {
      userId: new ObjectId(req.user.id),
      platform: 'android',
      tierId: tier._id,
      productId,
      purchaseToken,
      status: purchaseData.paymentState === 1 ? 'active' : 'pending',
      startDate: new Date(parseInt(purchaseData.startTimeMillis)),
      expiresAt: new Date(parseInt(purchaseData.expiryTimeMillis)),
      isAutoRenewing: purchaseData.autoRenewing,
      lastVerifiedAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('user_subscriptions').updateOne(
      {
        userId: new ObjectId(req.user.id),
        platform: 'android',
        purchaseToken,
      },
      { $set: subscription },
      { upsert: true }
    );

    // Update user's subscription status if active
    if (subscription.status === 'active') {
      await db.collection('users').updateOne(
        { _id: new ObjectId(req.user.id) },
        {
          $set: {
            subscriptionType: tier.name,
            subscriptionExpiresAt: subscription.expiresAt,
            updatedAt: new Date(),
          },
        }
      );
    }

    res.json({
      subscription,
      tier,
    });
  } catch (error) {
    throw error;
  }
});

// Get user's subscription status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const db = getDb();

    const subscription = await db.collection('user_subscriptions').findOne(
      {
        userId: new ObjectId(req.user.id),
        status: 'active',
        expiresAt: { $gt: new Date() },
      },
      { sort: { expiresAt: -1 } }
    );

    if (!subscription) {
      return res.json({
        isSubscribed: false,
        subscriptionType: 'free',
      });
    }

    const tier = await db.collection('subscription_tiers').findOne({ _id: subscription.tierId });

    res.json({
      isSubscribed: true,
      subscription,
      tier,
    });
  } catch (error) {
    throw error;
  }
});

// Get subscription history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 10 } = req.query;

    const subscriptions = await db
      .collection('user_subscriptions')
      .aggregate([
        {
          $match: { userId: new ObjectId(req.user.id) },
        },
        {
          $lookup: {
            from: 'subscription_tiers',
            localField: 'tierId',
            foreignField: '_id',
            as: 'tier',
          },
        },
        { $unwind: '$tier' },
        { $sort: { startDate: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
      ])
      .toArray();

    const total = await db
      .collection('user_subscriptions')
      .countDocuments({ userId: new ObjectId(req.user.id) });

    res.json({
      subscriptions,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Handle App Store server notifications
router.post('/notifications/apple', async (req, res) => {
  try {
    const db = getDb();
    const notification = req.body;

    // Verify notification authenticity (implement proper verification)
    // Store notification for processing
    await db.collection('subscription_notifications').insertOne({
      platform: 'ios',
      type: notification.notification_type,
      data: notification,
      processedAt: null,
      createdAt: new Date(),
    });

    // Process notification asynchronously
    // You might want to use a job queue for this
    processAppleNotification(notification).catch(console.error);

    res.sendStatus(200);
  } catch (error) {
    throw error;
  }
});

// Handle Google Play real-time developer notifications
router.post('/notifications/google', async (req, res) => {
  try {
    const db = getDb();
    const notification = req.body;

    // Store notification for processing
    await db.collection('subscription_notifications').insertOne({
      platform: 'android',
      type: notification.subscriptionNotification?.notificationType,
      data: notification,
      processedAt: null,
      createdAt: new Date(),
    });

    // Process notification asynchronously
    processGoogleNotification(notification).catch(console.error);

    res.sendStatus(200);
  } catch (error) {
    throw error;
  }
});

// Admin: Create subscription tier
router.post('/admin/tiers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const tierData = subscriptionTierSchema.parse(req.body);

    const tier = {
      ...tierData,
      createdBy: new ObjectId(req.user.id),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('subscription_tiers').insertOne(tier);

    const createdTier = await db.collection('subscription_tiers').findOne({
      _id: result.insertedId,
    });

    res.status(201).json(createdTier);
  } catch (error) {
    throw error;
  }
});

// Admin: Update subscription tier
router.patch('/admin/tiers/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const tierId = new ObjectId(req.params.id);
    const updates = subscriptionTierSchema.partial().parse(req.body);

    const result = await db.collection('subscription_tiers').findOneAndUpdate(
      { _id: tierId },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
          updatedBy: new ObjectId(req.user.id),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Subscription tier not found' });
    }

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

// Admin: Get subscription analytics
router.get('/admin/analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { period = '30d' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const analytics = await db
      .collection('user_subscriptions')
      .aggregate([
        {
          $facet: {
            activeSubscriptions: [
              {
                $match: {
                  status: 'active',
                  expiresAt: { $gt: new Date() },
                },
              },
              { $count: 'count' },
            ],
            newSubscriptions: [
              {
                $match: {
                  startDate: { $gte: startDate },
                },
              },
              { $count: 'count' },
            ],
            byPlatform: [
              {
                $group: {
                  _id: '$platform',
                  count: { $sum: 1 },
                },
              },
            ],
            byTier: [
              {
                $lookup: {
                  from: 'subscription_tiers',
                  localField: 'tierId',
                  foreignField: '_id',
                  as: 'tier',
                },
              },
              { $unwind: '$tier' },
              {
                $group: {
                  _id: '$tier.name',
                  count: { $sum: 1 },
                },
              },
            ],
            renewalRate: [
              {
                $match: {
                  startDate: { $gte: startDate },
                },
              },
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  autoRenewing: {
                    $sum: { $cond: ['$isAutoRenewing', 1, 0] },
                  },
                },
              },
            ],
          },
        },
      ])
      .next();

    res.json({
      active: analytics.activeSubscriptions[0]?.count || 0,
      new: analytics.newSubscriptions[0]?.count || 0,
      byPlatform: analytics.byPlatform,
      byTier: analytics.byTier,
      renewalRate: analytics.renewalRate[0]
        ? (analytics.renewalRate[0].autoRenewing / analytics.renewalRate[0].total) * 100
        : 0,
    });
  } catch (error) {
    throw error;
  }
});

export default router;
