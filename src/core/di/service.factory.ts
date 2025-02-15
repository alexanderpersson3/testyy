import { Server } from 'http';
import { LoggerService } from '../services/logger.service';
import { WebSocketService } from '../services/websocket.service';
import { DatabaseService } from '../services/database.service';
import { CacheService } from '../services/cache.service';

/**
 * Factory class for managing service instances.
 * Follows the singleton pattern to ensure only one instance of each service exists.
 */
export class ServiceFactory {
  private static loggerService: LoggerService;
  private static webSocketService: WebSocketService;
  private static databaseService: DatabaseService;
  private static cacheService: CacheService;

  /**
   * Initialize core services
   */
  public static initialize(config: {
    server: Server;
    logger: {
      level: string;
      format: string;
      directory: string;
    };
    database: {
      uri: string;
      name: string;
    };
    cache: {
      enabled: boolean;
      ttl: number;
      checkPeriod: number;
    };
  }): void {
    // Initialize logger first as other services depend on it
    this.loggerService = new LoggerService(config.logger);
    
    // Initialize database service
    this.databaseService = DatabaseService.initialize({
      uri: config.database.uri,
      name: config.database.name
    });

    // Initialize cache service
    this.cacheService = new CacheService(config.cache);
    
    // Initialize WebSocket service
    this.webSocketService = WebSocketService.initialize(config.server);
  }

  /**
   * Get the logger service instance
   * Creates a new instance with default config if not initialized
   */
  public static getLogger(): LoggerService {
    if (!this.loggerService) {
      this.loggerService = new LoggerService({
        level: 'info',
        format: 'json',
        directory: 'logs'
      });
    }
    return this.loggerService;
  }

  /**
   * Get the database service instance
   */
  public static getDatabase(): DatabaseService {
    if (!this.databaseService) {
      throw new Error('Database service not initialized. Call initialize first.');
    }
    return this.databaseService;
  }

  /**
   * Get the cache service instance
   */
  public static getCache(): CacheService {
    if (!this.cacheService) {
      this.cacheService = new CacheService({
        enabled: true,
        ttl: 3600,
        checkPeriod: 600
      });
    }
    return this.cacheService;
  }

  /**
   * Get the WebSocket service instance
   */
  public static getWebSocket(): WebSocketService {
    if (!this.webSocketService) {
      throw new Error('WebSocket service not initialized. Call initialize first.');
    }
    return this.webSocketService;
  }
} 