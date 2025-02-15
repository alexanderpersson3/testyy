import { MongoClient, Db, Collection, MongoClientOptions, IndexDescription, Document } from 'mongodb';
import { config } from '../../config';
import logger from '../utils/logger';

class DatabaseService {
  private static instance: DatabaseService;
  private client: MongoClient | null = null;
  private db: Db | null = null;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async connect(): Promise<void> {
    try {
      this.client = new MongoClient(config.database.URL, {
        maxPoolSize: config.database.MAX_POOL_SIZE,
        minPoolSize: config.database.MIN_POOL_SIZE,
        maxIdleTimeMS: config.database.MAX_IDLE_TIME_MS,
        waitQueueTimeoutMS: config.database.WAIT_QUEUE_TIMEOUT_MS,
      });

      await this.client.connect();
      this.db = this.client.db(config.database.NAME);
      
      logger.info('Successfully connected to MongoDB.');
    } catch (error) {
      logger.error('Error connecting to MongoDB:', error);
      throw error;
    }
  }

  public getDb(): Db {
    if (!this.db) {
      throw new Error('Database not initialized. Call connect first.');
    }
    return this.db;
  }

  public async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      logger.info('Database connection closed.');
    }
  }

  public getCollection<T>(name: string) {
    return this.getDb().collection<T>(name);
  }

  private async ensureIndexes(): Promise<void> {
    const indexes: Record<string, IndexDescription[]> = {
      recipes: [
        { key: { title: 'text', description: 'text', tags: 'text' } },
        { key: { 'author._id': 1, 'ratings.average': -1 } },
        { key: { cuisine: 1, difficulty: 1 } },
        { key: { tags: 1 } },
        { key: { createdAt: -1 } },
        { key: { updatedAt: -1 } }
      ],
      users: [
        { key: { email: 1 }, unique: true },
        { key: { username: 1 }, unique: true },
        { key: { role: 1 } },
        { key: { 'profile.name': 'text', email: 'text' } }
      ],
      collections: [
        { key: { name: 'text', description: 'text', tags: 'text' } },
        { key: { 'owner._id': 1 } },
        { key: { tags: 1, 'stats.recipeCount': -1 } },
        { key: { privacy: 1 } }
      ]
    };

    for (const [collection, collectionIndexes] of Object.entries(indexes)) {
      try {
        const existingIndexes = await this.db!.collection(collection).indexes();
        const existingIndexNames = existingIndexes.map(index => index.name);

        for (const index of collectionIndexes) {
          const indexName = Object.entries(index.key).map(([key, value]) => `${key}_${value}`).join('_');
          if (!existingIndexNames.includes(indexName)) {
            await this.db!.collection(collection).createIndex(index.key, {
              background: true,
              name: indexName,
              ...index
            });
            logger.info(`Created index ${indexName} on ${collection}`);
          }
        }
      } catch (error) {
        logger.error(`Failed to create indexes for ${collection}`, { error });
      }
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client || !this.db) {
        return false;
      }
      await this.db.command({ ping: 1 });
      return true;
    } catch (error) {
      logger.error('Database health check failed', { error });
      return false;
    }
  }

  // Get connection stats
  async getConnectionStats(): Promise<{
    poolSize: number | undefined;
    active: boolean;
    isConnected: boolean;
  }> {
    if (!this.client) {
      return {
        poolSize: undefined,
        active: false,
        isConnected: false
      };
    }
    
    const server = await this.client.db().command({ serverStatus: 1 });
    return {
      poolSize: server.connections?.current,
      active: server.ok === 1,
      isConnected: server.ok === 1
    };
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();

// Export convenience methods for tests
export const connectToDatabase = () => databaseService.connect();
export const closeDatabase = () => databaseService.close();
export const getDb = () => databaseService.getDb();
