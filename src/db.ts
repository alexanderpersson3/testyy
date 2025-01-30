import { MongoClient, Db } from 'mongodb';
import { config } from './config';

let client: MongoClient;
let db: Db;

export async function connectToDatabase(): Promise<Db> {
  if (db) {
    return db;
  }

  try {
    client = await MongoClient.connect(config.mongodb.uri);
    db = client.db(config.mongodb.dbName);
    console.log('Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export async function getDb(): Promise<Db> {
  if (!db) {
    await connectToDatabase();
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
  }
} 