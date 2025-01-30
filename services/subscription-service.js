const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');

class SubscriptionService {
  constructor() {
    this.PLATFORMS = {
      ANDROID: 'android',
      IOS: 'ios'
    };

    this.SUBSCRIPTION_STATUS = {
      ACTIVE: 'active',
      EXPIRED: 'expired',
      CANCELED: 'canceled',
      GRACE_PERIOD: 'grace_period',
      ON_HOLD: 'on_hold'
    };

    this.SUBSCRIPTION_TIERS = {
      FREE: 'free',
      BASIC: 'basic',
      PREMIUM: 'premium',
      PROFESSIONAL: 'professional'
    };

    this.TIER_LIMITS = {
      [this.SUBSCRIPTION_TIERS.FREE]: {
        recipes_per_month: 5,
        meal_plans: 1,
        price_alerts: 3,
        collections: 2,
        advanced_search: false,
        ad_free: false
      },
      [this.SUBSCRIPTION_TIERS.BASIC]: {
        recipes_per_month: 20,
        meal_plans: 3,
        price_alerts: 10,
        collections: 5,
        advanced_search: true,
        ad_free: false
      },
      [this.SUBSCRIPTION_TIERS.PREMIUM]: {
        recipes_per_month: 100,
        meal_plans: 10,
        price_alerts: 50,
        collections: 20,
        advanced_search: true,
        ad_free: true
      },
      [this.SUBSCRIPTION_TIERS.PROFESSIONAL]: {
        recipes_per_month: -1, // unlimited
        meal_plans: -1, // unlimited
        price_alerts: -1, // unlimited
        collections: -1, // unlimited
        advanced_search: true,
        ad_free: true
      }
    };

    // Initialize Google Play API client
    this.androidPublisher = google.androidpublisher('v3');
    this.initializeGoogleClient();
  }

  async initializeGoogleClient() {
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/androidpublisher']
      });
      this.googleAuth = auth;
    } catch (err) {
      console.error('Failed to initialize Google client:', err);
    }
  }

  async validateAndroidPurchase(packageName, subscriptionId, purchaseToken) {
    try {
      const auth = await this.googleAuth.getClient();
      const response = await this.androidPublisher.purchases.subscriptions.get({
        auth,
        packageName,
        subscriptionId,
        token: purchaseToken
      });

      return {
        isValid: response.data.paymentState === 1,
        expiryDate: new Date(parseInt(response.data.expiryTimeMillis)),
        autoRenewing: response.data.autoRenewing,
        purchaseState: response.data.purchaseState
      };
    } catch (err) {
      console.error('Android purchase validation error:', err);
      throw new Error('Failed to validate Android purchase');
    }
  }

  async validateIosPurchase(receiptData, isSandbox = false) {
    try {
      const endpoint = isSandbox
        ? 'https://sandbox.itunes.apple.com/verifyReceipt'
        : 'https://buy.itunes.apple.com/verifyReceipt';

      const response = await axios.post(endpoint, {
        'receipt-data': receiptData,
        password: process.env.APPLE_SHARED_SECRET
      });

      if (response.data.status === 21007) {
        // Receipt is from sandbox, retry with sandbox endpoint
        return this.validateIosPurchase(receiptData, true);
      }

      if (response.data.status !== 0) {
        throw new Error(`Apple validation failed with status ${response.data.status}`);
      }

      const latestReceipt = response.data.latest_receipt_info[0];
      return {
        isValid: true,
        expiryDate: new Date(parseInt(latestReceipt.expires_date_ms)),
        autoRenewing: latestReceipt.auto_renew_status === '1',
        productId: latestReceipt.product_id,
        originalTransactionId: latestReceipt.original_transaction_id
      };
    } catch (err) {
      console.error('iOS purchase validation error:', err);
      throw new Error('Failed to validate iOS purchase');
    }
  }

  async createOrUpdateSubscription(userId, platform, purchaseData) {
    const db = getDb();
    let validationResult;

    if (platform === this.PLATFORMS.ANDROID) {
      validationResult = await this.validateAndroidPurchase(
        purchaseData.packageName,
        purchaseData.subscriptionId,
        purchaseData.purchaseToken
      );
    } else {
      validationResult = await this.validateIosPurchase(purchaseData.receiptData);
    }

    const tier = await this.mapProductToTier(
      platform,
      platform === this.PLATFORMS.ANDROID ? purchaseData.subscriptionId : validationResult.productId
    );

    const subscription = {
      user_id: new ObjectId(userId),
      platform,
      product_id: platform === this.PLATFORMS.ANDROID ? purchaseData.subscriptionId : validationResult.productId,
      purchase_token: platform === this.PLATFORMS.ANDROID ? purchaseData.purchaseToken : purchaseData.receiptData,
      status: validationResult.isValid ? this.SUBSCRIPTION_STATUS.ACTIVE : this.SUBSCRIPTION_STATUS.EXPIRED,
      expiry_date: validationResult.expiryDate,
      auto_renewing: validationResult.autoRenewing,
      tier,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db.collection('user_subscriptions').updateOne(
      { user_id: subscription.user_id },
      { $set: subscription },
      { upsert: true }
    );

    // Log subscription change
    await this.logSubscriptionChange(userId, subscription);

    return subscription;
  }

  async logSubscriptionChange(userId, subscription) {
    const db = getDb();
    await db.collection('subscription_logs').insertOne({
      user_id: new ObjectId(userId),
      platform: subscription.platform,
      product_id: subscription.product_id,
      old_status: subscription.status,
      new_status: subscription.status,
      old_tier: subscription.tier,
      new_tier: subscription.tier,
      timestamp: new Date()
    });
  }

  async getSubscription(userId) {
    const db = getDb();
    return await db.collection('user_subscriptions').findOne({
      user_id: new ObjectId(userId)
    });
  }

  async handleGooglePlayNotification(message) {
    try {
      const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
      const { packageName, subscriptionId, purchaseToken } = data;

      const validationResult = await this.validateAndroidPurchase(
        packageName,
        subscriptionId,
        purchaseToken
      );

      const subscription = await db.collection('user_subscriptions').findOne({
        platform: this.PLATFORMS.ANDROID,
        purchase_token: purchaseToken
      });

      if (subscription) {
        await this.updateSubscriptionStatus(
          subscription.user_id,
          validationResult.isValid ? this.SUBSCRIPTION_STATUS.ACTIVE : this.SUBSCRIPTION_STATUS.EXPIRED,
          validationResult.expiryDate
        );
      }
    } catch (err) {
      console.error('Google Play notification handling error:', err);
    }
  }

  async handleAppStoreNotification(payload) {
    try {
      const { latest_receipt } = payload;
      const validationResult = await this.validateIosPurchase(latest_receipt);

      const subscription = await db.collection('user_subscriptions').findOne({
        platform: this.PLATFORMS.IOS,
        purchase_token: latest_receipt
      });

      if (subscription) {
        await this.updateSubscriptionStatus(
          subscription.user_id,
          validationResult.isValid ? this.SUBSCRIPTION_STATUS.ACTIVE : this.SUBSCRIPTION_STATUS.EXPIRED,
          validationResult.expiryDate
        );
      }
    } catch (err) {
      console.error('App Store notification handling error:', err);
    }
  }

  async updateSubscriptionStatus(userId, status, expiryDate) {
    const db = getDb();
    await db.collection('user_subscriptions').updateOne(
      { user_id: new ObjectId(userId) },
      {
        $set: {
          status,
          expiry_date: expiryDate,
          updated_at: new Date()
        }
      }
    );
  }

  async restorePurchases(userId, platform, purchaseData) {
    try {
      return await this.createOrUpdateSubscription(userId, platform, purchaseData);
    } catch (err) {
      console.error('Restore purchases error:', err);
      throw new Error('Failed to restore purchases');
    }
  }

  async isSubscriptionActive(userId) {
    const subscription = await this.getSubscription(userId);
    if (!subscription) return false;

    return (
      subscription.status === this.SUBSCRIPTION_STATUS.ACTIVE &&
      subscription.expiry_date > new Date()
    );
  }

  async getSubscriptionDetails(userId) {
    const subscription = await this.getSubscription(userId);
    if (!subscription) return null;

    const limits = await this.getFeatureLimits(userId);
    const usage = await this.getFeatureUsage(userId);

    return {
      status: subscription.status,
      expiryDate: subscription.expiry_date,
      autoRenewing: subscription.auto_renewing,
      platform: subscription.platform,
      productId: subscription.product_id,
      tier: subscription.tier,
      limits,
      usage
    };
  }

  async getFeatureLimits(userId) {
    const subscription = await this.getSubscription(userId);
    const tier = subscription?.tier || this.SUBSCRIPTION_TIERS.FREE;
    return this.TIER_LIMITS[tier];
  }

  async getFeatureUsage(userId) {
    const db = getDb();
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [recipeCount, mealPlanCount, priceAlertCount, collectionCount] = await Promise.all([
      db.collection('recipes').countDocuments({
        user_id: new ObjectId(userId),
        created_at: { $gte: firstDayOfMonth }
      }),
      db.collection('meal_plans').countDocuments({
        user_id: new ObjectId(userId)
      }),
      db.collection('price_alerts').countDocuments({
        user_id: new ObjectId(userId)
      }),
      db.collection('collections').countDocuments({
        user_id: new ObjectId(userId)
      })
    ]);

    return {
      recipes_per_month: recipeCount,
      meal_plans: mealPlanCount,
      price_alerts: priceAlertCount,
      collections: collectionCount
    };
  }

  async checkFeatureAccess(userId, feature, increment = false) {
    const limits = await this.getFeatureLimits(userId);
    const usage = await this.getFeatureUsage(userId);

    // If limit is -1, feature is unlimited
    if (limits[feature] === -1) return true;

    // For boolean features
    if (typeof limits[feature] === 'boolean') {
      return limits[feature];
    }

    // For numerical limits
    const currentUsage = usage[feature] || 0;
    const hasAccess = currentUsage < limits[feature];

    // Increment usage if requested and access is granted
    if (increment && hasAccess) {
      await this.incrementFeatureUsage(userId, feature);
    }

    return hasAccess;
  }

  async incrementFeatureUsage(userId, feature) {
    const db = getDb();
    const now = new Date();
    
    await db.collection('feature_usage').insertOne({
      user_id: new ObjectId(userId),
      feature,
      timestamp: now
    });
  }

  async mapProductToTier(platform, productId) {
    // Map store-specific product IDs to subscription tiers
    const productTierMap = {
      android: {
        'basic_monthly': this.SUBSCRIPTION_TIERS.BASIC,
        'basic_yearly': this.SUBSCRIPTION_TIERS.BASIC,
        'premium_monthly': this.SUBSCRIPTION_TIERS.PREMIUM,
        'premium_yearly': this.SUBSCRIPTION_TIERS.PREMIUM,
        'professional_monthly': this.SUBSCRIPTION_TIERS.PROFESSIONAL,
        'professional_yearly': this.SUBSCRIPTION_TIERS.PROFESSIONAL
      },
      ios: {
        'com.rezepta.basic.monthly': this.SUBSCRIPTION_TIERS.BASIC,
        'com.rezepta.basic.yearly': this.SUBSCRIPTION_TIERS.BASIC,
        'com.rezepta.premium.monthly': this.SUBSCRIPTION_TIERS.PREMIUM,
        'com.rezepta.premium.yearly': this.SUBSCRIPTION_TIERS.PREMIUM,
        'com.rezepta.professional.monthly': this.SUBSCRIPTION_TIERS.PROFESSIONAL,
        'com.rezepta.professional.yearly': this.SUBSCRIPTION_TIERS.PROFESSIONAL
      }
    };

    return productTierMap[platform]?.[productId] || this.SUBSCRIPTION_TIERS.FREE;
  }
}

module.exports = new SubscriptionService(); 