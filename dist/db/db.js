import { Db } from 'mongodb';
import { db, connectToDatabase } from '../database.service.js';
// Re-export everything from database.service
export * from '../database.service.js';
// Helper function to get a typed collection
export function getCollection(name) {
    return db.getCollection(name);
}
// Helper function to get the database instance
export function getDb() {
    return db.getDb();
}
// Re-export the database instance
export { db };
//# sourceMappingURL=db.js.map