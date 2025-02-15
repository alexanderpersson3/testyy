import { ObjectId } from 'mongodb';
export type SyncOperationType = 'create' | 'update' | 'delete';
export type ConflictResolution = 'client_wins' | 'server_wins' | 'manual_merge';
export type SyncStatus = 'pending' | 'processing' | 'completed' | 'failed';
export interface SyncMetadata {
    lastSyncedAt: Date;
    deviceId: string;
    version: number;
}
export interface BaseSyncItem {
    id: string;
    version: number;
}
export interface SyncItem extends BaseSyncItem {
    deleted?: boolean;
    data?: Record<string, any>;
}
export interface SyncBatch {
    _id?: ObjectId;
    items: SyncItem[];
    clientId: string;
    timestamp: Date;
    userId?: ObjectId;
    deviceId?: string;
    status?: SyncStatus;
    startedAt?: Date;
    completedAt?: Date;
    conflicts?: Array<{
        itemId: ObjectId;
        status: SyncStatus;
        resolution?: ConflictResolution;
    }>;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface QueueItem extends BaseSyncItem {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: Date;
    updatedAt: Date;
    data?: Record<string, any>;
    deleted?: boolean;
    clientId: string;
}
export interface QueueBatch {
    items: QueueItem[];
    clientId: string;
    timestamp: Date;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: Date;
    updatedAt: Date;
}
export interface SyncOperation {
    _id: ObjectId;
    type: SyncOperationType;
    collection: string;
    documentId: ObjectId;
    data: Record<string, any>;
    status: SyncStatus;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface SyncConflict {
    _id: ObjectId;
    collection: string;
    documentId: ObjectId;
    clientVersion: Record<string, any>;
    serverVersion: Record<string, any>;
    status: 'unresolved' | 'resolved';
    resolution?: 'client' | 'server';
    resolvedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface SyncStats {
    pending: number;
    completed: number;
    failed: number;
    total: number;
}
export interface SyncResult {
    success: boolean;
    syncedItems: number;
    conflicts: number;
    errors: Array<{
        itemId: ObjectId;
        error: string;
    }>;
    newVersion: number;
}
