import { ObjectId } from 'mongodb';
export interface SyncOperation {
    _id?: ObjectId;
    userId: ObjectId;
    deviceId: string;
    type: 'create' | 'update' | 'delete';
    collection: string;
    documentId: ObjectId;
    changes: Record<string, any>;
    status: 'pending' | 'completed' | 'failed';
    error?: string;
    timestamp: Date;
    syncedAt?: Date;
}
export interface SyncState {
    _id?: ObjectId;
    userId: ObjectId;
    deviceId: string;
    lastSyncTimestamp: Date;
    collections: Record<string, {
        lastSyncTimestamp: Date;
        version: number;
    }>;
    createdAt: Date;
    updatedAt: Date;
}
export interface SyncResult {
    success: boolean;
    operations: {
        total: number;
        completed: number;
        failed: number;
    };
    errors?: Array<{
        operation: SyncOperation;
        error: string;
    }>;
    timestamp: Date;
}
export declare class OfflineSyncService {
    private static instance;
    private constructor();
    static getInstance(): OfflineSyncService;
    /**
     * Record sync operation
     */
    recordOperation(operation: Omit<SyncOperation, '_id' | 'status' | 'timestamp'>): Promise<SyncOperation>;
    /**
     * Get pending operations
     */
    getPendingOperations(userId: ObjectId, deviceId: string): Promise<SyncOperation[]>;
    /**
     * Get sync state
     */
    getSyncState(userId: ObjectId, deviceId: string): Promise<SyncState | null>;
    /**
     * Update sync state
     */
    updateSyncState(userId: ObjectId, deviceId: string, collections: Record<string, {
        version: number;
    }>): Promise<SyncState>;
    /**
     * Sync changes
     */
    syncChanges(userId: ObjectId, deviceId: string, operations: SyncOperation[]): Promise<SyncResult>;
    /**
     * Handle create operation
     */
    private handleCreate;
    /**
     * Handle update operation
     */
    private handleUpdate;
    /**
     * Handle delete operation
     */
    private handleDelete;
    /**
     * Get changes since last sync
     */
    getChangesSinceLastSync(userId: ObjectId, deviceId: string, collections: string[]): Promise<Record<string, any[]>>;
}
