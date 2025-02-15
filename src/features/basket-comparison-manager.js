import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';
import Redis from 'ioredis';
import priceHistoryManager from './price-history-manager.js';

class BasketComparisonManager {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.CACHE_TTL = 60 * 60 * 24; // 24 hours in seconds
    this.BASKET_CACHE_PREFIX = 'basket:comparison:';

    // Default basket items (can be moved to database later)
    this.DEFAULT_BASKET_ITEMS = [
      { name: 'Milk 1L', category: 'dairy', quantityUnit: 'liter', quantity: 1 },
      { name: 'Eggs 6-pack', category: 'dairy', quantityUnit: 'pack', quantity: 1 },
      { name: 'Bread', category: 'bakery', quantityUnit: 'piece', quantity: 1 },
      { name: 'Butter 500g', category: 'dairy', quantityUnit: 'piece', quantity: 1 },
      { name: 'Potatoes 1kg', category: 'produce', quantityUnit: 'kg', quantity: 1 },
      { name: 'Onions 1kg', category: 'produce', quantityUnit: 'kg', quantity: 1 },
      { name: 'Chicken Breast 1kg', category: 'meat', quantityUnit: 'kg', quantity: 1 },
      { name: 'Pasta 500g', category: 'pantry', quantityUnit: 'piece', quantity: 1 },
      { name: 'Tomatoes 1kg', category: 'produce', quantityUnit: 'kg', quantity: 1 },
      { name: 'Cheese 500g', category: 'dairy', quantityUnit: 'piece', quantity: 1 },
    ];
  }

  /**
   * Calculate basket prices for all stores
   * @returns {Promise<Object>} Basket comparison data
   */
  async calculateBasketPrices() {
    try {
      const db = getDb();
      const now = new Date();
      const stores = await db.collection('stores').find().toArray();

      const basketComparison = {
        timestamp: now,
        basketItems: this.DEFAULT_BASKET_ITEMS,
        stores: [],
        cheapestStoreId: null,
        lowestPrice: Infinity,
      };

      // Calculate basket price for each store
      for (const store of stores) {
        let totalPrice = 0;
        const itemPrices = [];

        // Get prices for each basket item
        for (const item of this.DEFAULT_BASKET_ITEMS) {
          // Find the cheapest matching product in the store
          const product = await this.findCheapestMatchingProduct(store._id, item);

          if (product) {
            const itemPrice = product.price * item.quantity;
            totalPrice += itemPrice;
            itemPrices.push({
              itemName: item.name,
              productId: product._id,
              price: product.price,
              totalPrice: itemPrice,
            });
          }
        }

        // Only include store if all items were found
        if (itemPrices.length === this.DEFAULT_BASKET_ITEMS.length) {
          const storeComparison = {
            storeId: store._id,
            storeName: store.name,
            logoUrl: store.logoUrl,
            basketPrice: Number(totalPrice.toFixed(2)),
            itemPrices,
          };

          basketComparison.stores.push(storeComparison);

          // Update cheapest store
          if (totalPrice < basketComparison.lowestPrice) {
            basketComparison.lowestPrice = totalPrice;
            basketComparison.cheapestStoreId = store._id;
          }
        }
      }

      // Sort stores by basket price
      basketComparison.stores.sort((a, b) => a.basketPrice - b.basketPrice);

      // Calculate price differences
      basketComparison.stores = basketComparison.stores.map((store, index) => ({
        ...store,
        priceDifference:
          index === 0
            ? 0
            : Number((store.basketPrice - basketComparison.stores[0].basketPrice).toFixed(2)),
      }));

      // Cache the results
      await this.cacheBasketComparison(basketComparison);

      return basketComparison;
    } catch (error) {
      console.error('Error calculating basket prices:', error);
      throw error;
    }
  }

  /**
   * Find the cheapest matching product for a basket item in a store
   * @param {ObjectId} storeId Store ID
   * @param {Object} basketItem Basket item
   * @returns {Promise<Object|null>} Matching product with price
   */
  async findCheapestMatchingProduct(storeId, basketItem) {
    try {
      const db = getDb();

      // Find matching products
      const products = await db
        .collection('products')
        .find({
          name: { $regex: basketItem.name, $options: 'i' },
          category: basketItem.category,
          quantityUnit: basketItem.quantityUnit,
        })
        .toArray();

      if (products.length === 0) {
        return null;
      }

      // Get current prices for all matching products
      const productPrices = await Promise.all(
        products.map(async product => {
          const priceRecord = await db.collection('price_history').findOne(
            {
              productId: product._id,
              storeId: storeId,
            },
            { sort: { dateRecorded: -1 } }
          );

          return priceRecord ? { ...product, price: priceRecord.price } : null;
        })
      );

      // Filter out products without prices and find the cheapest
      return productPrices.filter(Boolean).sort((a, b) => a.price - b.price)[0] || null;
    } catch (error) {
      console.error('Error finding matching product:', error);
      throw error;
    }
  }

  /**
   * Get the latest basket comparison
   * @returns {Promise<Object>} Basket comparison data
   */
  async getBasketComparison() {
    try {
      // Try to get cached comparison
      const cached = await this.redis.get(this.BASKET_CACHE_PREFIX + 'latest');
      if (cached) {
        return JSON.parse(cached);
      }

      // Calculate new comparison if not cached
      return await this.calculateBasketPrices();
    } catch (error) {
      console.error('Error getting basket comparison:', error);
      throw error;
    }
  }

  /**
   * Cache basket comparison
   * @param {Object} comparison Basket comparison data
   * @returns {Promise<void>}
   */
  async cacheBasketComparison(comparison) {
    try {
      await this.redis.setex(
        this.BASKET_CACHE_PREFIX + 'latest',
        this.CACHE_TTL,
        JSON.stringify(comparison)
      );
    } catch (error) {
      console.error('Error caching basket comparison:', error);
    }
  }

  /**
   * Invalidate basket comparison cache
   * @returns {Promise<void>}
   */
  async invalidateCache() {
    try {
      await this.redis.del(this.BASKET_CACHE_PREFIX + 'latest');
    } catch (error) {
      console.error('Error invalidating basket comparison cache:', error);
    }
  }
}

export default new BasketComparisonManager();
