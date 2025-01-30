interface OfflineStorageItem {
    id: string;
    type: 'recipe' | 'shopping_list' | 'collection';
    data: any;
    syncStatus: 'pending' | 'synced' | 'error';
    lastModified: Date;
    expiresAt: Date;
}
interface StorageOptions {
    maxItems?: number;
    expirationDays?: number;
}
export declare class OfflineStorageManager {
    private static instance;
    private readonly syncService;
    private readonly DEFAULT_MAX_ITEMS;
    private readonly DEFAULT_EXPIRATION_DAYS;
    private readonly options;
    private constructor();
    static getInstance(options?: StorageOptions): OfflineStorageManager;
    markForOffline(userId: string, itemId: string, type: OfflineStorageItem['type']): Promise<boolean>;
    getOfflineItems(userId: string, type?: OfflineStorageItem['type']): Promise<OfflineStorageItem[]>;
    removeFromOffline(userId: string, itemId: string): Promise<boolean>;
    syncOfflineChanges(userId: string, deviceId: string): Promise<{
        success: boolean;
        conflicts?: Array<{
            itemId: string;
            type: string;
            message: string;
        }>;
    }>;
    cleanupExpiredItems(): Promise<number>;
    private getCollectionName;
}
export {};
//# sourceMappingURL=offline-storage-manager.d.ts.map