/**
 * Application configuration
 */
export interface AppConfig {
  env: 'development' | 'production' | 'test';
  host: string;
  port: number;
  apiPrefix: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
    methods: string[];
  };
  logging: {
    level: string;
    format: string;
    directory: string;
  };
  upload: {
    directory: string;
    maxSize: number;
    allowedTypes: string[];
  };
  pagination: {
    defaultLimit: number;
    maxLimit: number;
  };
  cache: {
    enabled: boolean;
    ttl: number;
    checkPeriod: number;
  };
}

export const appConfig: AppConfig = {
  env: (process.env.NODE_ENV as AppConfig['env']) || 'development',
  host: process.env.HOST || 'localhost',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: '/api/v1',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
    directory: process.env.LOG_DIR || 'logs',
  },
  upload: {
    directory: process.env.UPLOAD_DIR || 'uploads',
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
  },
  pagination: {
    defaultLimit: 10,
    maxLimit: 100,
  },
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    ttl: parseInt(process.env.CACHE_TTL || '3600', 10), // 1 hour
    checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD || '600', 10), // 10 minutes
  },
}; 