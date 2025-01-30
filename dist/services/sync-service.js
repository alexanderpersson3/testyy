import { ObjectId } from 'mongodb';
import { getDb } from '../config/db';
export class SyncService {
    constructor() {
        this.versionField = 'version';
        this.initialized = false;
        this.initializeCollection().catch(error => {
            console.error('Failed to initialize sync service:', error);
        });
    }
    async initializeCollection() {
        if (this.initialized)
            return;
        const db = await getDb();
        this.collection = db.collection('sync_batches');
        // Create indexes
        await this.collection.createIndex({ userId: 1, status: 1 });
        await this.collection.createIndex({ userId: 1, deviceId: 1, timestamp: -1 });
        await this.collection.createIndex({ 'items.id': 1 });
        this.initialized = true;
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initializeCollection();
        }
    }
    async queueSync(userId, deviceId, items) {
        const now = new Date();
        const batch = {
            userId,
            deviceId,
            items: items.map(item => ({
                ...item,
                version: 1,
                lastModified: now
            })),
            status: 'pending',
            conflicts: [],
            timestamp: now,
            createdAt: now,
            updatedAt: now
        };
        await this.collection.insertOne(batch);
        return batch;
    }
    async processBatch(batchId) {
        const batch = await this.collection.findOne({ _id: batchId });
        if (!batch) {
            throw new Error('Batch not found');
        }
        const conflicts = await this.checkConflicts(batch);
        if (conflicts.length > 0) {
            await this.collection.updateOne({ _id: batchId }, {
                $set: {
                    status: 'conflict',
                    conflicts,
                    updatedAt: new Date()
                }
            });
            return {
                success: false,
                conflicts: conflicts.map(c => ({
                    itemId: c.itemId,
                    type: c.type,
                    message: `Version conflict: server version ${c.serverVersion} > client version ${c.clientVersion}`
                }))
            };
        }
        // Apply changes if no conflicts
        const db = await getDb();
        for (const item of batch.items) {
            await db.collection(this.getCollectionName(item.type)).updateOne({ _id: new ObjectId(item.id) }, {
                $set: {
                    ...item.data,
                    [this.versionField]: item.version,
                    updatedAt: new Date()
                }
            });
        }
        await this.collection.updateOne({ _id: batchId }, {
            $set: {
                status: 'synced',
                completedAt: new Date(),
                updatedAt: new Date()
            }
        });
        return { success: true };
    }
    async resolveConflict(batchId, resolutions) {
        const batch = await this.collection.findOne({ _id: batchId });
        if (!batch || batch.status !== 'conflict') {
            throw new Error('Invalid batch or batch not in conflict state');
        }
        const db = await getDb();
        const now = new Date();
        for (const resolution of resolutions) {
            const item = batch.items.find(i => i.id === resolution.itemId);
            if (!item)
                continue;
            const data = resolution.resolution === 'client' ? item.data :
                resolution.resolution === 'manual' ? resolution.manualData :
                    await this.getServerVersion(item.type, item.id);
            await db.collection(this.getCollectionName(item.type)).updateOne({ _id: new ObjectId(item.id) }, {
                $set: {
                    ...data,
                    [this.versionField]: item.version + 1,
                    updatedAt: now
                }
            });
        }
        await this.collection.updateOne({ _id: batchId }, {
            $set: {
                status: 'synced',
                completedAt: now,
                updatedAt: now
            }
        });
    }
    async checkConflicts(batch) {
        const conflicts = [];
        const db = await getDb();
        for (const item of batch.items) {
            const serverItem = await db.collection(this.getCollectionName(item.type))
                .findOne({ _id: new ObjectId(item.id) });
            if (serverItem) {
                const serverVersion = serverItem[this.versionField] || 1;
                if (serverVersion > item.version) {
                    conflicts.push({
                        itemId: item.id,
                        type: item.type,
                        clientVersion: item.version,
                        serverVersion
                    });
                }
            }
        }
        return conflicts;
    }
    async getServerVersion(type, id) {
        const db = await getDb();
        return await db.collection(this.getCollectionName(type))
            .findOne({ _id: new ObjectId(id) });
    }
    getCollectionName(type) {
        switch (type) {
            case 'recipe': return 'recipes';
            case 'shopping_list': return 'shopping_lists';
            case 'collection': return 'collections';
            default: throw new Error(`Invalid sync item type: ${type}`);
        }
    }
}
//# sourceMappingURL=sync-service.js.map