/**
 * Application configuration module that centralizes all configurable settings.
 * Supports environment-specific configuration through environment variables
 * while providing sensible defaults for development.
 *
 * @module config
 */
import dotenv from 'dotenv';
dotenv.config();
export const config = {
    elasticsearch: {
        url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
        username: process.env.ELASTICSEARCH_USERNAME || '',
        password: process.env.ELASTICSEARCH_PASSWORD || '',
    },
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
        dbName: process.env.MONGODB_DB_NAME || 'rezepta',
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10),
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },
    rateLimiting: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
    },
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || '*',
        credentials: true,
    },
    server: {
        port: parseInt(process.env.PORT || '3000', 10),
        host: process.env.HOST || 'localhost',
    },
    gcp: {
        projectId: process.env.GCP_PROJECT_ID || '',
        bucket: process.env.GCP_BUCKET || '',
    },
};
export default config;
//# sourceMappingURL=index.js.map