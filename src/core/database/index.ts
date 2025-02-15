export * from './base.repository.js';
export * from './connection.js';
export * from './database.service.js';
export * from './types/index.js';

// Re-export commonly used classes and functions
export { BaseRepository } from './base.repository.js';
export { DatabaseService } from './database.service.js';
export { getDb, ensureConnection, isConnected, disconnect } from './connection.js';

import type { Collection } from 'mongodb';
import type { Document, ObjectId } from '../types/express.js';
import { MongoClient, Db } from 'mongodb';

// Initialize singleton database instance
const db = DatabaseService.getInstance();

interface DatabaseConnection {
  client: MongoClient;
  db: Db;
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<DatabaseConnection> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  if (!process.env.DB_NAME) {
    throw new Error('DB_NAME environment variable is not set');
  }

  const client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME);

    // Verify connection
    await db.command({ ping: 1 });

    cachedClient = client;
    cachedDb = db;

    return { client, db };
  } catch (error) {
    console.error('Database connection error:', error instanceof Error ? error.message : String(error));
    throw new Error('Failed to connect to database');
  }
}

export async function disconnect(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
}

/**
 * Ensure database connection is established
 */
export async function ensureConnection(): Promise<void> {
  if (!(await db.isConnected())) {
    await db.connect();
  }
}

/**
 * Get a typed collection
 */
export function getCollection<T extends Document>(name: string): Collection<T> {
  return db.getCollection<T>(name);
}

/**
 * Get the database instance
 */
export function getDb(): Db {
  return db.getDb();
}

// Export the database instance and service
export { db, DatabaseService };
export { connect as connectToDatabase };

// Export types
export type { Db, Collection, Document, ObjectId };
