import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

let db: Db | null = null;
let client: MongoClient | null = null;

export async function connectToDatabase(): Promise<Db> {
  if (db) return db;

  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.DB_NAME || 'rezepta';

    client = await MongoClient.connect(uri);
    db = client.db(dbName);

    console.log('Connected to MongoDB');
    return db;
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    throw err;
  }
}

export async function getDb(): Promise<Db> {
  if (!db) {
    await connectToDatabase();
  }
  if (!db) {
    throw new Error('Database connection not established');
  }
  return db;
}

export async function closeConnection(): Promise<void> {
  if (client) {
    await client.close();
    db = null;
    client = null;
    console.log('Closed MongoDB connection');
  }
} 