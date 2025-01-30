import Redis from 'ioredis';
let redisClient = null;
export const getRedisClient = async () => {
    if (!redisClient) {
        redisClient = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        });
        redisClient.on('error', (error) => {
            console.error('Redis connection error:', error);
        });
        redisClient.on('connect', () => {
            console.log('Connected to Redis');
        });
    }
    return redisClient;
};
//# sourceMappingURL=redis.js.map