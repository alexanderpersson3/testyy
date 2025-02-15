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
import type { Db } from 'mongodb';

// Initialize singleton database instance
const db = DatabaseService.getInstance();

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
