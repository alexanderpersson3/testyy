import { ObjectId } from 'mongodb';
import type { BaseDocument } from '../types/index.js';
/**
 * Offline sync status
 */
export type SyncStatus = 'pending' | 'synced' | 'conflict' | 'error';
/**
 * Offline recipe
 */
export interface OfflineRecipe extends BaseDocument {
    userId: ObjectId;
    recipe: {
        id: string;
        name: string;
        description: string;
        ingredients: Array<{
            product: string;
            quantity: number;
        }>;
        instructions: string[];
        servings: number;
        prepTime: number;
        cookTime: number;
        totalTime: number;
        difficulty: 'easy' | 'medium' | 'hard';
        cuisine: string;
        tags: string[];
        images: string[];
        nutrition: Record<string, number>;
    };
    attachments: Array<{
        type: string;
        localPath: string;
        originalUrl: string;
        size: number;
        mimeType: string;
    }>;
    notes: Array<{
        text: string;
        timestamp: Date;
    }>;
    lastAccessed: Date;
    lastModified: Date;
    syncStatus: SyncStatus;
    syncTimestamp: Date;
    version: number;
}
/**
 * Offline storage settings
 */
export interface OfflineSettings {
    maxStorageSize: number;
    maxRecipes: number;
    autoSync: boolean;
    syncInterval: number;
    keepFavorites: boolean;
    keepRecent: boolean;
    mediaQuality: 'low' | 'medium' | 'high';
    downloadAttachments: boolean;
    retryAttempts: number;
    conflictResolution: 'manual' | 'auto';
}
/**
 * Offline storage stats
 */
export interface OfflineStats {
    totalSize: number;
    recipeCount: number;
    attachmentSize: number;
    lastSync: Date;
    syncErrors: number;
    pendingChanges: number;
    storageUsage: {
        recipes: number;
        attachments: number;
        notes: number;
        other: number;
    };
}
/**
 * Sync operation
 */
export interface SyncOperation extends BaseDocument {
    userId: ObjectId;
    type: 'upload' | 'download' | 'delete';
    recipeId: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    retryCount: number;
    changes: Array<{
        field: string;
        oldValue: any;
        newValue: any;
    }>;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
    timestamp: Date;
}
/**
 * Sync conflict
 */
export interface SyncConflict {
    recipeId: string;
    localVersion: number;
    remoteVersion: number;
    changes: Array<{
        field: string;
        localValue: any;
        remoteValue: any;
    }>;
    resolution?: 'local' | 'remote' | 'merge';
}
/**
 * Download request
 */
export interface DownloadRequest {
    recipeIds: string[];
    includeAttachments?: boolean;
    quality?: 'low' | 'medium' | 'high';
}
/**
 * Download result
 */
export interface DownloadResult {
    successful: string[];
    failed: Array<{
        recipeId: string;
        error: string;
    }>;
    totalSize: number;
    duration: number;
}
/**
 * Storage cleanup options
 */
export interface CleanupOptions {
    olderThan?: Date;
    excludeFavorites?: boolean;
    dryRun?: boolean;
}
/**
 * Cleanup result
 */
export interface CleanupResult {
    removedRecipes: string[];
    removedAttachments: string[];
    spaceFreed: number;
    dryRun: boolean;
}
/**
 * Offline error
 */
export interface OfflineError extends BaseDocument {
    code: string;
    message: string;
    details: Record<string, any>;
    recipeId?: string;
    timestamp: Date;
    stack?: string;
}
/**
 * Offline data
 */
export interface OfflineData extends BaseDocument {
    userId: ObjectId;
    type: 'recipe' | 'collection' | 'list';
    dataId: ObjectId;
    data: any;
    version: number;
    size: number;
    lastModified: Date;
    lastSynced: Date;
    lastAccessed: Date;
    status: 'synced' | 'pending' | 'conflict';
    metadata: {
        originalSource: string;
        compressionType?: string;
        checksum?: string;
    };
}
/**
 * Offline event
 */
export interface OfflineEvent extends BaseDocument {
    userId: ObjectId;
    type: string;
    status: 'success' | 'warning' | 'error';
    message: string;
    details: Record<string, any>;
    timestamp: Date;
}
