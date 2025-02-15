import { connectToDatabase } from '../db/index.js';
import logger from '../utils/logger.js';
/**
 * Create MongoDB indexes
 */
export async function createIndexes() {
    try {
        const db = await connectToDatabase();
        // Users collection indexes
        await db
            .collection('users')
            .createIndexes([
            { key: { email: 1 }, unique: true },
            { key: { username: 1 }, unique: true },
            { key: { roles: 1 } },
            { key: { lastLoginAt: -1 } },
        ]);
        // Recipes collection indexes
        await db
            .collection('recipes')
            .createIndexes([
            { key: { userId: 1 } },
            { key: { 'author._id': 1 } },
            { key: { cuisine: 1 } },
            { key: { difficulty: 1 } },
            { key: { tags: 1 } },
            { key: { createdAt: -1 } },
            { key: { 'ratings.average': -1 } },
            {
                key: { title: 'text', description: 'text', tags: 'text' },
                weights: {
                    title: 10,
                    description: 5,
                    tags: 3
                },
                name: 'recipe_text_search'
            }
        ]);
        // Collections collection indexes
        await db
            .collection('collections')
            .createIndexes([
            { key: { userId: 1 } },
            { key: { recipeIds: 1 } },
            { key: { isPrivate: 1 } },
            { key: { updatedAt: -1 } },
        ]);
        // Timer groups collection indexes
        await db
            .collection('timer_groups')
            .createIndexes([
            { key: { userId: 1 } },
            { key: { recipeId: 1 } },
            { key: { status: 1 } },
            { key: { createdAt: -1 } },
        ]);
        // Timers collection indexes
        await db
            .collection('timers')
            .createIndexes([
            { key: { userId: 1 } },
            { key: { groupId: 1 } },
            { key: { status: 1 } },
            { key: { endTime: 1 } },
            { key: { priority: -1 } },
        ]);
        // Notifications collection indexes
        await db
            .collection('notifications')
            .createIndexes([
            { key: { userId: 1 } },
            { key: { read: 1 } },
            { key: { type: 1 } },
            { key: { createdAt: -1 } },
        ]);
        // Cache collection indexes
        await db.collection('cache').createIndexes([
            { key: { key: 1 }, unique: true },
            { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
        ]);
        // Search events collection indexes
        await db
            .collection('search_events')
            .createIndexes([{ key: { userId: 1 } }, { key: { query: 1 } }, { key: { timestamp: -1 } }]);
        // Query performance collection indexes
        await db
            .collection('query_performance')
            .createIndexes([
            { key: { timestamp: -1 } },
            { key: { responseTime: -1 } },
            { key: { successful: 1 } },
        ]);
        // Security audit logs collection indexes
        await db
            .collection('security_audit_logs')
            .createIndexes([
            { key: { userId: 1 } },
            { key: { action: 1 } },
            { key: { status: 1 } },
            { key: { createdAt: -1 } },
        ]);
        // Suspicious activities collection indexes
        await db
            .collection('suspicious_activities')
            .createIndexes([
            { key: { userId: 1 } },
            { key: { type: 1 } },
            { key: { severity: 1 } },
            { key: { status: 1 } },
            { key: { createdAt: -1 } },
        ]);
        // Sync operations collection indexes
        await db
            .collection('sync_operations')
            .createIndexes([
            { key: { userId: 1 } },
            { key: { deviceId: 1 } },
            { key: { status: 1 } },
            { key: { timestamp: -1 } },
        ]);
        // AR sessions collection indexes
        await db
            .collection('ar_sessions')
            .createIndexes([
            { key: { userId: 1 } },
            { key: { recipeId: 1 } },
            { key: { status: 1 } },
            { key: { startTime: -1 } },
        ]);
        // Suppliers collection indexes
        await db
            .collection('suppliers')
            .createIndexes([
            { key: { 'location.coordinates': '2dsphere' } },
            { key: { type: 1 } },
            { key: { verificationStatus: 1 } },
            { key: { 'rating.average': -1 } },
        ]);
        // Products collection indexes
        await db
            .collection('products')
            .createIndexes([
            { key: { supplierId: 1 } },
            { key: { category: 1 } },
            { key: { inStock: 1 } },
            { key: { price: 1 } },
        ]);
        logger.info('MongoDB indexes created successfully');
    }
    catch (error) {
        logger.error('Failed to create MongoDB indexes:', error);
        throw error;
    }
}
//# sourceMappingURL=indexes.js.map