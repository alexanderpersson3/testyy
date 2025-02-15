import { MongoClient, Db } from 'mongodb';
import { config } from './config';

let db: Db;
let client: MongoClient;

export const connectToDatabase = async (): Promise<void> => {
  try {
    client = new MongoClient(config.database.URL, {
      maxPoolSize: config.database.MAX_POOL_SIZE,
      minPoolSize: config.database.MIN_POOL_SIZE,
      maxIdleTimeMS: config.database.MAX_IDLE_TIME_MS,
      waitQueueTimeoutMS: config.database.WAIT_QUEUE_TIMEOUT_MS,
    });

    await client.connect();
    db = client.db(config.database.NAME);
    
    console.log('Successfully connected to MongoDB.');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
};

export const getDb = (): Db => {
  if (!db) {
    throw new Error('Database not initialized. Call connectToDatabase first.');
  }
  return db;
};

export const closeDatabase = async (): Promise<void> => {
  if (client) {
    await client.close();
    console.log('Database connection closed.');
  }
}; 