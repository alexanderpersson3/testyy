import { ObjectId } from 'mongodb';
;
import { connectToDatabase } from '../db.js';
import logger from '../utils/logger.js';
export class OfflineSyncService {
    constructor() { }
    static getInstance() {
        if (!OfflineSyncService.instance) {
            OfflineSyncService.instance = new OfflineSyncService();
        }
        return OfflineSyncService.instance;
    }
    /**
     * Record sync operation
     */
    async recordOperation(operation) {
        const db = await connectToDatabase();
        const now = new Date();
        const newOperation = {
            ...operation,
            status: 'pending',
            timestamp: now,
        };
        const result = await db.collection('sync_operations').insertOne(newOperation);
        return {
            ...newOperation,
            _id: result.insertedId,
        };
    }
    /**
     * Get pending operations
     */
    async getPendingOperations(userId, deviceId) {
        const db = await connectToDatabase();
        return db
            .collection('sync_operations')
            .find({
            userId,
            deviceId,
            status: 'pending',
        })
            .sort({ timestamp: 1 })
            .toArray();
    }
    /**
     * Get sync state
     */
    async getSyncState(userId, deviceId) {
        const db = await connectToDatabase();
        return db.collection('sync_states').findOne({
            userId,
            deviceId,
        });
    }
    /**
     * Update sync state
     */
    async updateSyncState(userId, deviceId, collections) {
        const db = await connectToDatabase();
        const now = new Date();
        const defaultState = {
            userId,
            deviceId,
            lastSyncTimestamp: now,
            collections: {},
            createdAt: now,
            updatedAt: now,
        };
        // Convert collections to the correct format
        const syncCollections = {};
        for (const [collection, { version }] of Object.entries(collections)) {
            syncCollections[collection] = {
                lastSyncTimestamp: now,
                version,
            };
        }
        const updates = {
            lastSyncTimestamp: now,
            collections: syncCollections,
            updatedAt: now,
        };
        const result = await db.collection('sync_states').findOneAndUpdate({ userId, deviceId }, {
            $set: updates,
            $setOnInsert: defaultState,
        }, {
            returnDocument: 'after',
            upsert: true,
        });
        if (!result.value) {
            throw new Error('Failed to update sync state');
        }
        return result.value;
    }
    /**
     * Sync changes
     */
    async syncChanges(userId, deviceId, operations) {
        const db = await connectToDatabase();
        const result = {
            success: true,
            operations: {
                total: operations.length,
                completed: 0,
                failed: 0,
            },
            timestamp: new Date(),
        };
        const errors = [];
        for (const operation of operations) {
            try {
                switch (operation.type) {
                    case 'create':
                        await this.handleCreate(operation);
                        break;
                    case 'update':
                        await this.handleUpdate(operation);
                        break;
                    case 'delete':
                        await this.handleDelete(operation);
                        break;
                }
                // Mark operation as completed
                await db.collection('sync_operations').updateOne({ _id: operation._id }, {
                    $set: {
                        status: 'completed',
                        syncedAt: new Date(),
                    },
                });
                result.operations.completed++;
            }
            catch (error) {
                // Mark operation as failed
                await db.collection('sync_operations').updateOne({ _id: operation._id }, {
                    $set: {
                        status: 'failed',
                        error: error instanceof Error ? error.message : 'Unknown error',
                        syncedAt: new Date(),
                    },
                });
                errors.push({
                    operation,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                result.operations.failed++;
            }
        }
        if (errors.length > 0) {
            result.success = false;
            result.errors = errors;
        }
        // Update sync state
        await this.updateSyncState(userId, deviceId, {});
        return result;
    }
    /**
     * Handle create operation
     */
    async handleCreate(operation) {
        const db = await connectToDatabase();
        const document = {
            _id: operation.documentId,
            ...operation.changes,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await db.collection(operation.collection).insertOne(document);
    }
    /**
     * Handle update operation
     */
    async handleUpdate(operation) {
        const db = await connectToDatabase();
        const updates = {
            ...operation.changes,
            updatedAt: new Date(),
        };
        const result = await db
            .collection(operation.collection)
            .updateOne({ _id: operation.documentId }, { $set: updates });
        if (result.matchedCount === 0) {
            throw new Error('Document not found');
        }
    }
    /**
     * Handle delete operation
     */
    async handleDelete(operation) {
        const db = await connectToDatabase();
        const result = await db.collection(operation.collection).deleteOne({
            _id: operation.documentId,
        });
        if (result.deletedCount === 0) {
            throw new Error('Document not found');
        }
    }
    /**
     * Get changes since last sync
     */
    async getChangesSinceLastSync(userId, deviceId, collections) {
        const db = await connectToDatabase();
        const syncState = await this.getSyncState(userId, deviceId);
        const changes = {};
        for (const collection of collections) {
            const lastSync = syncState?.collections[collection]?.lastSyncTimestamp || new Date(0);
            changes[collection] = await db
                .collection(collection)
                .find({
                $or: [{ updatedAt: { $gt: lastSync } }, { createdAt: { $gt: lastSync } }],
            })
                .toArray();
        }
        return changes;
    }
}
//# sourceMappingURL=offline-sync.service.js.map