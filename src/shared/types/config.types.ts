export interface AppConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  host: string;
  apiPrefix: string;
}

export interface DatabaseConfig {
  uri: string;
  name: string;
  options: {
    useNewUrlParser: boolean;
    useUnifiedTopology: boolean;
    maxPoolSize: number;
    serverSelectionTimeoutMS: number;
  };
}

export interface SecurityConfig {
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

export interface LoggerConfig {
  level: string;
  format: string;
  directory: string;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  checkPeriod: number;
}

export interface Config {
  app: AppConfig;
  database: DatabaseConfig;
  security: SecurityConfig;
  logger: LoggerConfig;
  cache: CacheConfig;
} 