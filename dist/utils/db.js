import { MongoClient, Db } from 'mongodb';
import logger from '../logger.js';
let db = null;
const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/rezepta');
export async function connectToDatabase() {
    if (db)
        return db;
    try {
        await client.connect();
        db = client.db();
        logger.info('Connected to MongoDB');
        return db;
    }
    catch (error) {
        logger.error('Failed to connect to MongoDB:', error);
        throw error;
    }
}
export async function getCollection(name) {
    const db = await connectToDatabase();
    return db.collection(name);
}
export async function closeDatabase() {
    if (client) {
        await client.close();
        db = null;
        logger.info('Disconnected from MongoDB');
    }
}
export function getDb() {
    return db;
}
//# sourceMappingURL=db.js.map