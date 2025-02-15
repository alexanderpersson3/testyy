import dotenv from 'dotenv';

dotenv.config();

export const config = {
  database: {
    URL: process.env.MONGODB_URL || 'mongodb://localhost:27017',
    NAME: process.env.DB_NAME || 'rezepta',
    MAX_POOL_SIZE: parseInt(process.env.DB_MAX_POOL_SIZE || '10'),
    MIN_POOL_SIZE: parseInt(process.env.DB_MIN_POOL_SIZE || '5'),
    MAX_IDLE_TIME_MS: parseInt(process.env.DB_MAX_IDLE_TIME_MS || '60000'),
    WAIT_QUEUE_TIMEOUT_MS: parseInt(process.env.DB_WAIT_QUEUE_TIMEOUT_MS || '10000'),
  },
  security: {
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
    JWT_EXPIRATION: process.env.JWT_EXPIRATION || '24h',
    RATE_LIMIT: {
      WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    },
    BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '10'),
  },
  elasticsearch: {
    NODE: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    USERNAME: process.env.ELASTICSEARCH_USERNAME,
    PASSWORD: process.env.ELASTICSEARCH_PASSWORD,
    INDEX_PREFIX: process.env.ELASTICSEARCH_INDEX_PREFIX || 'rezepta',
  },
  logging: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    FILE_MAX_SIZE: 5242880, // 5MB
    FILE_MAX_FILES: 5,
  },
  cors: {
    ORIGIN: process.env.CORS_ORIGIN || '*',
    METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  },
} as const; 