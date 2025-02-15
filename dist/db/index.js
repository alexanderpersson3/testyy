import {} from 'mongodb';
import { connectToDatabase as connect, DatabaseService } from '@/db/database.service';
// Initialize singleton database instance
const db = DatabaseService.getInstance();
/**
 * Ensure database connection is established
 */
export async function ensureConnection() {
    if (!(await db.isConnected())) {
        await db.connect();
    }
}
/**
 * Get a typed collection
 */
export function getCollection(name) {
    return db.getCollection(name);
}
/**
 * Get the database instance
 */
export function getDb() {
    return db.getDb();
}
// Export the database instance and service
export { db, DatabaseService };
export { connect as connectToDatabase };
//# sourceMappingURL=index.js.map