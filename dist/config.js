export const config = {
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rezepta',
        dbName: process.env.MONGODB_DB_NAME || 'rezepta',
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'your-jwt-secret',
        expiresIn: '7d',
    },
    rateLimiting: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    },
    cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    },
    email: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || '587',
        secure: process.env.SMTP_SECURE === 'true' || false,
        user: process.env.SMTP_USER || '',
        password: process.env.SMTP_PASS || '',
    },
    server: {
        port: parseInt(process.env.PORT || '3000'),
        env: process.env.NODE_ENV || 'development',
        fallbackPorts: [3001, 3002, 3003], // Add fallback ports if 3000 is in use
    },
    gcp: {
        projectId: process.env.GCP_PROJECT_ID || 'rezepta',
        keyFilePath: process.env.GCP_KEY_FILE || './gcp-key.json',
        storageBucket: process.env.GCP_STORAGE_BUCKET || 'rezepta-images',
    },
};
export default config;
//# sourceMappingURL=config.js.map