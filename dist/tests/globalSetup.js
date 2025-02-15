import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectToDatabase } from '../db.js';
import { createIndexes } from '../db/indexes.js';
import { CacheService } from '../services/cache.service.js';
export default async function globalSetup() {
    // Start MongoDB Memory Server
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    // Set environment variables for testing
    process.env.MONGODB_URI = uri;
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    // Store mongod instance for teardown
    global.__MONGOD__ = mongod;
    try {
        // Initialize database connection
        const db = await connectToDatabase();
        // Create indexes
        await createIndexes();
        // Initialize cache service
        CacheService.getInstance();
        console.log('Test environment setup complete');
    }
    catch (error) {
        console.error('Failed to setup test environment:', error);
        throw error;
    }
}
//# sourceMappingURL=globalSetup.js.map