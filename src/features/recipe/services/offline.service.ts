;
;
import type { Collection } from 'mongodb';
import type { Recipe } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
import { DatabaseService } from '../db/database.service.js';;
import type { OfflineRecipe, DownloadRequest, OfflineData, OfflineSettings, OfflineStats, SyncOperation, DownloadResult, CleanupOptions, CleanupResult, OfflineError, OfflineEvent } from '../types/express.js';
import type { InsertableDocument } from '../types/express.js';

export interface SyncResult {
    added: number;
    updated: number;
    deleted: number;
    errors: Array<{
        id: string;
        error: string;
    }>;
}

export class OfflineService {
    private readonly defaultSettings: OfflineSettings = {
        maxStorageSize: 1024 * 1024 * 1024, // 1GB
        maxRecipes: 100,
        autoSync: true,
        syncInterval: 30, // 30 minutes
        keepFavorites: true,
        keepRecent: true,
        mediaQuality: 'high',
        downloadAttachments: true,
        retryAttempts: 3,
        conflictResolution: 'manual'
    };

    private static instance: OfflineService;

    private constructor() {}

    public static getInstance(): OfflineService {
        if (!OfflineService.instance) {
            OfflineService.instance = new OfflineService();
        }
        return OfflineService.instance;
    }

    /**
     * Store data for offline access
     */
    public async storeOfflineData(
        userId: string,
        type: 'recipe' | 'collection' | 'list',
        dataId: string,
        data: any
    ): Promise<void> {
        const db = DatabaseService.getInstance();

        // Check storage limits
        const totalSize = await this.getTotalStorageSize(userId);
        const dataSize = Buffer.from(JSON.stringify(data)).length;

        if (totalSize + dataSize > this.defaultSettings.maxStorageSize) {
            throw new Error('Storage limit exceeded');
        }

        if (type === 'recipe') {
            const recipeCount = await db.getCollection<OfflineData>('offline_data').countDocuments({
                userId: new ObjectId(userId),
                type: 'recipe'
            });

            if (recipeCount >= this.defaultSettings.maxRecipes) {
                throw new Error('Maximum number of offline recipes reached');
            }
        }

        // Store or update data
        await db.getCollection<OfflineData>('offline_data').updateOne(
            {
                userId: new ObjectId(userId),
                type,
                dataId: new ObjectId(dataId)
            },
            {
                $set: {
                    data,
                    version: Date.now(),
                    lastModified: new Date(),
                    size: dataSize
                },
                $setOnInsert: {
                    lastSynced: new Date()
                }
            },
            { upsert: true }
        );
    }

    /**
     * Get offline data
     */
    public async getOfflineData(
        userId: string,
        type: 'recipe' | 'collection' | 'list',
        dataId: string
    ): Promise<any | null> {
        const db = DatabaseService.getInstance();

        const record = await db.getCollection<OfflineData>('offline_data').findOne({
            userId: new ObjectId(userId),
            type,
            dataId: new ObjectId(dataId)
        });

        return record?.data || null;
    }

    /**
     * Delete offline data
     */
    public async deleteOfflineData(
        userId: string,
        type: 'recipe' | 'collection' | 'list',
        dataId: string
    ): Promise<void> {
        const db = DatabaseService.getInstance();

        await db.getCollection<OfflineData>('offline_data').deleteOne({
            userId: new ObjectId(userId),
            type,
            dataId: new ObjectId(dataId)
        });
    }

    /**
     * Get total storage size
     */
    private async getTotalStorageSize(userId: string): Promise<number> {
        const db = DatabaseService.getInstance();

        const result = await db
            .getCollection<OfflineData>('offline_data')
            .aggregate([
                {
                    $match: {
                        userId: new ObjectId(userId)
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalSize: {
                            $sum: '$size'
                        }
                    }
                }
            ])
            .toArray();

        return result[0]?.totalSize || 0;
    }

    /**
     * Sync offline data
     */
    async syncOfflineData(userId: string): Promise<SyncResult> {
        const db = DatabaseService.getInstance();

        const result: SyncResult = {
            added: 0,
            updated: 0,
            deleted: 0,
            errors: [],
        };

        const offlineData = await db
            .getCollection<OfflineData>('offline_data')
            .find({
                userId: new ObjectId(userId),
                $expr: { $gt: ['$lastModified', '$lastSynced'] },
            })
            .toArray();

        for (const record of offlineData) {
            try {
                switch (record.type) {
                    case 'recipe':
                        await this.syncRecipe(record);
                        break;
                    case 'collection':
                        await this.syncCollection(record);
                        break;
                    case 'list':
                        await this.syncList(record);
                        break;
                }

                // Update sync timestamp
                await db.getCollection<OfflineData>('offline_data').updateOne(
                    { _id: record._id },
                    {
                        $set: {
                            lastSynced: new Date(),
                        },
                    }
                );

                result.updated++;
            } catch (error: any) {
                result.errors.push({
                    id: record.dataId.toString(),
                    error: error.message,
                });
            }
        }

        return result;
    }

    /**
     * Sync a recipe
     */
    private async syncRecipe(record: OfflineData): Promise<void> {
        const db = DatabaseService.getInstance();

        await db.getCollection('recipes').updateOne(
            { _id: record.dataId },
            {
                $set: {
                    ...record.data,
                    updatedAt: new Date(),
                },
            }
        );
    }

    /**
     * Sync a collection
     */
    private async syncCollection(record: OfflineData): Promise<void> {
        const db = DatabaseService.getInstance();

        await db.getCollection('collections').updateOne(
            { _id: record.dataId },
            {
                $set: {
                    ...record.data,
                    updatedAt: new Date(),
                },
            }
        );
    }

    /**
     * Sync a list
     */
    private async syncList(record: OfflineData): Promise<void> {
        const db = DatabaseService.getInstance();

        await db.getCollection('grocery_lists').updateOne(
            { _id: record.dataId },
            {
                $set: {
                    ...record.data,
                    updatedAt: new Date(),
                },
            }
        );
    }

    /**
     * Clear old offline data
     */
    async clearOldData(userId: string, maxAge: number): Promise<void> {
        const db = DatabaseService.getInstance();

        const cutoff = new Date(Date.now() - maxAge);

        await db.getCollection<OfflineData>('offline_data').deleteMany({
            userId: new ObjectId(userId),
            lastAccessed: { $lt: cutoff },
        });
    }

    /**
     * Download recipes for offline access
     */
    async downloadRecipes(userId: string, request: DownloadRequest): Promise<DownloadResult> {
        const db = DatabaseService.getInstance();
        const startTime = Date.now();
        const successful: string[] = [];
        const failed: { recipeId: string; error: string }[] = [];
        let totalSize = 0;

        try {
            // Get recipes
            const recipes = await db
                .getCollection('recipes')
                .find({ _id: { $in: request.recipeIds.map(id => new ObjectId(id)) } })
                .toArray();

            // Process each recipe
            for (const recipe of recipes) {
                try {
                    // Create offline recipe
                    const offlineRecipe: OfflineRecipe = {
                        _id: new ObjectId(),
                        userId: new ObjectId(userId),
                        recipe: {
                            id: recipe._id.toString(),
                            name: recipe.name,
                            description: recipe.description,
                            ingredients: recipe.ingredients,
                            instructions: recipe.instructions,
                            servings: recipe.servings,
                            prepTime: recipe.prepTime,
                            cookTime: recipe.cookTime,
                            totalTime: recipe.totalTime,
                            difficulty: recipe.difficulty,
                            cuisine: recipe.cuisine,
                            tags: recipe.tags,
                            images: recipe.images,
                            nutrition: recipe.nutrition,
                        },
                        attachments: [],
                        notes: [],
                        lastAccessed: new Date(),
                        lastModified: new Date(),
                        syncStatus: 'synced',
                        syncTimestamp: new Date(),
                        version: 1,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };

                    // Download attachments if requested
                    if (request.includeAttachments) {
                        offlineRecipe.attachments = await this.downloadAttachments(recipe.images, request.quality || 'high');
                        totalSize += offlineRecipe.attachments.reduce((sum: any, att: any) => sum + att.size, 0);
                    }

                    // Save offline recipe
                    await db.getCollection<OfflineRecipe>('offline_recipes').insertOne(offlineRecipe);

                    // Track sync operation
                    await this.trackSyncOperation(userId, 'download', recipe._id.toString());

                    successful.push(recipe._id.toString());
                } catch (error: any) {
                    failed.push({
                        recipeId: recipe._id.toString(),
                        error: error.message
                    });

                    await this.logError({
                        code: 'DOWNLOAD_FAILED',
                        message: error.message,
                        recipeId: recipe._id.toString(),
                        timestamp: new Date()
                    });
                }
            }

            // Log event
            await this.logEvent(userId, {
                type: 'download',
                status: failed.length === 0 ? 'success' : 'warning',
                message: `Downloaded ${successful.length} recipes, ${failed.length} failed`,
                details: { successful, failed },
                timestamp: new Date()
            });

            return {
                successful,
                failed,
                totalSize,
                duration: Date.now() - startTime
            };
        }
        catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            await this.logError({
                code: 'DOWNLOAD_ERROR',
                message: errorMessage,
                timestamp: new Date()
            });
            throw err;
        }
    }

    /**
     * Sync offline changes
     */
    async syncChanges(userId: string): Promise<void> {
        const db = DatabaseService.getInstance();

        try {
            // Get pending sync operations
            const operations = await db.getCollection<SyncOperation>('sync_operations').find({
                userId: new ObjectId(userId),
                status: 'pending'
            }).toArray();

            for (const operation of operations) {
                try {
                    // Update status to in_progress
                    await db.getCollection('sync_operations').updateOne({ _id: operation._id }, {
                        $set: {
                            status: 'in_progress',
                            startedAt: new Date(),
                            updatedAt: new Date()
                        }
                    });

                    // Process operation
                    switch (operation.type) {
                        case 'upload':
                            await this.processSyncUpload(operation);
                            break;
                        case 'download':
                            await this.processSyncDownload(operation);
                            break;
                        case 'delete':
                            await this.processSyncDelete(operation);
                            break;
                    }

                    // Mark as completed
                    await db.getCollection('sync_operations').updateOne({ _id: operation._id }, {
                        $set: {
                            status: 'completed',
                            completedAt: new Date(),
                            updatedAt: new Date()
                        }
                    });
                } catch (error: any) {
                    // Handle retry
                    if (operation.retryCount < await this.getRetryAttempts(userId)) {
                        await db.getCollection('sync_operations').updateOne({ _id: operation._id }, {
                            $set: {
                                status: 'pending',
                                error: error.message,
                                updatedAt: new Date()
                            },
                            $inc: { retryCount: 1 }
                        });
                    }
                    else {
                        // Mark as failed
                        await db.getCollection('sync_operations').updateOne({ _id: operation._id }, {
                            $set: {
                                status: 'failed',
                                error: error.message,
                                updatedAt: new Date()
                            }
                        });

                        await this.logError({
                            code: 'SYNC_FAILED',
                            message: error.message,
                            recipeId: operation.recipeId,
                            timestamp: new Date()
                        });
                    }
                }
            }

            // Update last sync timestamp
            await db.getCollection('offline_stats').updateOne({ userId: new ObjectId(userId) }, {
                $set: {
                    lastSync: new Date(),
                    updatedAt: new Date()
                }
            }, { upsert: true });

            // Log event
            await this.logEvent(userId, {
                type: 'sync',
                status: 'success',
                message: `Synced ${operations.length} operations`,
                details: { operations },
                timestamp: new Date()
            });
        }
        catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            await this.logError({
                code: 'SYNC_ERROR',
                message: errorMessage,
                timestamp: new Date()
            });
            throw err;
        }
    }

    /**
     * Clean up offline storage
     */
    async cleanupStorage(userId: string, options: CleanupOptions): Promise<CleanupResult> {
        const db = DatabaseService.getInstance();
        const removedRecipes: string[] = [];
        const removedAttachments: string[] = [];
        let spaceFreed = 0;

        try {
            // Build query
            const query: any = {
                userId: new ObjectId(userId)
            };

            if (options.olderThan) {
                query.lastAccessed = { $lt: options.olderThan };
            }

            if (options.excludeFavorites) {
                query['recipe.isFavorite'] = { $ne: true };
            }

            // Get recipes to remove
            const recipes = await db.getCollection<OfflineRecipe>('offline_recipes').find(query).toArray();

            if (!options.dryRun) {
                for (const recipe of recipes) {
                    // Remove attachments
                    for (const attachment of recipe.attachments) {
                        try {
                            await this.deleteAttachmentFile(attachment.localPath);
                            removedAttachments.push(attachment.localPath);
                            spaceFreed += attachment.size;
                        }
                        catch (err: unknown) {
                            const errorMessage = err instanceof Error ? err.message : String(err);
                            // Log error but continue
                            await this.logError({
                                code: 'CLEANUP_ATTACHMENT_ERROR',
                                message: errorMessage,
                                recipeId: recipe.recipe.id,
                                timestamp: new Date()
                            });
                        }
                    }

                    // Remove recipe
                    await db.getCollection('offline_recipes').deleteOne({ _id: recipe._id });
                    removedRecipes.push(recipe.recipe.id);
                }

                // Log event
                await this.logEvent(userId, {
                    type: 'cleanup',
                    status: 'success',
                    message: `Cleaned up ${removedRecipes.length} recipes`,
                    details: { removedRecipes, removedAttachments, spaceFreed },
                    timestamp: new Date()
                });
            }

            return {
                removedRecipes,
                removedAttachments,
                spaceFreed,
                dryRun: options.dryRun || false
            };
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.logError({
                code: 'CLEANUP_ERROR',
                message: errorMessage,
                timestamp: new Date()
            });

            throw error;
        }
    }

    /**
     * Get offline storage stats
     */
    async getStats(userId: string): Promise<OfflineStats> {
        const db = DatabaseService.getInstance();

        // Get recipes
        const recipes = await db.getCollection<OfflineRecipe>('offline_recipes').find({ userId: new ObjectId(userId) }).toArray();

        // Calculate stats
        const stats: OfflineStats = {
            totalSize: 0,
            recipeCount: recipes.length,
            attachmentSize: 0,
            lastSync: (await this.getLastSyncTime(userId)) || new Date(0),
            syncErrors: await this.countSyncErrors(userId),
            pendingChanges: await this.countPendingChanges(userId),
            storageUsage: {
                recipes: 0,
                attachments: 0,
                notes: 0,
                other: 0
            }
        };

        // Calculate storage usage
        for (const recipe of recipes) {
            // Recipe data
            const recipeSize = Buffer.from(JSON.stringify(recipe.recipe)).length;
            stats.storageUsage.recipes += recipeSize;
            stats.totalSize += recipeSize;

            // Attachments
            const attachmentsSize = recipe.attachments.reduce((sum: number, att: { size: number }) => sum + att.size, 0);
            stats.storageUsage.attachments += attachmentsSize;
            stats.attachmentSize += attachmentsSize;
            stats.totalSize += attachmentsSize;

            // Notes
            const notesSize = Buffer.from(JSON.stringify(recipe.notes)).length;
            stats.storageUsage.notes += notesSize;
            stats.totalSize += notesSize;
        }

        return stats;
    }

    private async getLastSyncTime(userId: string): Promise<Date | null> {
        const db = DatabaseService.getInstance();
        const stats = await db.getCollection('offline_stats').findOne({ userId: new ObjectId(userId) });
        return stats?.lastSync || null;
    }

    private async countSyncErrors(userId: string): Promise<number> {
        const db = DatabaseService.getInstance();
        return db.getCollection<SyncOperation>('sync_operations').countDocuments({
            userId: new ObjectId(userId),
            status: 'failed',
            updatedAt: {
                $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
        });
    }

    private async countPendingChanges(userId: string): Promise<number> {
        const db = DatabaseService.getInstance();
        return db.getCollection<SyncOperation>('sync_operations').countDocuments({
            userId: new ObjectId(userId),
            status: 'pending'
        });
    }

    /**
     * Helper: Download attachments
     */
    private async downloadAttachments(
        urls: string[],
        quality: 'original' | 'high' | 'medium' | 'low'
    ): Promise<OfflineRecipe['attachments']> {
        // Implement attachment download and optimization
        return [];
    }

    /**
     * Helper: Delete attachment file
     */
    private async deleteAttachmentFile(_path: string): Promise<void> {
        // Implement file deletion
    }

    /**
     * Helper: Track sync operation
     */
    private async trackSyncOperation(
        userId: string,
        type: 'upload' | 'download' | 'delete',
        recipeId: string
    ): Promise<void> {
        const db = DatabaseService.getInstance();

        const operation: InsertableDocument<SyncOperation> = {
            _id: new ObjectId(),
            userId: new ObjectId(userId),
            type,
            recipeId,
            status: 'pending',
            retryCount: 0,
            changes: [],
            timestamp: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await db.getCollection<SyncOperation>('sync_operations').insertOne(operation);
    }

    /**
     * Helper: Process sync operations
     */
    private async processSyncUpload(_operation: SyncOperation): Promise<void> {
        // Implement sync upload
    }

    private async processSyncDownload(_operation: SyncOperation): Promise<void> {
        // Implement sync download
    }

    private async processSyncDelete(_operation: SyncOperation): Promise<void> {
        // Implement sync delete
    }

    /**
     * Helper: Get retry attempts from settings
     */
    private async getRetryAttempts(userId: string): Promise<number> {
        const db = DatabaseService.getInstance();

        const settings = await db
            .getCollection('user_settings')
            .findOne({ userId: new ObjectId(userId) });

        return settings?.offline?.retryAttempts || this.defaultSettings.retryAttempts;
    }

    /**
     * Helper: Log error
     */
    private async logError(error: Partial<OfflineError>): Promise<void> {
        const db = DatabaseService.getInstance();
        const errorDoc = {
            _id: new ObjectId(),
            code: error.code || 'UNKNOWN_ERROR',
            message: error.message || 'An unknown error occurred',
            details: error.details || {},
            stack: error instanceof Error ? error.stack ?? undefined : undefined,
            recipeId: error.recipeId ?? undefined,
            timestamp: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        } as const;

        await db.getCollection<OfflineError>('offline_errors').insertOne(errorDoc as unknown as InsertableDocument<OfflineError>);
    }

    /**
     * Helper: Log event
     */
    private async logEvent(
        userId: string,
        event: Omit<OfflineEvent, '_id' | 'userId' | 'createdAt' | 'updatedAt'>
    ): Promise<void> {
        const db = DatabaseService.getInstance();

        const offlineEvent: InsertableDocument<OfflineEvent> = {
            _id: new ObjectId(),
            userId: new ObjectId(userId),
            type: event.type,
            status: event.status,
            message: event.message,
            details: event.details || {},
            timestamp: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await db.getCollection<OfflineEvent>('offline_events').insertOne(offlineEvent);
    }
}
