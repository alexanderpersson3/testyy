import { MongoClient, Db, MongoClientOptions, Collection, IndexSpecification } from 'mongodb';
import { EventEmitter } from 'events';
import { trackDatabaseOperation } from './utils/performance-logger';
import { createStructuredLog } from './config/cloud';

// Increase event listener limit for connection pool
EventEmitter.defaultMaxListeners = 20;

// Connection configuration interface
interface DatabaseConfig {
  url: string;
  options: MongoClientOptions;
}

// Connection configuration
const config: DatabaseConfig = {
  url: process.env.MONGODB_URI || 'mongodb://localhost:27017/rezepta',
  options: {
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 30000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    waitQueueTimeoutMS: 2000,
    retryWrites: true,
    writeConcern: {
      w: 'majority',
      j: true,
    },
    readPreference: 'primaryPreferred',
    readConcern: { level: 'majority' },
  },
};

export class DatabaseConnection {
  private static instance: DatabaseConnection | null = null;
  private client: MongoClient | null = null;
  private connectionPromise: Promise<MongoClient> | null = null;

  private constructor() {
    if (DatabaseConnection.instance) {
      return DatabaseConnection.instance;
    }
    DatabaseConnection.instance = this;
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async connect(): Promise<MongoClient> {
    if (this.client) {
      return this.client;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    try {
      this.connectionPromise = MongoClient.connect(config.url, config.options);
      this.client = await this.connectionPromise;

      // Handle connection events
      this.client.on('error', this.handleError.bind(this));
      this.client.on('timeout', this.handleTimeout.bind(this));
      this.client.on('close', this.handleClose.bind(this));

      createStructuredLog(
        'info',
        'Database connected successfully',
        { poolSize: config.options.maxPoolSize }
      );

      return this.client;
    } catch (error) {
      createStructuredLog(
        'error',
        'Database connection error',
        { error: (error as Error).message, stack: (error as Error).stack }
      );
      this.connectionPromise = null;
      throw error;
    }
  }

  public async getDb(): Promise<Db> {
    const client = await this.connect();
    return client.db();
  }

  private handleError(error: Error): void {
    createStructuredLog(
      'error',
      'Database error occurred',
      { error: error.message, stack: error.stack }
    );
    this.cleanup();
  }

  private handleTimeout(): void {
    createStructuredLog(
      'warn',
      'Database connection timeout',
      { timestamp: new Date().toISOString() }
    );
    this.cleanup();
  }

  private handleClose(): void {
    createStructuredLog(
      'info',
      'Database connection closed',
      { timestamp: new Date().toISOString() }
    );
    this.cleanup();
  }

  private cleanup(): void {
    this.client = null;
    this.connectionPromise = null;
  }

  public async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.cleanup();
    }
  }
}

// Query helper functions
interface QueryOptions {
  hint?: any;
  explain?: boolean;
  projection?: any;
}

export const createIndex = async (
  collection: string,
  index: IndexSpecification,
  options: any = {}
): Promise<any> => {
  return trackDatabaseOperation(
    'create_index',
    async () => {
      const db = await DatabaseConnection.getInstance().getDb();
      return db.collection(collection).createIndex(index, options);
    },
    { collection, index }
  );
};

export const optimizeQuery = (query: any, options: QueryOptions = {}) => {
  // Add query optimization logic
  const optimizedQuery = { ...query };
  const optimizedOptions: QueryOptions = {
    ...options,
    // Add default optimization options
    hint: undefined, // Let MongoDB choose the best index
    explain: process.env.NODE_ENV === 'development',
    // Add query optimization hints based on common patterns
    ...(query._id && { hint: { _id: 1 } }),
    ...(query.createdAt && { hint: { createdAt: -1 } }),
    // Add projection optimization
    projection: options.projection || null,
  };

  // Log query patterns for analysis
  createStructuredLog(
    'info',
    'Query optimization applied',
    { originalQuery: query, optimizedQuery, options: optimizedOptions }
  );

  return { query: optimizedQuery, options: optimizedOptions };
};

// Enhanced database operations with performance tracking
export const executeQuery = async <T>(
  collection: string,
  operation: (collection: Collection) => Promise<T>,
  operationName: string,
  metadata: Record<string, any> = {}
): Promise<T> => {
  return trackDatabaseOperation(
    operationName,
    async () => {
      const db = await DatabaseConnection.getInstance().getDb();
      return operation(db.collection(collection));
    },
    { collection, ...metadata }
  );
};

// Export singleton instance
export const db = DatabaseConnection.getInstance();
export default db;