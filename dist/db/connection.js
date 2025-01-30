import { MongoClient } from 'mongodb';
let client = null;
let db = null;
export async function connectToDatabase() {
    if (db) {
        return db;
    }
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rezepta';
    client = await MongoClient.connect(uri);
    db = client.db();
    return db;
}
export async function closeDatabase() {
    if (client) {
        await client.close();
        client = null;
        db = null;
    }
}
/** @deprecated Use connectToDatabase() instead */
export function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call connectToDatabase() first.');
    }
    return db;
}
//# sourceMappingURL=connection.js.map