/**
 * Application configuration module that centralizes all configurable settings.
 * Supports environment-specific configuration through environment variables
 * while providing sensible defaults for development.
 *
 * @module config
 */
/**
 * Application configuration object with environment-specific settings
 * and sensible defaults for development.
 *
 * @type {Config}
 */
const config = {
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        options: {
            retryStrategy: (times) => {
                if (times > 3) {
                    console.error('Redis connection failed');
                    return null;
                }
                return Math.min(times * 100, 3000);
            }
        }
    },
    rateLimits: {
        api: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        },
        auth: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5 // limit each IP to 5 login attempts per windowMs
        },
        search: {
            windowMs: 60 * 1000, // 1 minute
            max: 30 // limit each IP to 30 searches per windowMs
        },
        admin: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 1000 // limit each IP to 1000 requests per windowMs
        }
    }
};
export default config;
//# sourceMappingURL=index.js.map