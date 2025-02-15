import { ObjectId } from 'mongodb';
import axios from 'axios';
import { google } from 'googleapis';
import { databaseService } from '../../core/database/database.service';
import {
  Platform,
  SubscriptionStatus,
  SubscriptionTier,
  TierLimits,
  AndroidPurchaseData,
  IosPurchaseData,
  PurchaseData,
  AndroidValidationResult,
  IosValidationResult,
  Subscription,
  SubscriptionLog,
  FeatureUsage,
  SubscriptionDetails,
  GooglePlayNotification,
  AppStoreNotification,
  ProductTierMapping
} from './types';

class SubscriptionService {
  private static instance: SubscriptionService;
  private androidPublisher: any; // Type from googleapis
  private googleAuth: any; // Type from googleapis
  
  private readonly TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
    [SubscriptionTier.FREE]: {
      recipes_per_month: 5,
      meal_plans: 1,
      price_alerts: 3,
      collections: 2,
      advanced_search: false,
      ad_free: false,
    },
    [SubscriptionTier.BASIC]: {
      recipes_per_month: 20,
      meal_plans: 3,
      price_alerts: 10,
      collections: 5,
      advanced_search: true,
      ad_free: false,
    },
    [SubscriptionTier.PREMIUM]: {
      recipes_per_month: 100,
      meal_plans: 10,
      price_alerts: 50,
      collections: 20,
      advanced_search: true,
      ad_free: true,
    },
    [SubscriptionTier.PROFESSIONAL]: {
      recipes_per_month: -1, // unlimited
      meal_plans: -1, // unlimited
      price_alerts: -1, // unlimited
      collections: -1, // unlimited
      advanced_search: true,
      ad_free: true,
    },
  };

  private constructor() {
    this.androidPublisher = google.androidpublisher('v3');
    this.initializeGoogleClient();
  }

  public static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  private async initializeGoogleClient(): Promise<void> {
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      });
      this.googleAuth = auth;
    } catch (err) {
      console.error('Failed to initialize Google client:', err);
      throw err;
    }
  }

  async validateAndroidPurchase(
    packageName: string,
    subscriptionId: string,
    purchaseToken: string
  ): Promise<AndroidValidationResult> {
    try {
      const auth = await this.googleAuth.getClient();
      const response = await this.androidPublisher.purchases.subscriptions.get({
        auth,
        packageName,
        subscriptionId,
        token: purchaseToken,
      });

      return {
        isValid: response.data.paymentState === 1,
        expiryDate: new Date(parseInt(response.data.expiryTimeMillis)),
        autoRenewing: response.data.autoRenewing,
        purchaseState: response.data.purchaseState,
      };
    } catch (err) {
      console.error('Android purchase validation error:', err);
      throw new Error('Failed to validate Android purchase');
    }
  }

  async validateIosPurchase(
    receiptData: string,
    isSandbox = false
  ): Promise<IosValidationResult> {
    try {
      const endpoint = isSandbox
        ? 'https://sandbox.itunes.apple.com/verifyReceipt'
        : 'https://buy.itunes.apple.com/verifyReceipt';

      const response = await axios.post(endpoint, {
        'receipt-data': receiptData,
        password: process.env.APPLE_SHARED_SECRET,
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
        originalTransactionId: latestReceipt.original_transaction_id,
      };
    } catch (err) {
      console.error('iOS purchase validation error:', err);
      throw new Error('Failed to validate iOS purchase');
    }
  }

  async createOrUpdateSubscription(
    userId: string,
    platform: Platform,
    purchaseData: PurchaseData
  ): Promise<Subscription> {
    const db = databaseService.getDb();
    let validationResult: AndroidValidationResult | IosValidationResult;

    if (platform === Platform.ANDROID) {
      const androidData = purchaseData as AndroidPurchaseData;
      validationResult = await this.validateAndroidPurchase(
        androidData.packageName,
        androidData.subscriptionId,
        androidData.purchaseToken
      );
    } else {
      const iosData = purchaseData as IosPurchaseData;
      validationResult = await this.validateIosPurchase(iosData.receiptData);
    }

    const tier = await this.mapProductToTier(
      platform,
      platform === Platform.ANDROID
        ? (purchaseData as AndroidPurchaseData).subscriptionId
        : (validationResult as IosValidationResult).productId
    );

    const subscription: Subscription = {
      user_id: new ObjectId(userId),
      platform,
      product_id:
        platform === Platform.ANDROID
          ? (purchaseData as AndroidPurchaseData).subscriptionId
          : (validationResult as IosValidationResult).productId,
      purchase_token:
        platform === Platform.ANDROID
          ? (purchaseData as AndroidPurchaseData).purchaseToken
          : (purchaseData as IosPurchaseData).receiptData,
      status: validationResult.isValid
        ? SubscriptionStatus.ACTIVE
        : SubscriptionStatus.EXPIRED,
      expiry_date: validationResult.expiryDate,
      auto_renewing: validationResult.autoRenewing,
      tier,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db
      .collection<Subscription>('user_subscriptions')
      .updateOne(
        { user_id: subscription.user_id },
        { $set: subscription },
        { upsert: true }
      );

    // Log subscription change
    await this.logSubscriptionChange(userId, subscription);

    return subscription;
  }

  private async logSubscriptionChange(
    userId: string,
    subscription: Subscription
  ): Promise<void> {
    const db = databaseService.getDb();
    const log: SubscriptionLog = {
      user_id: new ObjectId(userId),
      platform: subscription.platform,
      product_id: subscription.product_id,
      old_status: subscription.status,
      new_status: subscription.status,
      old_tier: subscription.tier,
      new_tier: subscription.tier,
      timestamp: new Date(),
    };
    await db.collection<SubscriptionLog>('subscription_logs').insertOne(log);
  }

  async getSubscription(userId: string): Promise<Subscription | null> {
    const db = databaseService.getDb();
    return await db
      .collection<Subscription>('user_subscriptions')
      .findOne({ user_id: new ObjectId(userId) });
  }

  async handleGooglePlayNotification(message: GooglePlayNotification): Promise<void> {
    try {
      const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
      const { packageName, subscriptionId, purchaseToken } = data;

      const validationResult = await this.validateAndroidPurchase(
        packageName,
        subscriptionId,
        purchaseToken
      );

      const db = databaseService.getDb();
      const subscription = await db
        .collection<Subscription>('user_subscriptions')
        .findOne({
          platform: Platform.ANDROID,
          purchase_token: purchaseToken,
        });

      if (subscription) {
        await this.updateSubscriptionStatus(
          subscription.user_id.toString(),
          validationResult.isValid
            ? SubscriptionStatus.ACTIVE
            : SubscriptionStatus.EXPIRED,
          validationResult.expiryDate
        );
      }
    } catch (err) {
      console.error('Google Play notification handling error:', err);
      throw err;
    }
  }

  async handleAppStoreNotification(payload: AppStoreNotification): Promise<void> {
    try {
      const { latest_receipt } = payload;
      const validationResult = await this.validateIosPurchase(latest_receipt);

      const db = databaseService.getDb();
      const subscription = await db
        .collection<Subscription>('user_subscriptions')
        .findOne({
          platform: Platform.IOS,
          purchase_token: latest_receipt,
        });

      if (subscription) {
        await this.updateSubscriptionStatus(
          subscription.user_id.toString(),
          validationResult.isValid
            ? SubscriptionStatus.ACTIVE
            : SubscriptionStatus.EXPIRED,
          validationResult.expiryDate
        );
      }
    } catch (err) {
      console.error('App Store notification handling error:', err);
      throw err;
    }
  }

  async updateSubscriptionStatus(
    userId: string,
    status: SubscriptionStatus,
    expiryDate: Date
  ): Promise<void> {
    const db = databaseService.getDb();
    await db.collection<Subscription>('user_subscriptions').updateOne(
      { user_id: new ObjectId(userId) },
      {
        $set: {
          status,
          expiry_date: expiryDate,
          updated_at: new Date(),
        },
      }
    );
  }

  async isSubscriptionActive(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    if (!subscription) return false;

    return (
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.expiry_date > new Date()
    );
  }

  async getSubscriptionDetails(userId: string): Promise<SubscriptionDetails> {
    const subscription = await this.getSubscription(userId);
    const usage = await this.getFeatureUsage(userId);
    const tier = subscription?.tier || SubscriptionTier.FREE;

    return {
      isActive: subscription?.status === SubscriptionStatus.ACTIVE,
      tier,
      expiryDate: subscription?.expiry_date,
      autoRenewing: subscription?.auto_renewing || false,
      limits: this.TIER_LIMITS[tier],
      usage,
    };
  }

  private async getFeatureUsage(userId: string): Promise<FeatureUsage> {
    const db = databaseService.getDb();
    const usage = await db
      .collection<FeatureUsage>('feature_usage')
      .findOne({ user_id: new ObjectId(userId) });

    if (!usage) {
      const newUsage: FeatureUsage = {
        user_id: new ObjectId(userId),
        recipes_created: 0,
        meal_plans_created: 0,
        price_alerts_set: 0,
        collections_created: 0,
        last_reset: new Date(),
      };
      await db.collection<FeatureUsage>('feature_usage').insertOne(newUsage);
      return newUsage;
    }

    return usage;
  }

  private async mapProductToTier(
    platform: Platform,
    productId: string
  ): Promise<SubscriptionTier> {
    // This would typically be loaded from a database or configuration
    const productTierMapping: ProductTierMapping = {
      'com.rezepta.basic': SubscriptionTier.BASIC,
      'com.rezepta.premium': SubscriptionTier.PREMIUM,
      'com.rezepta.professional': SubscriptionTier.PROFESSIONAL,
    };

    return productTierMapping[productId] || SubscriptionTier.FREE;
  }
}

// Export singleton instance
export const subscriptionService = SubscriptionService.getInstance();
export { SubscriptionService }; 