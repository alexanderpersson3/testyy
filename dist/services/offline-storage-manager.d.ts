import { ObjectId } from 'mongodb';
interface OfflineItem {
    _id?: ObjectId;
    userId: ObjectId;
    type: 'recipe' | 'collection' | 'list';
    itemId: ObjectId;
    data: any;
    status: 'pending' | 'synced' | 'failed';
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare class OfflineStorageManager {
    private static instance;
    private syncService;
    private constructor();
    static getInstance(): OfflineStorageManager;
    /**
     * Store an item for offline use
     */
    storeItem(userId: ObjectId, type: OfflineItem['type'], itemId: ObjectId, data: any): Promise<void>;
    /**
     * Remove an item from offline storage
     */
    removeItem(userId: ObjectId, type: OfflineItem['type'], itemId: ObjectId): Promise<boolean>;
    /**
     * Get pending items for sync
     */
    getPendingItems(userId: ObjectId, type?: OfflineItem['type']): Promise<OfflineItem[]>;
    /**
     * Mark items as synced
     */
    markAsSynced(itemIds: ObjectId[]): Promise<void>;
    /**
     * Mark items as failed
     */
    markAsFailed(itemIds: ObjectId[], error: string): Promise<void>;
    /**
     * Clear synced items older than specified age
     */
    clearSyncedItems(maxAge?: number): Promise<number>;
    /**
     * Sync offline items for a user
     */
    syncOfflineItems(userId: ObjectId): Promise<{
        synced: number;
        failed: number;
    }>;
    /**
     * Clear all offline data for a user
     */
    clearOfflineData(userId: ObjectId): Promise<void>;
}
export {};
