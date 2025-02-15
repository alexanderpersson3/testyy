import { Db } from 'mongodb';
import { db } from '../database.service.js';
/**
 * Get the database instance
 */
export async function getDb() {
    await db.connect();
    return db.getDb();
}
/**
 * Ensure database connection
 */
export async function ensureConnection() {
    await db.connect();
}
/**
 * Check if database is connected
 */
export async function isConnected() {
    return db.isConnected();
}
/**
 * Disconnect from database
 */
export async function disconnect() {
    await db.disconnect();
}
//# sourceMappingURL=connection.js.map