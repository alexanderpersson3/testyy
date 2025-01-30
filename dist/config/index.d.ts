/**
 * Application configuration module that centralizes all configurable settings.
 * Supports environment-specific configuration through environment variables
 * while providing sensible defaults for development.
 *
 * @module config
 */
/**
 * Configuration interface defining all available settings
 */
interface Config {
    redis: {
        /** Redis connection URL */
        url: string;
        /** Redis client options */
        options: {
            /**
             * Retry strategy for Redis connection failures
             * @param {number} times - Number of connection attempts
             * @returns {number | null} Delay in ms before next attempt, or null to stop retrying
             */
            retryStrategy: (times: number) => number | null;
        };
    };
    rateLimits: {
        /** Rate limiting settings for general API endpoints */
        api: {
            /** Time window for rate limiting in milliseconds */
            windowMs: number;
            /** Maximum number of requests allowed within the window */
            max: number;
        };
        /** Rate limiting settings for authentication endpoints */
        auth: {
            /** Time window for rate limiting in milliseconds */
            windowMs: number;
            /** Maximum number of authentication attempts allowed within the window */
            max: number;
        };
        /** Rate limiting settings for search endpoints */
        search: {
            /** Time window for rate limiting in milliseconds */
            windowMs: number;
            /** Maximum number of search requests allowed within the window */
            max: number;
        };
        /** Rate limiting settings for admin endpoints */
        admin: {
            /** Time window for rate limiting in milliseconds */
            windowMs: number;
            /** Maximum number of admin requests allowed within the window */
            max: number;
        };
    };
}
/**
 * Application configuration object with environment-specific settings
 * and sensible defaults for development.
 *
 * @type {Config}
 */
declare const config: Config;
export default config;
//# sourceMappingURL=index.d.ts.map