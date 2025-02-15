import { ObjectId } from 'mongodb';
;
import { connectToDatabase } from '../db.js';
import logger from '../utils/logger.js';
import { OfflineSyncService } from '../offline-sync.service.js';
export class OfflineStorageManager {
    constructor() {
        this.syncService = OfflineSyncService.getInstance();
    }
    static getInstance() {
        if (!OfflineStorageManager.instance) {
            OfflineStorageManager.instance = new OfflineStorageManager();
        }
        return OfflineStorageManager.instance;
    }
    /**
     * Store an item for offline use
     */
    async storeItem(userId, type, itemId, data) {
        try {
            await connectToDatabase();
            const offlineItem = {
                userId,
                type,
                itemId,
                data,
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            await getCollection('offline_items').insertOne(offlineItem);
        }
        catch (error) {
            logger.error('Failed to store offline item:', error);
            throw error;
        }
    }
    /**
     * Remove an item from offline storage
     */
    async removeItem(userId, type, itemId) {
        try {
            await connectToDatabase();
            const result = await getCollection('offline_items').deleteOne({
                userId,
                type,
                itemId,
            });
            return result.deletedCount > 0;
        }
        catch (error) {
            logger.error('Failed to remove offline item:', error);
            throw error;
        }
    }
    /**
     * Get pending items for sync
     */
    async getPendingItems(userId, type) {
        try {
            await connectToDatabase();
            const query = {
                userId,
                status: 'pending',
            };
            if (type) {
                query.type = type;
            }
            const pendingItems = await getCollection('offline_items')
                .find(query)
                .sort({ createdAt: 1 })
                .toArray();
            return pendingItems;
        }
        catch (error) {
            logger.error('Failed to get pending offline items:', error);
            throw error;
        }
    }
    /**
     * Mark items as synced
     */
    async markAsSynced(itemIds) {
        try {
            await connectToDatabase();
            await getCollection('offline_items').updateMany({ _id: { $in: itemIds } }, {
                $set: {
                    status: 'synced',
                    updatedAt: new Date(),
                },
            });
        }
        catch (error) {
            logger.error('Failed to mark offline items as synced:', error);
            throw error;
        }
    }
    /**
     * Mark items as failed
     */
    async markAsFailed(itemIds, error) {
        try {
            await connectToDatabase();
            await getCollection('offline_items').updateMany({ _id: { $in: itemIds } }, {
                $set: {
                    status: 'failed',
                    error,
                    updatedAt: new Date(),
                },
            });
        }
        catch (error) {
            logger.error('Failed to mark offline items as failed:', error);
            throw error;
        }
    }
    /**
     * Clear synced items older than specified age
     */
    async clearSyncedItems(maxAge = 7 * 24 * 60 * 60 * 1000) {
        try {
            await connectToDatabase();
            const cutoff = new Date(Date.now() - maxAge);
            const result = await getCollection('offline_items').deleteMany({
                status: 'synced',
                updatedAt: { $lt: cutoff },
            });
            return result.deletedCount;
        }
        catch (error) {
            logger.error('Failed to clear synced offline items:', error);
            throw error;
        }
    }
    /**
     * Sync offline items for a user
     */
    async syncOfflineItems(userId) {
        try {
            await connectToDatabase();
            const pendingItems = await this.getPendingItems(userId);
            if (!pendingItems.length) {
                return { synced: 0, failed: 0 };
            }
            const itemsToSync = pendingItems.filter(item => item._id);
            if (!itemsToSync.length) {
                return { synced: 0, failed: 0 };
            }
            await this.markAsSynced(itemsToSync.map(item => item._id));
            return {
                synced: itemsToSync.length,
                failed: pendingItems.length - itemsToSync.length,
            };
        }
        catch (error) {
            logger.error('Failed to sync offline items:', error);
            throw error;
        }
    }
    /**
     * Clear all offline data for a user
     */
    async clearOfflineData(userId) {
        try {
            await connectToDatabase();
            await getCollection('offline_items').deleteMany({
                userId,
            });
        }
        catch (error) {
            logger.error('Failed to clear offline data:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=offline-storage-manager.js.map