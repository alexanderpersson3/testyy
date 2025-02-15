import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import type { OptionalUnlessRequiredId } from 'mongodb';
import type { MongoDocument } from '../../types/mongodb.types.js';
import { DatabaseService } from '../../db/database.service.js';
import logger from '../logger.js';

/**
 * Test utilities for MongoDB testing
 */
export class MongoTestUtils {
  private static mongoServer: MongoMemoryServer;
  private static client: MongoClient;
  private static db: Db;

  /**
   * Start MongoDB memory server and initialize connection
   */
  static async initializeTestDatabase(): Promise<void> {
    try {
      this.mongoServer = await MongoMemoryServer.create();
      const mongoUri = this.mongoServer.getUri();

      // Connect to in-memory database
      this.client = await MongoClient.connect(mongoUri);
      this.db = this.client.db('test');

      // Initialize database service with test database
      await DatabaseService.initialize({
        uri: mongoUri,
        dbName: 'test'
      });

      logger.info('Test database initialized');
    } catch (error) {
      logger.error('Failed to initialize test database:', error);
      throw error;
    }
  }

  /**
   * Clean up test database and close connections
   */
  static async cleanupTestDatabase(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
      }
      if (this.mongoServer) {
        await this.mongoServer.stop();
      }
      logger.info('Test database cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup test database:', error);
      throw error;
    }
  }

  /**
   * Clear all collections in the test database
   */
  static async clearCollections(): Promise<void> {
    try {
      const collections = await this.db.collections();
      await Promise.all(collections.map(collection => collection.deleteMany({})));
      logger.info('Collections cleared');
    } catch (error) {
      logger.error('Failed to clear collections:', error);
      throw error;
    }
  }

  /**
   * Create test documents in a collection
   */
  static async createTestDocuments<T extends MongoDocument>(
    collectionName: string,
    documents: Array<Omit<T, '_id' | 'createdAt' | 'updatedAt'>>
  ): Promise<T[]> {
    const collection = this.db.collection<T>(collectionName);
    const now = new Date();

    const docsToInsert = documents.map(doc => ({
      ...doc,
      createdAt: now,
      updatedAt: now
    })) as OptionalUnlessRequiredId<T>[];

    const result = await collection.insertMany(docsToInsert);
    return Object.values(result.insertedIds).map((id, index) => ({
      ...docsToInsert[index],
      _id: id
    })) as T[];
  }

  /**
   * Get a typed collection instance
   */
  static getCollection<T extends MongoDocument>(collectionName: string): Collection<T> {
    return this.db.collection<T>(collectionName);
  }

  /**
   * Create a test document with default timestamps
   */
  static createTestDocument<T extends MongoDocument>(
    data: Omit<T, '_id' | 'createdAt' | 'updatedAt'>
  ): T {
    return {
      ...data,
      _id: new ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date()
    } as T;
  }

  /**
   * Compare MongoDB documents ignoring timestamps
   */
  static compareDocuments<T extends MongoDocument>(
    actual: T,
    expected: Partial<T>,
    ignoreFields: Array<keyof T> = []
  ): boolean {
    const fieldsToIgnore = [
      '_id',
      'createdAt',
      'updatedAt',
      ...ignoreFields
    ] as Array<keyof T>;

    const filteredActual = Object.entries(actual).reduce((acc, [key, value]) => {
      if (!fieldsToIgnore.includes(key as keyof T)) {
        acc[key as keyof T] = value;
      }
      return acc;
    }, {} as Partial<T>);

    const filteredExpected = Object.entries(expected).reduce((acc, [key, value]) => {
      if (!fieldsToIgnore.includes(key as keyof T)) {
        acc[key as keyof T] = value;
      }
      return acc;
    }, {} as Partial<T>);

    return JSON.stringify(filteredActual) === JSON.stringify(filteredExpected);
  }

  /**
   * Create a mock ObjectId for testing
   */
  static createMockId(): ObjectId {
    return new ObjectId();
  }

  /**
   * Convert string IDs to ObjectIds
   */
  static toObjectId(id: string | ObjectId): ObjectId {
    return typeof id === 'string' ? new ObjectId(id) : id;
  }

  /**
   * Create test data factory
   */
  static createTestDataFactory<T extends MongoDocument>() {
    return {
      /**
       * Create a single test document
       */
      createOne: (data: Partial<Omit<T, '_id' | 'createdAt' | 'updatedAt'>>) =>
        this.createTestDocument<T>(data as Omit<T, '_id' | 'createdAt' | 'updatedAt'>),

      /**
       * Create multiple test documents
       */
      createMany: (count: number, baseData: Partial<Omit<T, '_id' | 'createdAt' | 'updatedAt'>>) =>
        Array.from({ length: count }, () =>
          this.createTestDocument<T>({
            ...baseData
          } as Omit<T, '_id' | 'createdAt' | 'updatedAt'>)
        ),

      /**
       * Save test documents to database
       */
      saveToDatabase: async (
        collectionName: string,
        documents: Array<Omit<T, '_id' | 'createdAt' | 'updatedAt'>>
      ) => this.createTestDocuments<T>(collectionName, documents)
    };
  }
} 