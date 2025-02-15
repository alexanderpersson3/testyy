import { connectToDatabase } from '../db/database.service.js';
import { SyncBatch, SyncItem, SyncStatus } from '../types/sync.js';
export class SyncService {
    constructor() {
        this.initializeCollection();
    }
    async initializeCollection() {
        const db = await connectToDatabase();
        this.collection = db.collection('sync_batches');
    }
    async createBatch(items, clientId) {
        try {
            const db = await connectToDatabase();
            const now = new Date();
            const batch = {
                _id: new ObjectId(),
                items,
                clientId,
                timestamp: now,
                status: 'pending',
                createdAt: now,
                updatedAt: now,
            };
            const result = await this.collection.insertOne(batch);
            return result.insertedId.toString();
        }
        catch (error) {
            throw new Error(`Failed to create sync batch: ${error}`);
        }
    }
    async processBatch(batchId) {
        try {
            const db = await connectToDatabase();
            const batch = await this.collection.findOne({ _id: new ObjectId(batchId) });
            if (!batch) {
                throw new Error('Batch not found');
            }
            for (const item of batch.items) {
                if (item.deleted) {
                    await db
                        .collection(this.getCollectionName(item))
                        .deleteOne({ _id: new ObjectId(item.id) });
                }
                else if (item.data) {
                    await db
                        .collection(this.getCollectionName(item))
                        .updateOne({ _id: new ObjectId(item.id) }, { $set: item.data });
                }
            }
            await this.collection.updateOne({ _id: new ObjectId(batchId) }, {
                $set: {
                    status: 'completed',
                    completedAt: new Date(),
                    updatedAt: new Date(),
                },
            });
        }
        catch (error) {
            throw new Error(`Failed to process sync batch: ${error}`);
        }
    }
    getCollectionName(item) {
        // Determine collection name based on the item's data structure or a type field
        // This is a simplified example - you'll need to implement the actual logic
        if (item.data?.type === 'recipe')
            return 'recipes';
        if (item.data?.type === 'user')
            return 'users';
        if (item.data?.type === 'profile')
            return 'profiles';
        if (item.data?.type === 'collection')
            return 'collections';
        throw new Error(`Unable to determine collection name for item: ${item.id}`);
    }
}
export const syncService = new SyncService();
//# sourceMappingURL=sync-service.js.map