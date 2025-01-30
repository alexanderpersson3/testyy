import { MongoClient } from 'mongodb';
import { config } from './config';
let client;
let db;
export async function connectToDatabase() {
    if (db) {
        return db;
    }
    try {
        client = await MongoClient.connect(config.mongodb.uri);
        db = client.db(config.mongodb.dbName);
        console.log('Connected to MongoDB');
        return db;
    }
    catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}
export async function getDb() {
    if (!db) {
        await connectToDatabase();
    }
    return db;
}
export async function closeDatabase() {
    if (client) {
        await client.close();
        console.log('MongoDB connection closed');
    }
}
//# sourceMappingURL=db.js.map