import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';
import Redis from 'ioredis';
import notificationManager from './notification-manager.js';

class SubscriptionManager {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.CACHE_TTL = 60 * 60; // 1 hour in seconds
    this.USER_SUBSCRIPTION_CACHE_PREFIX = 'user:subscription:';

    // Subscription types
    this.SUBSCRIPTION_TYPES = {
      FREE: 'free',
      TRIAL: 'trial',
      PREMIUM: 'premium'
    };

    // Trial duration in days
    this.TRIAL_DURATION_DAYS = 7;

    // Premium features
    this.PREMIUM_FEATURES = [
      'offline_access',
      'meal_planning',
      'advanced_search',
      'custom_lists',
      'nutritional_insights',
      'ad_free'
    ];
  }

  /**
   * Start a free trial for a user
   * @param {string} userId User ID
   * @returns {Promise<Object>} Trial details
   */
  async startTrial(userId) {
    try {
      const db = getDb();
      const now = new Date();
      const trialEndDate = new Date(now);
      trialEndDate.setDate(trialEndDate.getDate() + this.TRIAL_DURATION_DAYS);

      // Check if user is eligible for trial
      const user = await db.collection('users').findOne({
        _id: new ObjectId(userId)
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.hasUsedTrial) {
        throw new Error('User has already used their free trial');
      }

      // Start trial
      const result = await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        {
          $set: {
            subscriptionType: this.SUBSCRIPTION_TYPES.TRIAL,
            trialStartDate: now,
            trialEndDate: trialEndDate,
            hasUsedTrial: true,
            updatedAt: now
          }
        },
        { returnDocument: 'after' }
      );

      // Create subscription record
      await db.collection('subscriptions').insertOne({
        userId: new ObjectId(userId),
        type: this.SUBSCRIPTION_TYPES.TRIAL,
        startDate: now,
        endDate: trialEndDate,
        status: 'active',
        createdAt: now,
        updatedAt: now
      });

      // Invalidate cache
      await this.invalidateUserCache(userId);

      // Schedule trial end notification
      const notificationDate = new Date(trialEndDate);
      notificationDate.setDate(notificationDate.getDate() - 1);
      
      await notificationManager.createNotification({
        userId,
        type: 'TRIAL_ENDING',
        senderUserId: userId,
        extraData: {
          endDate: trialEndDate,
          scheduledFor: notificationDate
        }
      });

      return {
        subscriptionType: result.subscriptionType,
        trialStartDate: result.trialStartDate,
        trialEndDate: result.trialEndDate
      };
    } catch (error) {
      console.error('Error starting trial:', error);
      throw error;
    }
  }

  /**
   * Check if user has access to premium features
   * @param {string} userId User ID
   * @param {string} feature Feature to check
   * @returns {Promise<boolean>} Whether user has access
   */
  async hasPremiumAccess(userId, feature = null) {
    try {
      // Try to get cached subscription
      const cacheKey = `${this.USER_SUBSCRIPTION_CACHE_PREFIX}${userId}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const subscription = JSON.parse(cached);
        return this.checkAccess(subscription, feature);
      }

      const db = getDb();
      const user = await db.collection('users').findOne({
        _id: new ObjectId(userId)
      });

      if (!user) {
        return false;
      }

      // Cache subscription data
      await this.redis.setex(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify({
          subscriptionType: user.subscriptionType,
          trialEndDate: user.trialEndDate
        })
      );

      return this.checkAccess({
        subscriptionType: user.subscriptionType,
        trialEndDate: user.trialEndDate
      }, feature);
    } catch (error) {
      console.error('Error checking premium access:', error);
      return false;
    }
  }

  /**
   * Check access based on subscription data
   * @param {Object} subscription Subscription data
   * @param {string} feature Feature to check
   * @returns {boolean} Whether user has access
   */
  checkAccess(subscription, feature = null) {
    const now = new Date();

    // If specific feature is requested, check if it's a premium feature
    if (feature && !this.PREMIUM_FEATURES.includes(feature)) {
      return true; // Non-premium features are always accessible
    }

    // Check subscription type
    switch (subscription.subscriptionType) {
      case this.SUBSCRIPTION_TYPES.PREMIUM:
        return true;
      case this.SUBSCRIPTION_TYPES.TRIAL:
        return new Date(subscription.trialEndDate) > now;
      default:
        return false;
    }
  }

  /**
   * End expired trials
   * @returns {Promise<Object>} Update result
   */
  async endExpiredTrials() {
    try {
      const db = getDb();
      const now = new Date();

      // Find users with expired trials
      const expiredTrials = await db.collection('users')
        .find({
          subscriptionType: this.SUBSCRIPTION_TYPES.TRIAL,
          trialEndDate: { $lt: now }
        })
        .toArray();

      if (expiredTrials.length === 0) {
        return { modifiedCount: 0 };
      }

      // Update users
      const result = await db.collection('users').updateMany(
        {
          _id: { $in: expiredTrials.map(user => user._id) }
        },
        {
          $set: {
            subscriptionType: this.SUBSCRIPTION_TYPES.FREE,
            updatedAt: now
          }
        }
      );

      // Update subscription records
      await db.collection('subscriptions').updateMany(
        {
          userId: { $in: expiredTrials.map(user => user._id) },
          type: this.SUBSCRIPTION_TYPES.TRIAL,
          status: 'active'
        },
        {
          $set: {
            status: 'expired',
            updatedAt: now
          }
        }
      );

      // Invalidate cache for all affected users
      await Promise.all(
        expiredTrials.map(user => 
          this.invalidateUserCache(user._id.toString())
        )
      );

      // Send trial ended notifications
      await Promise.all(
        expiredTrials.map(user =>
          notificationManager.createNotification({
            userId: user._id.toString(),
            type: 'TRIAL_ENDED',
            senderUserId: user._id.toString()
          })
        )
      );

      return result;
    } catch (error) {
      console.error('Error ending expired trials:', error);
      throw error;
    }
  }

  /**
   * Upgrade to premium
   * @param {string} userId User ID
   * @returns {Promise<Object>} Updated subscription
   */
  async upgradeToPremium(userId) {
    try {
      const db = getDb();
      const now = new Date();

      // Update user
      const result = await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        {
          $set: {
            subscriptionType: this.SUBSCRIPTION_TYPES.PREMIUM,
            updatedAt: now
          }
        },
        { returnDocument: 'after' }
      );

      // Create subscription record
      await db.collection('subscriptions').insertOne({
        userId: new ObjectId(userId),
        type: this.SUBSCRIPTION_TYPES.PREMIUM,
        startDate: now,
        status: 'active',
        createdAt: now,
        updatedAt: now
      });

      // Invalidate cache
      await this.invalidateUserCache(userId);

      return {
        subscriptionType: result.subscriptionType,
        updatedAt: result.updatedAt
      };
    } catch (error) {
      console.error('Error upgrading to premium:', error);
      throw error;
    }
  }

  /**
   * Get subscription details
   * @param {string} userId User ID
   * @returns {Promise<Object>} Subscription details
   */
  async getSubscriptionDetails(userId) {
    try {
      const db = getDb();
      const user = await db.collection('users').findOne({
        _id: new ObjectId(userId)
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        subscriptionType: user.subscriptionType,
        trialStartDate: user.trialStartDate,
        trialEndDate: user.trialEndDate,
        hasUsedTrial: user.hasUsedTrial
      };
    } catch (error) {
      console.error('Error getting subscription details:', error);
      throw error;
    }
  }

  /**
   * Invalidate user cache
   * @param {string} userId User ID
   * @returns {Promise<void>}
   */
  async invalidateUserCache(userId) {
    try {
      await this.redis.del(`${this.USER_SUBSCRIPTION_CACHE_PREFIX}${userId}`);
    } catch (error) {
      console.error('Error invalidating user cache:', error);
    }
  }
}

export default new SubscriptionManager(); 