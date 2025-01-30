import Redis from 'ioredis';
const REDIS_CONFIG = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};
class RedisClient {
    constructor() {
        this.client = new Redis(REDIS_CONFIG);
        this.client.on('error', (error) => {
            console.error('Redis connection error:', error);
        });
        this.client.on('connect', () => {
            console.log('Connected to Redis');
        });
    }
    static getInstance() {
        if (!RedisClient.instance) {
            RedisClient.instance = new RedisClient();
        }
        return RedisClient.instance;
    }
    async get(key) {
        return this.client.get(key);
    }
    async set(key, value) {
        return this.client.set(key, value);
    }
    async setex(key, seconds, value) {
        return this.client.setex(key, seconds, value);
    }
    async del(key) {
        return this.client.del(key);
    }
    async flushdb() {
        return this.client.flushdb();
    }
    async disconnect() {
        await this.client.disconnect();
    }
}
export const redis = RedisClient.getInstance();
//# sourceMappingURL=redis.js.map