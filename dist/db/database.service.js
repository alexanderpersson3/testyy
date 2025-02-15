import { MongoClient, Db, Collection } from 'mongodb';
import logger from '../utils/logger.js';
export class DatabaseService {
    constructor() {
        // Properties will be initialized in connect()
    }
    static getInstance() {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }
    getCollection(name) {
        if (!this.db) {
            throw new Error('Database not connected');
        }
        return this.db.collection(name);
    }
    async connect() {
        if (this.client)
            return;
        try {
            this.client = await MongoClient.connect(process.env.MONGODB_URI || '');
            this.db = this.client.db();
            logger.info('Connected to MongoDB');
        }
        catch (error) {
            logger.error('Failed to connect to MongoDB:', error);
            throw error;
        }
    }
    async disconnect() {
        if (this.client) {
            await this.client.close();
            this.client = undefined;
            this.db = undefined;
        }
    }
    async insertOne(collection, doc) {
        const now = new Date();
        const docWithTimestamps = {
            ...doc,
            createdAt: now,
            updatedAt: now,
        };
        const result = await this.getCollection(collection).insertOne(docWithTimestamps);
        if (!result.acknowledged) {
            throw new Error('Failed to insert document');
        }
        const inserted = await this.getCollection(collection).findOne({ _id: result.insertedId });
        if (!inserted) {
            throw new Error('Failed to retrieve inserted document');
        }
        return inserted;
    }
    async findOne(collection, filter, options) {
        return this.getCollection(collection).findOne(filter, options);
    }
    async findMany(collection, filter, options) {
        return this.getCollection(collection).find(filter, options).toArray();
    }
    async updateOne(collection, filter, update, options) {
        const updateDoc = {
            $set: {
                ...update,
                updatedAt: new Date()
            }
        };
        const result = await this.getCollection(collection).findOneAndUpdate(filter, updateDoc, { ...options, returnDocument: 'after' });
        return result.value;
    }
    async deleteOne(collection, filter) {
        const result = await this.getCollection(collection).deleteOne(filter);
        return result.acknowledged && result.deletedCount === 1;
    }
    async bulkWrite(collection, operations, options) {
        const result = await this.getCollection(collection).bulkWrite(operations, options);
        return result.insertedCount > 0 || result.modifiedCount > 0 || result.deletedCount > 0;
    }
    async paginate(collection, filter, options) {
        const page = Math.max(1, options.page || 1);
        const limit = Math.max(1, Math.min(100, options.limit || 10));
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.getCollection(collection)
                .find(filter)
                .sort(options.sort ? { [options.sort]: options.order === 'desc' ? -1 : 1 } : { _id: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            this.getCollection(collection).countDocuments(filter)
        ]);
        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }
    async aggregate(collection, pipeline) {
        return this.getCollection(collection).aggregate(pipeline).toArray();
    }
    async isConnected() {
        if (!this.client || !this.db)
            return false;
        try {
            await this.db.command({ ping: 1 });
            return true;
        }
        catch {
            return false;
        }
    }
    getDb() {
        if (!this.db) {
            throw new Error('Database not connected');
        }
        return this.db;
    }
}
// Create and export the singleton instance
export const db = DatabaseService.getInstance();
// Export the connect function
export async function connectToDatabase() {
    const service = DatabaseService.getInstance();
    await service.connect();
    return service.getDb();
}
export default DatabaseService;
//# sourceMappingURL=database.service.js.map