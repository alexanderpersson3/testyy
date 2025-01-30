/// <reference types="jest" />
import { jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectToDatabase, closeDatabase } from '../db/db';
import { getDb } from '../db';

// Mock WebSocket service
jest.mock('../services/websocket-service', () => {
  return {
    WebSocketService: jest.fn().mockImplementation(() => ({
      broadcast: jest.fn(),
      close: jest.fn(),
      sendToUser: jest.fn()
    }))
  };
});

let mongod: MongoMemoryServer;

beforeAll(async () => {
  // Start MongoDB Memory Server
  mongod = await MongoMemoryServer.create();
  
  // Set environment variables
  process.env.JWT_SECRET = 'test-secret';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.REDIS_URL = 'redis://localhost:6379';
  
  // Connect to the in-memory database
  await connectToDatabase();
});

afterAll(async () => {
  // Close database connection and stop MongoDB Memory Server
  await closeDatabase();
  await mongod.stop();
});

beforeEach(async () => {
  // Clear all collections before each test
  const db = await getDb();
  const collections = await db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
  // Clear all mocks
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(30000); 