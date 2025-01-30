import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();
let db = null;
let client = null;
export async function connectToDatabase() {
    if (db)
        return db;
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
        const dbName = process.env.DB_NAME || 'rezepta';
        client = await MongoClient.connect(uri);
        db = client.db(dbName);
        console.log('Connected to MongoDB');
        return db;
    }
    catch (err) {
        console.error('Error connecting to MongoDB:', err);
        throw err;
    }
}
export async function getDb() {
    if (!db) {
        await connectToDatabase();
    }
    if (!db) {
        throw new Error('Database connection not established');
    }
    return db;
}
export async function closeConnection() {
    if (client) {
        await client.close();
        db = null;
        client = null;
        console.log('Closed MongoDB connection');
    }
}
//# sourceMappingURL=db.js.map