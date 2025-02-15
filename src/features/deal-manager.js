import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';
import Redis from 'ioredis';

class DealManager {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.CACHE_TTL = 60 * 60; // 1 hour in seconds
    this.DEALS_CACHE_KEY = 'deals:top';
  }

  /**
   * Save or update deals from a store
   * @param {string} storeId Store ID
   * @param {Array} deals Array of deals
   * @returns {Promise<number>} Number of deals processed
   */
  async saveDealBatch(storeId, deals) {
    try {
      const db = getDb();
      const operations = deals.map(deal => ({
        updateOne: {
          filter: {
            storeId,
            productId: deal.productId,
            startDate: deal.startDate,
            endDate: deal.endDate,
          },
          update: {
            $set: {
              ...deal,
              discountPercentage: this.calculateDiscountPercentage(
                deal.normalPrice,
                deal.salePrice
              ),
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));

      const result = await db.collection('deals').bulkWrite(operations);
      await this.invalidateCache();

      return result.upsertedCount + result.modifiedCount;
    } catch (error) {
      console.error('Error saving deals:', error);
      throw error;
    }
  }

  /**
   * Calculate discount percentage
   * @param {number} normalPrice Original price
   * @param {number} salePrice Sale price
   * @returns {number} Discount percentage
   */
  calculateDiscountPercentage(normalPrice, salePrice) {
    if (!normalPrice || !salePrice || normalPrice <= 0) return 0;
    return Math.round(((normalPrice - salePrice) / normalPrice) * 100);
  }

  /**
   * Calculate deal score based on various factors
   * @param {Object} deal Deal object
   * @param {Object} options Scoring options
   * @returns {number} Deal score
   */
  calculateDealScore(deal, { timeNow = new Date() } = {}) {
    const weights = {
      discount: 0.4,
      popularity: 0.3,
      timeDecay: 0.3,
    };

    // Discount score (0-100)
    const discountScore = deal.discountPercentage;

    // Popularity score (0-100)
    const popularityScore = Math.min(100, ((deal.viewCount || 0) + (deal.saveCount || 0) * 5) / 10);

    // Time decay score (0-100)
    const daysLeft = (deal.endDate - timeNow) / (1000 * 60 * 60 * 24);
    const timeDecayScore = Math.max(0, Math.min(100, daysLeft * 20));

    // Calculate final score
    return (
      weights.discount * discountScore +
      weights.popularity * popularityScore +
      weights.timeDecay * timeDecayScore
    );
  }

  /**
   * Get top deals with optional filtering and personalization
   * @param {Object} options Query options
   * @returns {Promise<Array>} Deals
   */
  async getTopDeals({
    limit = 20,
    offset = 0,
    storeId = null,
    category = null,
    userId = null,
  } = {}) {
    try {
      const db = getDb();
      const timeNow = new Date();
      const pipeline = [];

      // Match active deals
      pipeline.push({
        $match: {
          startDate: { $lte: timeNow },
          endDate: { $gt: timeNow },
        },
      });

      // Apply filters
      if (storeId) {
        pipeline.push({ $match: { storeId: new ObjectId(storeId) } });
      }
      if (category) {
        pipeline.push({ $match: { category } });
      }

      // If user provided, get their preferences
      let userPreferences = null;
      if (userId) {
        const user = await db
          .collection('users')
          .findOne({ _id: new ObjectId(userId) }, { projection: { preferences: 1 } });
        userPreferences = user?.preferences;
      }

      // Join with products for additional details
      pipeline.push({
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      });
      pipeline.push({ $unwind: '$product' });

      // Calculate scores
      pipeline.push({
        $addFields: {
          score: {
            $add: [
              { $multiply: ['$discountPercentage', 0.4] },
              {
                $multiply: [
                  {
                    $add: [
                      { $ifNull: ['$viewCount', 0] },
                      { $multiply: [{ $ifNull: ['$saveCount', 0] }, 5] },
                    ],
                  },
                  0.3,
                ],
              },
              {
                $multiply: [
                  {
                    $min: [
                      100,
                      {
                        $multiply: [
                          {
                            $divide: [
                              { $subtract: ['$endDate', timeNow] },
                              1000 * 60 * 60 * 24, // Convert to days
                            ],
                          },
                          20,
                        ],
                      },
                    ],
                  },
                  0.3,
                ],
              },
            ],
          },
        },
      });

      // Apply user preferences boost if available
      if (userPreferences) {
        pipeline.push({
          $addFields: {
            score: {
              $add: [
                '$score',
                {
                  $cond: {
                    if: {
                      $or: [
                        { $in: ['$product.category', userPreferences.categories || []] },
                        { $in: ['$storeId', userPreferences.stores || []] },
                      ],
                    },
                    then: 20,
                    else: 0,
                  },
                },
              ],
            },
          },
        });
      }

      // Sort and paginate
      pipeline.push({ $sort: { score: -1 } }, { $skip: offset }, { $limit: limit });

      // Project final fields
      pipeline.push({
        $project: {
          _id: 1,
          productId: 1,
          storeId: 1,
          startDate: 1,
          endDate: 1,
          salePrice: 1,
          normalPrice: 1,
          discountPercentage: 1,
          title: 1,
          description: 1,
          score: 1,
          product: {
            name: 1,
            category: 1,
            image: 1,
            unit: 1,
          },
        },
      });

      return await db.collection('deals').aggregate(pipeline).toArray();
    } catch (error) {
      console.error('Error getting top deals:', error);
      throw error;
    }
  }

  /**
   * Mark expired deals as inactive
   * @returns {Promise<number>} Number of deals marked as expired
   */
  async markExpiredDeals() {
    try {
      const db = getDb();
      const result = await db.collection('deals').updateMany(
        {
          endDate: { $lte: new Date() },
          isActive: true,
        },
        {
          $set: {
            isActive: false,
            updatedAt: new Date(),
          },
        }
      );

      if (result.modifiedCount > 0) {
        await this.invalidateCache();
      }

      return result.modifiedCount;
    } catch (error) {
      console.error('Error marking expired deals:', error);
      throw error;
    }
  }

  /**
   * Cache top deals
   * @param {Array} deals Deals to cache
   * @returns {Promise<void>}
   */
  async cacheTopDeals(deals) {
    try {
      await this.redis.setex(this.DEALS_CACHE_KEY, this.CACHE_TTL, JSON.stringify(deals));
    } catch (error) {
      console.error('Error caching deals:', error);
      // Don't throw, just log the error
    }
  }

  /**
   * Get cached top deals
   * @returns {Promise<Array|null>} Cached deals or null
   */
  async getCachedTopDeals() {
    try {
      const cached = await this.redis.get(this.DEALS_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting cached deals:', error);
      return null;
    }
  }

  /**
   * Invalidate deals cache
   * @returns {Promise<void>}
   */
  async invalidateCache() {
    try {
      await this.redis.del(this.DEALS_CACHE_KEY);
    } catch (error) {
      console.error('Error invalidating cache:', error);
      // Don't throw, just log the error
    }
  }

  /**
   * Track deal interaction (view, save)
   * @param {string} dealId Deal ID
   * @param {string} type Interaction type
   * @returns {Promise<void>}
   */
  async trackDealInteraction(dealId, type) {
    try {
      const db = getDb();
      const update = {};

      if (type === 'view') {
        update.$inc = { viewCount: 1 };
      } else if (type === 'save') {
        update.$inc = { saveCount: 1 };
      }

      if (Object.keys(update).length > 0) {
        await db.collection('deals').updateOne({ _id: new ObjectId(dealId) }, update);
      }
    } catch (error) {
      console.error('Error tracking deal interaction:', error);
      // Don't throw, just log the error
    }
  }
}

export default new DealManager();
