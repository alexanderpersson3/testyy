import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';
import Redis from 'ioredis';
import subscriptionManager from './subscription-manager.js';

class PriceHistoryManager {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.CACHE_TTL = 60 * 60; // 1 hour in seconds
    this.PRICE_HISTORY_CACHE_PREFIX = 'price:history:';
    this.LOWEST_PRICE_CACHE_PREFIX = 'price:lowest:';
    
    // Default history period in days
    this.DEFAULT_HISTORY_PERIOD = 90;
    
    // Aggregation periods
    this.AGGREGATION_PERIODS = {
      DAILY: 'daily',
      WEEKLY: 'weekly',
      MONTHLY: 'monthly'
    };
  }

  /**
   * Record a price for a product at a store
   * @param {string} productId Product ID
   * @param {string} storeId Store ID
   * @param {number} price Price
   * @returns {Promise<Object>} Created price record
   */
  async recordPrice(productId, storeId, price) {
    try {
      const db = getDb();
      const now = new Date();

      const priceRecord = {
        productId: new ObjectId(productId),
        storeId: new ObjectId(storeId),
        price: price,
        dateRecorded: now,
        createdAt: now
      };

      const result = await db.collection('price_history').insertOne(priceRecord);
      priceRecord._id = result.insertedId;

      // Invalidate caches
      await this.invalidateProductCache(productId);

      return priceRecord;
    } catch (error) {
      console.error('Error recording price:', error);
      throw error;
    }
  }

  /**
   * Get price history for a product
   * @param {string} productId Product ID
   * @param {string} userId User ID (for premium check)
   * @param {Object} options Query options
   * @returns {Promise<Object>} Price history data
   */
  async getPriceHistory(productId, userId, {
    startDate = null,
    endDate = null,
    period = this.AGGREGATION_PERIODS.DAILY
  } = {}) {
    try {
      // Check premium access
      const hasAccess = await subscriptionManager.hasPremiumAccess(userId);
      if (!hasAccess) {
        throw new Error('Premium subscription required to view price history');
      }

      // Try to get cached data
      const cacheKey = this.getCacheKey(productId, period, startDate, endDate);
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const db = getDb();
      const now = new Date();

      // Set default date range if not provided
      if (!startDate) {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - this.DEFAULT_HISTORY_PERIOD);
      }
      if (!endDate) {
        endDate = now;
      }

      // Build aggregation pipeline
      const pipeline = [
        {
          $match: {
            productId: new ObjectId(productId),
            dateRecorded: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        {
          $group: {
            _id: this.getGroupingExpression(period),
            lowestPrice: { $min: '$price' },
            averagePrice: { $avg: '$price' },
            highestPrice: { $max: '$price' },
            storeCount: { $addToSet: '$storeId' }
          }
        },
        {
          $project: {
            _id: 0,
            date: '$_id',
            lowestPrice: { $round: ['$lowestPrice', 2] },
            averagePrice: { $round: ['$averagePrice', 2] },
            highestPrice: { $round: ['$highestPrice', 2] },
            storeCount: { $size: '$storeCount' }
          }
        },
        {
          $sort: { date: 1 }
        }
      ];

      const history = await db.collection('price_history')
        .aggregate(pipeline)
        .toArray();

      // Get product details
      const product = await db.collection('products').findOne(
        { _id: new ObjectId(productId) },
        { projection: { name: 1, category: 1 } }
      );

      const result = {
        productId,
        productName: product?.name,
        category: product?.category,
        period,
        startDate,
        endDate,
        history
      };

      // Cache the result
      await this.redis.setex(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(result)
      );

      return result;
    } catch (error) {
      console.error('Error getting price history:', error);
      throw error;
    }
  }

  /**
   * Get lowest price stores for a product
   * @param {string} productId Product ID
   * @param {string} userId User ID (for premium check)
   * @returns {Promise<Object>} Lowest price store data
   */
  async getLowestPriceStores(productId, userId) {
    try {
      // Check premium access
      const hasAccess = await subscriptionManager.hasPremiumAccess(userId);
      if (!hasAccess) {
        throw new Error('Premium subscription required to view lowest prices');
      }

      const db = getDb();
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      // Get latest prices from each store
      const stores = await db.collection('price_history').aggregate([
        {
          $match: {
            productId: new ObjectId(productId),
            dateRecorded: { $gte: yesterday }
          }
        },
        {
          $sort: { dateRecorded: -1 }
        },
        {
          $group: {
            _id: '$storeId',
            price: { $first: '$price' },
            dateRecorded: { $first: '$dateRecorded' }
          }
        },
        {
          $lookup: {
            from: 'stores',
            localField: '_id',
            foreignField: '_id',
            as: 'store'
          }
        },
        {
          $unwind: '$store'
        },
        {
          $project: {
            _id: 0,
            storeId: '$_id',
            storeName: '$store.name',
            price: 1,
            dateRecorded: 1
          }
        },
        {
          $sort: { price: 1 }
        }
      ]).toArray();

      return {
        productId,
        stores
      };
    } catch (error) {
      console.error('Error getting lowest price stores:', error);
      throw error;
    }
  }

  /**
   * Get grouping expression for aggregation
   * @param {string} period Aggregation period
   * @returns {Object} MongoDB date grouping expression
   */
  getGroupingExpression(period) {
    switch (period) {
      case this.AGGREGATION_PERIODS.WEEKLY:
        return {
          $dateToString: {
            format: '%Y-%U',
            date: '$dateRecorded'
          }
        };
      case this.AGGREGATION_PERIODS.MONTHLY:
        return {
          $dateToString: {
            format: '%Y-%m',
            date: '$dateRecorded'
          }
        };
      default: // daily
        return {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$dateRecorded'
          }
        };
    }
  }

  /**
   * Get cache key for price history
   * @param {string} productId Product ID
   * @param {string} period Aggregation period
   * @param {Date} startDate Start date
   * @param {Date} endDate End date
   * @returns {string} Cache key
   */
  getCacheKey(productId, period, startDate, endDate) {
    return `${this.PRICE_HISTORY_CACHE_PREFIX}${productId}:${period}:${startDate}:${endDate}`;
  }

  /**
   * Invalidate product cache
   * @param {string} productId Product ID
   * @returns {Promise<void>}
   */
  async invalidateProductCache(productId) {
    try {
      const keys = await this.redis.keys(`${this.PRICE_HISTORY_CACHE_PREFIX}${productId}:*`);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch (error) {
      console.error('Error invalidating product cache:', error);
    }
  }

  /**
   * Clean up old price history records
   * @param {number} days Number of days to keep
   * @returns {Promise<Object>} Delete result
   */
  async cleanupOldRecords(days = 90) {
    try {
      const db = getDb();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      return await db.collection('price_history').deleteMany({
        dateRecorded: { $lt: cutoffDate }
      });
    } catch (error) {
      console.error('Error cleaning up old records:', error);
      throw error;
    }
  }
}

export default new PriceHistoryManager(); 