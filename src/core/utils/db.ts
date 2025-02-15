;
;
import type { Collection } from 'mongodb';
import { MongoClient, Db } from 'mongodb';;
import logger from '../utils/logger.js';

let db: Db | null = null;
const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/rezepta');

export async function connectToDatabase(): Promise<Db> {
  if (db) return db;

  try {
    await client.connect();
    db = client.db();
    logger.info('Connected to MongoDB');
    return db;
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function getCollection<T extends Document>(name: string): Promise<Collection<T>> {
  const db = await connectToDatabase();
  return db.collection<T>(name);
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    db = null;
    logger.info('Disconnected from MongoDB');
  }
}

export function getDb(): Db | null {
  return db;
}
