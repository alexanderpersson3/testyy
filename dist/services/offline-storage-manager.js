import { ObjectId } from 'mongodb';
import { getDb } from '../config/db';
import { SyncService } from './sync-service';
export class OfflineStorageManager {
    constructor(options = {}) {
        this.DEFAULT_MAX_ITEMS = 100;
        this.DEFAULT_EXPIRATION_DAYS = 30;
        this.options = {
            maxItems: options.maxItems || this.DEFAULT_MAX_ITEMS,
            expirationDays: options.expirationDays || this.DEFAULT_EXPIRATION_DAYS
        };
        this.syncService = new SyncService();
    }
    static getInstance(options) {
        if (!OfflineStorageManager.instance) {
            OfflineStorageManager.instance = new OfflineStorageManager(options);
        }
        return OfflineStorageManager.instance;
    }
    async markForOffline(userId, itemId, type) {
        try {
            const db = await getDb();
            const now = new Date();
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + this.options.expirationDays);
            // Get the item data
            const collection = this.getCollectionName(type);
            const item = await db.collection(collection).findOne({ _id: new ObjectId(itemId) });
            if (!item) {
                throw new Error(`${type} not found`);
            }
            // Check if we've reached the limit
            const currentCount = await db.collection('offline_items').countDocuments({
                userId: new ObjectId(userId)
            });
            if (currentCount >= this.options.maxItems) {
                throw new Error('Offline storage limit reached');
            }
            const offlineItem = {
                id: itemId,
                type,
                data: item,
                syncStatus: 'synced',
                lastModified: now,
                expiresAt: expirationDate
            };
            await db.collection('offline_items').insertOne({
                userId: new ObjectId(userId),
                ...offlineItem
            });
            return true;
        }
        catch (error) {
            console.error('Error marking item for offline:', error);
            throw error;
        }
    }
    async getOfflineItems(userId, type) {
        try {
            const db = await getDb();
            const query = {
                userId: new ObjectId(userId),
                expiresAt: { $gt: new Date() }
            };
            if (type) {
                query.type = type;
            }
            const items = await db.collection('offline_items')
                .find(query)
                .toArray();
            return items.map(({ _id, userId, ...item }) => item);
        }
        catch (error) {
            console.error('Error getting offline items:', error);
            throw error;
        }
    }
    async removeFromOffline(userId, itemId) {
        try {
            const db = await getDb();
            const result = await db.collection('offline_items').deleteOne({
                userId: new ObjectId(userId),
                id: itemId
            });
            return result.deletedCount > 0;
        }
        catch (error) {
            console.error('Error removing item from offline storage:', error);
            throw error;
        }
    }
    async syncOfflineChanges(userId, deviceId) {
        try {
            const db = await getDb();
            const pendingItems = await db.collection('offline_items').find({
                userId: new ObjectId(userId),
                syncStatus: 'pending'
            }).toArray();
            if (pendingItems.length === 0) {
                return { success: true };
            }
            const now = new Date();
            const syncItems = pendingItems.map(({ id, type, data }) => ({
                id,
                type,
                data,
                lastModified: now
            }));
            const batch = await this.syncService.queueSync(new ObjectId(userId), deviceId, syncItems);
            const result = await this.syncService.processBatch(batch._id);
            if (result.success) {
                // Update sync status for successfully synced items
                await db.collection('offline_items').updateMany({
                    userId: new ObjectId(userId),
                    id: { $in: syncItems.map(item => item.id) }
                }, {
                    $set: {
                        syncStatus: 'synced',
                        lastModified: now
                    }
                });
            }
            return result;
        }
        catch (error) {
            console.error('Error syncing offline changes:', error);
            throw error;
        }
    }
    async cleanupExpiredItems() {
        try {
            const db = await getDb();
            const result = await db.collection('offline_items').deleteMany({
                expiresAt: { $lt: new Date() }
            });
            return result.deletedCount;
        }
        catch (error) {
            console.error('Error cleaning up expired items:', error);
            throw error;
        }
    }
    getCollectionName(type) {
        switch (type) {
            case 'recipe': return 'recipes';
            case 'shopping_list': return 'shopping_lists';
            case 'collection': return 'collections';
            default: throw new Error(`Invalid item type: ${type}`);
        }
    }
}
//# sourceMappingURL=offline-storage-manager.js.map