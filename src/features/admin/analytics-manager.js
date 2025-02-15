import { getDb } from '../../config/db.js';
import { ObjectId } from 'mongodb';
import Redis from 'ioredis';

class AdminAnalyticsManager {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.CACHE_TTL = 60 * 5; // 5 minutes in seconds
    this.STATS_CACHE_PREFIX = 'admin:stats:';
  }

  /**
   * Get user statistics
   * @param {Object} options Query options
   * @returns {Promise<Object>} User statistics
   */
  async getUserStats({ period = '24h' } = {}) {
    try {
      const cacheKey = `${this.STATS_CACHE_PREFIX}users:${period}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const db = getDb();
      const now = new Date();
      const periodStart = this.getPeriodStart(now, period);

      // Get total users
      const totalUsers = await db.collection('users').countDocuments();

      // Get new users in period
      const newUsers = await db.collection('users').countDocuments({
        createdAt: { $gte: periodStart },
      });

      // Get active users in period
      const activeUsers = await db.collection('users').countDocuments({
        lastLoginAt: { $gte: periodStart },
      });

      // Get premium users
      const premiumUsers = await db.collection('users').countDocuments({
        subscriptionType: 'premium',
        subscriptionEndDate: { $gt: now },
      });

      // Get banned users
      const bannedUsers = await db.collection('users').countDocuments({
        status: 'banned',
      });

      const stats = {
        timestamp: now,
        period,
        totalUsers,
        newUsers,
        activeUsers,
        premiumUsers,
        bannedUsers,
      };

      // Cache the results
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(stats));

      return stats;
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  /**
   * Get recipe statistics
   * @param {Object} options Query options
   * @returns {Promise<Object>} Recipe statistics
   */
  async getRecipeStats({ period = '24h' } = {}) {
    try {
      const cacheKey = `${this.STATS_CACHE_PREFIX}recipes:${period}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const db = getDb();
      const now = new Date();
      const periodStart = this.getPeriodStart(now, period);

      // Get total recipes
      const totalRecipes = await db.collection('recipes').countDocuments();

      // Get new recipes in period
      const newRecipes = await db.collection('recipes').countDocuments({
        createdAt: { $gte: periodStart },
      });

      // Get top recipes by views
      const topRecipes = await db
        .collection('recipes')
        .aggregate([
          {
            $match: {
              createdAt: { $gte: periodStart },
            },
          },
          {
            $sort: { viewCount: -1 },
          },
          {
            $limit: 10,
          },
          {
            $project: {
              _id: 1,
              title: 1,
              viewCount: 1,
              likeCount: 1,
              saveCount: 1,
            },
          },
        ])
        .toArray();

      const stats = {
        timestamp: now,
        period,
        totalRecipes,
        newRecipes,
        topRecipes,
      };

      // Cache the results
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(stats));

      return stats;
    } catch (error) {
      console.error('Error getting recipe stats:', error);
      throw error;
    }
  }

  /**
   * Get revenue statistics
   * @param {Object} options Query options
   * @returns {Promise<Object>} Revenue statistics
   */
  async getRevenueStats({ period = '24h' } = {}) {
    try {
      const cacheKey = `${this.STATS_CACHE_PREFIX}revenue:${period}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const db = getDb();
      const now = new Date();
      const periodStart = this.getPeriodStart(now, period);

      // Get subscription revenue
      const subscriptionRevenue = await db
        .collection('payments')
        .aggregate([
          {
            $match: {
              type: 'subscription',
              status: 'completed',
              createdAt: { $gte: periodStart },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' },
            },
          },
        ])
        .next();

      // Get ad revenue (if tracked in your system)
      const adRevenue = await db
        .collection('ad_revenue')
        .aggregate([
          {
            $match: {
              date: { $gte: periodStart },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' },
            },
          },
        ])
        .next();

      const stats = {
        timestamp: now,
        period,
        subscriptionRevenue: subscriptionRevenue?.total || 0,
        adRevenue: adRevenue?.total || 0,
        totalRevenue: (subscriptionRevenue?.total || 0) + (adRevenue?.total || 0),
      };

      // Cache the results
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(stats));

      return stats;
    } catch (error) {
      console.error('Error getting revenue stats:', error);
      throw error;
    }
  }

  /**
   * Get period start date
   * @param {Date} now Current date
   * @param {string} period Period string
   * @returns {Date} Period start date
   */
  getPeriodStart(now, period) {
    const date = new Date(now);
    switch (period) {
      case '24h':
        date.setHours(date.getHours() - 24);
        break;
      case '7d':
        date.setDate(date.getDate() - 7);
        break;
      case '30d':
        date.setDate(date.getDate() - 30);
        break;
      case '90d':
        date.setDate(date.getDate() - 90);
        break;
      default:
        date.setHours(date.getHours() - 24);
    }
    return date;
  }

  /**
   * Invalidate stats cache
   * @returns {Promise<void>}
   */
  async invalidateCache() {
    try {
      const keys = await this.redis.keys(`${this.STATS_CACHE_PREFIX}*`);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch (error) {
      console.error('Error invalidating stats cache:', error);
    }
  }
}

export default new AdminAnalyticsManager();
