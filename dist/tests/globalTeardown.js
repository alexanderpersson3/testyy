import { MongoMemoryServer } from 'mongodb-memory-server';
import { CacheService } from '../services/cache.service.js';
export default async function globalTeardown() {
    // Get mongod instance
    const mongod = global.__MONGOD__;
    try {
        // Clear cache
        const cacheService = CacheService.getInstance();
        await cacheService.clear();
        // Stop MongoDB Memory Server
        if (mongod) {
            await mongod.stop();
        }
        // Clear environment variables
        delete process.env.MONGODB_URI;
        delete process.env.JWT_SECRET;
        delete process.env.NODE_ENV;
        delete process.env.REDIS_HOST;
        delete process.env.REDIS_PORT;
        console.log('Test environment teardown complete');
    }
    catch (error) {
        console.error('Failed to teardown test environment:', error);
        throw error;
    }
}
//# sourceMappingURL=globalTeardown.js.map