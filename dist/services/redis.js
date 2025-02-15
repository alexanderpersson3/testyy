import Redis from 'ioredis';
import { config } from '../config.js';
class RedisClient {
    constructor() {
        this.client = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.db,
        });
        this.client.on('error', error => {
            console.error('Redis Client Error:', error);
        });
        this.client.on('connect', () => {
            console.log('Redis Client Connected');
        });
    }
    getClient() {
        return this.client;
    }
    async get(key) {
        return this.client.get(key);
    }
    async set(key, value, expireSeconds) {
        if (expireSeconds) {
            return this.client.set(key, value, 'EX', expireSeconds);
        }
        return this.client.set(key, value);
    }
    async del(key) {
        return this.client.del(key);
    }
    async clear() {
        return this.client.flushdb();
    }
    async disconnect() {
        await this.client.disconnect();
    }
}
// Create a singleton instance
const redisClientInstance = new RedisClient();
// Export the Redis client instance for direct Redis operations
export const redis = redisClientInstance.getClient();
// Export the RedisClient instance for higher-level operations
export default redisClientInstance;
//# sourceMappingURL=redis.js.map