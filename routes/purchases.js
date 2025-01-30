import { Router } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import rateLimiter from '../middleware/rate-limit.js';
import axios from 'axios';
import jwt from 'jsonwebtoken';

const router = Router();

// Environment variables validation
const requiredEnvVars = [
  'APPLE_BUNDLE_ID',
  'APPLE_SHARED_SECRET',
  'GOOGLE_PLAY_PACKAGE_NAME',
  'GOOGLE_PLAY_SERVICE_ACCOUNT'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});

// Validation schemas
const iOSReceiptSchema = z.object({
  receipt: z.string(),
  productId: z.string(),
  transactionId: z.string()
});

const androidPurchaseSchema = z.object({
  productId: z.string(),
  purchaseToken: z.string(),
  subscriptionId: z.string()
});

const subscriptionTierSchema = z.object({
  name: z.string(),
  description: z.string(),
  features: z.array(z.string()),
  price: z.number(),
  duration: z.enum(['MONTHLY', 'YEARLY']),
  productIds: z.object({
    ios: z.string(),
    android: z.string()
  })
});

// Helper function to verify iOS receipt with App Store
async function verifyIosReceipt(receipt) {
  const verifyUrl = process.env.NODE_ENV === 'production'
    ? 'https://buy.itunes.apple.com/verifyReceipt'
    : 'https://sandbox.itunes.apple.com/verifyReceipt';

  try {
    const response = await axios.post(verifyUrl, {
      'receipt-data': receipt,
      'password': process.env.APPLE_SHARED_SECRET,
      'exclude-old-transactions': true
    });

    if (response.data.status === 0) {
      return response.data.latest_receipt_info[0];
    }
    throw new Error(`Invalid receipt: ${response.data.status}`);
  } catch (error) {
    throw new Error(`Failed to verify iOS receipt: ${error.message}`);
  }
}

// Helper function to verify Android purchase with Google Play
async function verifyAndroidPurchase(purchaseToken, productId, subscriptionId) {
  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT);
    const jwtClient = new jwt.JWT(
      serviceAccount.client_email,
      null,
      serviceAccount.private_key,
      ['https://www.googleapis.com/auth/androidpublisher']
    );

    const credentials = await jwtClient.authorize();
    const response = await axios.get(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${
        process.env.GOOGLE_PLAY_PACKAGE_NAME
      }/purchases/subscriptions/${productId}/tokens/${purchaseToken}`,
      {
        headers: {
          Authorization: `Bearer ${credentials.access_token}`
        }
      }
    );

    if (response.data.paymentState === 1) {
      return response.data;
    }
    throw new Error('Invalid purchase state');
  } catch (error) {
    throw new Error(`Failed to verify Android purchase: ${error.message}`);
  }
}

// Get available subscription tiers
router.get('/subscriptions/tiers', async (req, res) => {
  try {
    const db = getDb();
    const tiers = await db.collection('subscription_tiers')
      .find({ isActive: true })
      .toArray();

    res.json(tiers);
  } catch (error) {
    throw error;
  }
});

// Verify and process iOS purchase
router.post('/verify/ios', authenticateToken, rateLimiter.strict(), async (req, res) => {
  try {
    const db = getDb();
    const { receipt, productId, transactionId } = iOSReceiptSchema.parse(req.body);

    // Check for existing transaction
    const existingPurchase = await db.collection('purchases').findOne({
      platform: 'IOS',
      'receipt.transaction_id': transactionId
    });

    if (existingPurchase) {
      return res.status(400).json({
        message: 'Purchase already processed'
      });
    }

    // Verify receipt with App Store
    const verifiedReceipt = await verifyIosReceipt(receipt);

    // Get subscription details
    const subscriptionTier = await db.collection('subscription_tiers').findOne({
      'productIds.ios': productId
    });

    if (!subscriptionTier) {
      throw new Error('Invalid product ID');
    }

    // Calculate expiration date
    const expiresAt = new Date(verifiedReceipt.expires_date_ms * 1);

    // Record purchase
    const purchase = {
      userId: new ObjectId(req.user.id),
      platform: 'IOS',
      productId,
      subscriptionTierId: subscriptionTier._id,
      receipt: verifiedReceipt,
      status: 'ACTIVE',
      purchasedAt: new Date(verifiedReceipt.purchase_date_ms * 1),
      expiresAt,
      createdAt: new Date()
    };

    await db.collection('purchases').insertOne(purchase);

    // Update user subscription status
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.id) },
      {
        $set: {
          subscription: {
            status: 'ACTIVE',
            tier: subscriptionTier._id,
            expiresAt
          },
          updatedAt: new Date()
        }
      }
    );

    res.status(201).json({
      message: 'Purchase verified successfully',
      subscription: {
        status: 'ACTIVE',
        tier: subscriptionTier,
        expiresAt
      }
    });
  } catch (error) {
    throw error;
  }
});

// Verify and process Android purchase
router.post('/verify/android', authenticateToken, rateLimiter.strict(), async (req, res) => {
  try {
    const db = getDb();
    const { productId, purchaseToken, subscriptionId } = androidPurchaseSchema.parse(req.body);

    // Check for existing purchase
    const existingPurchase = await db.collection('purchases').findOne({
      platform: 'ANDROID',
      'receipt.purchaseToken': purchaseToken
    });

    if (existingPurchase) {
      return res.status(400).json({
        message: 'Purchase already processed'
      });
    }

    // Verify purchase with Google Play
    const verifiedPurchase = await verifyAndroidPurchase(purchaseToken, productId, subscriptionId);

    // Get subscription details
    const subscriptionTier = await db.collection('subscription_tiers').findOne({
      'productIds.android': productId
    });

    if (!subscriptionTier) {
      throw new Error('Invalid product ID');
    }

    // Calculate expiration date
    const expiresAt = new Date(parseInt(verifiedPurchase.expiryTimeMillis));

    // Record purchase
    const purchase = {
      userId: new ObjectId(req.user.id),
      platform: 'ANDROID',
      productId,
      subscriptionTierId: subscriptionTier._id,
      receipt: verifiedPurchase,
      status: 'ACTIVE',
      purchasedAt: new Date(parseInt(verifiedPurchase.startTimeMillis)),
      expiresAt,
      createdAt: new Date()
    };

    await db.collection('purchases').insertOne(purchase);

    // Update user subscription status
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.id) },
      {
        $set: {
          subscription: {
            status: 'ACTIVE',
            tier: subscriptionTier._id,
            expiresAt
          },
          updatedAt: new Date()
        }
      }
    );

    res.status(201).json({
      message: 'Purchase verified successfully',
      subscription: {
        status: 'ACTIVE',
        tier: subscriptionTier,
        expiresAt
      }
    });
  } catch (error) {
    throw error;
  }
});

// Get user's subscription status
router.get('/subscription/status', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const user = await db.collection('users')
      .aggregate([
        { $match: { _id: new ObjectId(req.user.id) } },
        {
          $lookup: {
            from: 'subscription_tiers',
            localField: 'subscription.tier',
            foreignField: '_id',
            as: 'subscriptionTier'
          }
        },
        { $unwind: { path: '$subscriptionTier', preserveNullAndEmptyArrays: true } }
      ])
      .next();

    if (!user.subscription) {
      return res.json({
        status: 'INACTIVE',
        message: 'No active subscription'
      });
    }

    // Check if subscription has expired
    if (new Date() > new Date(user.subscription.expiresAt)) {
      await db.collection('users').updateOne(
        { _id: new ObjectId(req.user.id) },
        {
          $set: {
            'subscription.status': 'EXPIRED',
            updatedAt: new Date()
          }
        }
      );

      return res.json({
        status: 'EXPIRED',
        message: 'Subscription has expired',
        expiresAt: user.subscription.expiresAt
      });
    }

    res.json({
      status: user.subscription.status,
      tier: user.subscriptionTier,
      expiresAt: user.subscription.expiresAt
    });
  } catch (error) {
    throw error;
  }
});

// Get user's purchase history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 10 } = req.query;

    const purchases = await db.collection('purchases')
      .aggregate([
        { $match: { userId: new ObjectId(req.user.id) } },
        {
          $lookup: {
            from: 'subscription_tiers',
            localField: 'subscriptionTierId',
            foreignField: '_id',
            as: 'tier'
          }
        },
        { $unwind: '$tier' },
        { $sort: { purchasedAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) }
      ])
      .toArray();

    const total = await db.collection('purchases')
      .countDocuments({ userId: new ObjectId(req.user.id) });

    res.json({
      purchases,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    throw error;
  }
});

// Admin: Create subscription tier
router.post('/admin/tiers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const validatedData = subscriptionTierSchema.parse(req.body);

    const tier = {
      ...validatedData,
      isActive: true,
      createdBy: new ObjectId(req.user.id),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('subscription_tiers').insertOne(tier);

    res.status(201).json({
      message: 'Subscription tier created successfully',
      tierId: result.insertedId
    });
  } catch (error) {
    throw error;
  }
});

// Admin: Update subscription tier
router.patch('/admin/tiers/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const tierId = new ObjectId(req.params.id);
    const validatedData = subscriptionTierSchema.parse(req.body);

    const result = await db.collection('subscription_tiers').findOneAndUpdate(
      { _id: tierId },
      {
        $set: {
          ...validatedData,
          updatedBy: new ObjectId(req.user.id),
          updatedAt: new Date()
        }
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
    const { startDate, endDate } = req.query;

    const query = {};
    if (startDate || endDate) {
      query.purchasedAt = {};
      if (startDate) query.purchasedAt.$gte = new Date(startDate);
      if (endDate) query.purchasedAt.$lte = new Date(endDate);
    }

    const [subscriptions, revenue, platforms, tiers] = await Promise.all([
      // Total active subscriptions
      db.collection('users').countDocuments({
        'subscription.status': 'ACTIVE'
      }),
      // Revenue analytics
      db.collection('purchases').aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'subscription_tiers',
            localField: 'subscriptionTierId',
            foreignField: '_id',
            as: 'tier'
          }
        },
        { $unwind: '$tier' },
        {
          $group: {
            _id: {
              year: { $year: '$purchasedAt' },
              month: { $month: '$purchasedAt' }
            },
            revenue: { $sum: '$tier.price' }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } }
      ]).toArray(),
      // Platform distribution
      db.collection('purchases').aggregate([
        { $match: query },
        {
          $group: {
            _id: '$platform',
            count: { $sum: 1 }
          }
        }
      ]).toArray(),
      // Subscription tier distribution
      db.collection('purchases').aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'subscription_tiers',
            localField: 'subscriptionTierId',
            foreignField: '_id',
            as: 'tier'
          }
        },
        { $unwind: '$tier' },
        {
          $group: {
            _id: '$tier.name',
            count: { $sum: 1 }
          }
        }
      ]).toArray()
    ]);

    res.json({
      activeSubscriptions: subscriptions,
      revenue,
      platforms,
      tiers
    });
  } catch (error) {
    throw error;
  }
});

export default router; 