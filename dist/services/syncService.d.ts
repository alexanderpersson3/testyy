import { Collection, ObjectId } from 'mongodb';
import { SyncBatch, QueueItem, SyncConflict as SyncConflictType, ConflictResolution } from '../types/sync';
interface SyncConflict {
    type: 'conflict';
    message: string;
    item: any;
}
interface SyncResult {
    success: boolean;
    conflicts?: SyncConflict[];
    newVersion?: number;
}
export declare class SyncService {
    private collection;
    private versionField;
    constructor(collection: Collection, versionField?: string);
    sync(batch: SyncBatch): Promise<SyncResult>;
    queueSync(userId: ObjectId, items: Omit<QueueItem, '_id' | 'status' | 'createdAt' | 'updatedAt'>[]): Promise<SyncBatch>;
    processBatch(batchId: ObjectId): Promise<SyncResult>;
    getConflicts(userId: ObjectId): Promise<SyncConflictType[]>;
    resolveConflict(conflictId: ObjectId, resolution: ConflictResolution, manualData?: any): Promise<void>;
    getSyncStatus(userId: ObjectId, deviceId: string, lastSyncedAt?: Date): Promise<{
        pendingChanges: number;
        conflicts: number;
        lastSyncedAt: Date | null;
    }>;
    private checkConflicts;
}
export {};
//# sourceMappingURL=syncService.d.ts.map