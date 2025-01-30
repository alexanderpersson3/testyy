import { ObjectId } from 'mongodb';
export type SyncStatus = 'pending' | 'synced' | 'conflict' | 'error';
export type ConflictResolution = 'client' | 'server' | 'manual';
interface SyncItem {
    id: string;
    type: 'recipe' | 'shopping_list' | 'collection';
    data: any;
    version: number;
    lastModified: Date;
    clientId?: string;
}
interface SyncBatch {
    _id?: ObjectId;
    userId: ObjectId;
    deviceId: string;
    items: SyncItem[];
    status: SyncStatus;
    conflicts: Array<{
        itemId: string;
        type: string;
        clientVersion: number;
        serverVersion: number;
        resolution?: ConflictResolution;
        resolvedData?: any;
    }>;
    timestamp: Date;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare class SyncService {
    private collection;
    private readonly versionField;
    private initialized;
    constructor();
    private initializeCollection;
    private ensureInitialized;
    queueSync(userId: ObjectId, deviceId: string, items: Omit<SyncItem, 'version'>[]): Promise<SyncBatch>;
    processBatch(batchId: ObjectId): Promise<{
        success: boolean;
        conflicts?: Array<{
            itemId: string;
            type: string;
            message: string;
        }>;
    }>;
    resolveConflict(batchId: ObjectId, resolutions: Array<{
        itemId: string;
        resolution: ConflictResolution;
        manualData?: any;
    }>): Promise<void>;
    private checkConflicts;
    private getServerVersion;
    private getCollectionName;
}
export {};
//# sourceMappingURL=sync-service.d.ts.map