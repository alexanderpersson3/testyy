import type { DownloadRequest, OfflineStats, DownloadResult, CleanupOptions, CleanupResult } from '../types/index.js';
export interface SyncResult {
    added: number;
    updated: number;
    deleted: number;
    errors: Array<{
        id: string;
        error: string;
    }>;
}
export declare class OfflineService {
    private readonly defaultSettings;
    private static instance;
    private constructor();
    static getInstance(): OfflineService;
    /**
     * Store data for offline access
     */
    storeOfflineData(userId: string, type: 'recipe' | 'collection' | 'list', dataId: string, data: any): Promise<void>;
    /**
     * Get offline data
     */
    getOfflineData(userId: string, type: 'recipe' | 'collection' | 'list', dataId: string): Promise<any | null>;
    /**
     * Delete offline data
     */
    deleteOfflineData(userId: string, type: 'recipe' | 'collection' | 'list', dataId: string): Promise<void>;
    /**
     * Get total storage size
     */
    private getTotalStorageSize;
    /**
     * Sync offline data
     */
    syncOfflineData(userId: string): Promise<SyncResult>;
    /**
     * Sync a recipe
     */
    private syncRecipe;
    /**
     * Sync a collection
     */
    private syncCollection;
    /**
     * Sync a list
     */
    private syncList;
    /**
     * Clear old offline data
     */
    clearOldData(userId: string, maxAge: number): Promise<void>;
    /**
     * Download recipes for offline access
     */
    downloadRecipes(userId: string, request: DownloadRequest): Promise<DownloadResult>;
    /**
     * Sync offline changes
     */
    syncChanges(userId: string): Promise<void>;
    /**
     * Clean up offline storage
     */
    cleanupStorage(userId: string, options: CleanupOptions): Promise<CleanupResult>;
    /**
     * Get offline storage stats
     */
    getStats(userId: string): Promise<OfflineStats>;
    private getLastSyncTime;
    private countSyncErrors;
    private countPendingChanges;
    /**
     * Helper: Download attachments
     */
    private downloadAttachments;
    /**
     * Helper: Delete attachment file
     */
    private deleteAttachmentFile;
    /**
     * Helper: Track sync operation
     */
    private trackSyncOperation;
    /**
     * Helper: Process sync operations
     */
    private processSyncUpload;
    private processSyncDownload;
    private processSyncDelete;
    /**
     * Helper: Get retry attempts from settings
     */
    private getRetryAttempts;
    /**
     * Helper: Log error
     */
    private logError;
    /**
     * Helper: Log event
     */
    private logEvent;
}
