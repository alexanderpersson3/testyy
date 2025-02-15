import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export * from './app.config.js';
export * from './auth.config.js';
export * from './database.config.js';

import { AppConfig, appConfig } from './app.config.js';
import { AuthConfig, authConfig } from './auth.config.js';
import { DatabaseConfig, databaseConfig } from './database.config.js';

/**
 * Combined configuration interface
 */
export interface Config {
  app: AppConfig;
  auth: AuthConfig;
  database: DatabaseConfig;
}

/**
 * Combined configuration object
 */
export const config: Config = {
  app: appConfig,
  auth: authConfig,
  database: databaseConfig,
}; 