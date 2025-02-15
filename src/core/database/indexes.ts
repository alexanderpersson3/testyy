import type { Recipe } from '../types/express.js';
import { connectToDatabase } from '../db/index.js';;
import logger from '../utils/logger.js';
import { Db } from 'mongodb';

/**
 * Create MongoDB indexes
 */
export async function createIndexes(db: Db): Promise<void> {
  try {
    // Users collection indexes
    await db.collection('users').createIndexes([
      { key: { username: 1 }, unique: true },
      { key: { email: 1 }, unique: true },
      { key: { 'preferences.cuisine': 1 } },
      { key: { createdAt: -1 } },
    ]);

    // Recipes collection indexes
    await db.collection('recipes').createIndexes([
      { key: { userId: 1 } },
      { key: { title: 1 } },
      { key: { cuisine: 1 } },
      { key: { difficulty: 1 } },
      { key: { isPublished: 1 } },
      { key: { 'stats.rating': -1 } },
      { key: { createdAt: -1 } },
      { key: { tags: 1 } },
    ]);

    // Shopping lists collection indexes
    await db.collection('shopping_lists').createIndexes([
      { key: { userId: 1 } },
      { key: { 'items.ingredientId': 1 } },
      { key: { status: 1 } },
      { key: { isDefault: 1 } },
      { key: { lastModified: -1 } },
      { key: { sharedWith: 1 } },
    ]);

    // Stores collection indexes
    await db.collection('stores').createIndexes([
      { key: { 'location.city': 1 } },
      { key: { 'location.postalCode': 1 } },
      { key: { features: 1 } },
      { key: { isActive: 1 } },
      {
        key: { 'location.coordinates': '2dsphere' },
        sparse: true,
      },
    ]);

    // Store deals collection indexes
    await db.collection('store_deals').createIndexes([
      { key: { storeId: 1 } },
      { key: { startDate: 1 } },
      { key: { endDate: 1 } },
      { key: { isActive: 1 } },
      { key: { 'items.productId': 1 } },
    ]);

    // Store products collection indexes
    await db.collection('store_products').createIndexes([
      { key: { storeId: 1 } },
      { key: { category: 1 } },
      { key: { brand: 1 } },
      { key: { inStock: 1 } },
      { key: { barcode: 1 } },
    ]);

    logger.info('Successfully created MongoDB indexes');
  } catch (error) {
    logger.error('Error creating MongoDB indexes:', error);
    throw error;
  }
}
