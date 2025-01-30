import { ObjectId } from 'mongodb';
export class SyncService {
    constructor(collection, versionField = 'version') {
        this.collection = collection;
        this.versionField = versionField;
    }
    async sync(batch) {
        try {
            // Check for conflicts
            const conflicts = await this.checkConflicts(batch);
            if (conflicts.length > 0) {
                return {
                    success: false,
                    conflicts
                };
            }
            // Apply changes
            for (const item of batch.items) {
                if (item.deleted) {
                    await this.collection.deleteOne({ _id: new ObjectId(item.id) });
                }
                else if (item.data) {
                    const update = {
                        ...item.data,
                        [this.versionField]: item.version
                    };
                    await this.collection.updateOne({ _id: new ObjectId(item.id) }, { $set: update }, { upsert: true });
                }
            }
            const newVersion = Math.max(...batch.items.map(item => item.version)) + 1;
            return {
                success: true,
                newVersion
            };
        }
        catch (error) {
            console.error('Sync error:', error);
            return {
                success: false,
                conflicts: [{
                        type: 'conflict',
                        message: error instanceof Error ? error.message : 'Unknown error',
                        item: null
                    }]
            };
        }
    }
    async queueSync(userId, items) {
        const now = new Date();
        const batch = {
            userId,
            items: items.map(item => ({
                ...item,
                version: item.version || 1
            })),
            status: 'pending',
            clientId: items[0]?.clientId || '',
            timestamp: now,
            conflicts: [],
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
        return this.sync(batch);
    }
    async getConflicts(userId) {
        const conflicts = await this.collection.find({
            userId,
            'conflicts.status': 'conflict'
        }).toArray();
        return conflicts;
    }
    async resolveConflict(conflictId, resolution, manualData) {
        const now = new Date();
        await this.collection.updateOne({ _id: conflictId }, {
            $set: {
                resolution,
                resolvedData: manualData,
                resolvedAt: now,
                updatedAt: now
            }
        });
    }
    async getSyncStatus(userId, deviceId, lastSyncedAt) {
        const query = { userId, deviceId };
        if (lastSyncedAt) {
            query.updatedAt = { $gt: lastSyncedAt };
        }
        const [pendingChanges, conflicts] = await Promise.all([
            this.collection.countDocuments({
                ...query,
                status: 'pending'
            }),
            this.collection.countDocuments({
                ...query,
                'conflicts.status': 'conflict'
            })
        ]);
        const lastSync = await this.collection
            .find({ userId, deviceId, status: 'completed' })
            .sort({ completedAt: -1 })
            .limit(1)
            .toArray();
        return {
            pendingChanges,
            conflicts,
            lastSyncedAt: lastSync[0]?.completedAt || null
        };
    }
    async checkConflicts(batch) {
        const conflicts = [];
        for (const item of batch.items) {
            const existing = await this.collection.findOne({
                _id: new ObjectId(item.id)
            });
            if (existing) {
                const currentVersion = existing[this.versionField] || 0;
                if (currentVersion > item.version) {
                    conflicts.push({
                        type: 'conflict',
                        message: `Version conflict: server version ${currentVersion} > client version ${item.version}`,
                        item: existing
                    });
                }
            }
        }
        return conflicts;
    }
}
//# sourceMappingURL=syncService.js.map