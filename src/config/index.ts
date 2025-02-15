import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({
  path: path.resolve(process.cwd(), `.env${process.env.NODE_ENV ? `.${process.env.NODE_ENV}` : ''}`)
});

// Environment configuration
export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || 'localhost',
  API_VERSION: process.env.API_VERSION || 'v1',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
} as const;

// Database configuration
export const db = {
  URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/rezepta',
  NAME: process.env.DB_NAME || 'rezepta',
  OPTIONS: {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
} as const;

// Security configuration
export const security = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100
  }
} as const;

// Cache configuration
export const cache = {
  ENABLED: process.env.CACHE_ENABLED === 'true',
  TTL: parseInt(process.env.CACHE_TTL || '3600', 10), // 1 hour
  CHECK_PERIOD: parseInt(process.env.CACHE_CHECK_PERIOD || '600', 10) // 10 minutes
} as const;

// Feature flags
export const features = {
  ENABLE_SWAGGER: process.env.ENABLE_SWAGGER === 'true',
  ENABLE_RATE_LIMIT: process.env.ENABLE_RATE_LIMIT === 'true',
  ENABLE_COMPRESSION: process.env.ENABLE_COMPRESSION === 'true',
  ENABLE_LOGGING: process.env.ENABLE_LOGGING !== 'false'
} as const;

// Paths configuration
export const paths = {
  ROOT: process.cwd(),
  SRC: path.join(process.cwd(), 'src'),
  DIST: path.join(process.cwd(), 'dist'),
  LOGS: path.join(process.cwd(), 'logs'),
  UPLOADS: path.join(process.cwd(), 'uploads')
} as const;

// Export all configurations
export const config = {
  env,
  db,
  security,
  cache,
  features,
  paths
} as const; 