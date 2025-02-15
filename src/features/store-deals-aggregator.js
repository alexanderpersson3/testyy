import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';
import Redis from 'ioredis';

class StoreDealAggregator {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.CACHE_TTL = 60 * 60; // 1 hour in seconds
    this.STORES_CACHE_KEY = 'stores:all';
    this.STORE_DEALS_CACHE_PREFIX = 'store:deals:';
    this.TOP_DEALS_CACHE_KEY = 'deals:top';

    // Standard categories for mapping store-specific categories
    this.STANDARD_CATEGORIES = [
      'produce',
      'dairy',
      'meat',
      'seafood',
      'bakery',
      'pantry',
      'snacks',
      'beverages',
      'household',
    ];
  }

  /**
   * Get all stores
   * @returns {Promise<Array>} List of stores
   */
  async getStores() {
    try {
      // Try to get cached stores first
      const cached = await this.redis.get(this.STORES_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }

      const db = getDb();
      const stores = await db
        .collection('stores')
        .find({}, { projection: { name: 1, logo: 1, description: 1 } })
        .toArray();

      // Cache stores
      await this.redis.setex(this.STORES_CACHE_KEY, this.CACHE_TTL, JSON.stringify(stores));

      return stores;
    } catch (error) {
      console.error('Error getting stores:', error);
      throw error;
    }
  }

  /**
   * Get deals for a specific store
   * @param {string} storeId Store ID
   * @param {Object} options Query options
   * @returns {Promise<Object>} Deals and total count
   */
  async getStoreDeals(
    storeId,
    { category, minPrice, maxPrice, sortBy = 'discountDesc', page = 1, limit = 20 } = {}
  ) {
    try {
      const db = getDb();
      const now = new Date();

      // Base query
      const query = {
        storeId: new ObjectId(storeId),
        startDate: { $lte: now },
        endDate: { $gt: now },
      };

      // Apply filters
      if (category) {
        query.category = category;
      }
      if (minPrice !== undefined) {
        query.dealPrice = { $gte: minPrice };
      }
      if (maxPrice !== undefined) {
        query.dealPrice = { ...query.dealPrice, $lte: maxPrice };
      }

      // Determine sort order
      const sortOptions = {
        discountDesc: { discountPercentage: -1 },
        priceAsc: { dealPrice: 1 },
        priceDesc: { dealPrice: -1 },
        popularityDesc: { viewCount: -1 },
      };

      const sort = sortOptions[sortBy] || sortOptions.discountDesc;

      // Calculate skip value
      const skip = (page - 1) * limit;

      // Get deals with pagination
      const [deals, totalCount] = await Promise.all([
        db
          .collection('deals')
          .aggregate([
            { $match: query },
            {
              $lookup: {
                from: 'products',
                localField: 'productId',
                foreignField: '_id',
                as: 'product',
              },
            },
            { $unwind: '$product' },
            { $sort: sort },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                productName: '$product.name',
                productImage: '$product.image',
                dealPrice: 1,
                regularPrice: 1,
                discountPercentage: 1,
                startDate: 1,
                endDate: 1,
                category: 1,
                viewCount: 1,
              },
            },
          ])
          .toArray(),
        db.collection('deals').countDocuments(query),
      ]);

      return {
        deals,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      };
    } catch (error) {
      console.error('Error getting store deals:', error);
      throw error;
    }
  }

  /**
   * Get top deals across all stores
   * @param {Object} options Query options
   * @returns {Promise<Array>} Top deals
   */
  async getTopDeals({ limit = 20, category } = {}) {
    try {
      // Try to get cached deals first
      const cacheKey = `${this.TOP_DEALS_CACHE_KEY}:${category || 'all'}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const db = getDb();
      const now = new Date();

      const query = {
        startDate: { $lte: now },
        endDate: { $gt: now },
      };

      if (category) {
        query.category = category;
      }

      const deals = await db
        .collection('deals')
        .aggregate([
          { $match: query },
          {
            $lookup: {
              from: 'products',
              localField: 'productId',
              foreignField: '_id',
              as: 'product',
            },
          },
          { $unwind: '$product' },
          {
            $lookup: {
              from: 'stores',
              localField: 'storeId',
              foreignField: '_id',
              as: 'store',
            },
          },
          { $unwind: '$store' },
          {
            $project: {
              productName: '$product.name',
              productImage: '$product.image',
              storeName: '$store.name',
              storeLogo: '$store.logo',
              dealPrice: 1,
              regularPrice: 1,
              discountPercentage: 1,
              category: 1,
              viewCount: 1,
            },
          },
          { $sort: { discountPercentage: -1 } },
          { $limit: limit },
        ])
        .toArray();

      // Cache top deals
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(deals));

      return deals;
    } catch (error) {
      console.error('Error getting top deals:', error);
      throw error;
    }
  }

  /**
   * Track deal view
   * @param {string} dealId Deal ID
   * @returns {Promise<void>}
   */
  async trackDealView(dealId) {
    try {
      const db = getDb();
      await db.collection('deals').updateOne(
        { _id: new ObjectId(dealId) },
        {
          $inc: { viewCount: 1 },
          $set: { updatedAt: new Date() },
        }
      );
    } catch (error) {
      console.error('Error tracking deal view:', error);
      // Don't throw, just log the error
    }
  }

  /**
   * Invalidate store cache
   * @param {string} storeId Store ID
   * @returns {Promise<void>}
   */
  async invalidateStoreCache(storeId) {
    try {
      await this.redis.del(`${this.STORE_DEALS_CACHE_PREFIX}${storeId}`);
    } catch (error) {
      console.error('Error invalidating store cache:', error);
    }
  }

  /**
   * Invalidate all caches
   * @returns {Promise<void>}
   */
  async invalidateAllCaches() {
    try {
      await Promise.all([
        this.redis.del(this.STORES_CACHE_KEY),
        this.redis.del(this.TOP_DEALS_CACHE_KEY),
      ]);
    } catch (error) {
      console.error('Error invalidating caches:', error);
    }
  }
}

export default new StoreDealAggregator();
