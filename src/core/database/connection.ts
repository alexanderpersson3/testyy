import { Db } from 'mongodb';;
import { db } from '../database.service.js';;

/**
 * Get the database instance
 */
export async function getDb(): Promise<Db> {
  await db.connect();
  return db.getDb();
}

/**
 * Ensure database connection
 */
export async function ensureConnection(): Promise<void> {
  await db.connect();
}

/**
 * Check if database is connected
 */
export async function isConnected(): Promise<boolean> {
  return db.isConnected();
}

/**
 * Disconnect from database
 */
export async function disconnect(): Promise<void> {
  await db.disconnect();
}
