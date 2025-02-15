import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { jest, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ServiceFactory } from '../core/di/service.factory';
import { createServer } from 'http';

// Import types from Jest
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }

  var createTestToken: (payload: any) => string;
}

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/rezepta-test';

// Configure test timeouts
jest.setTimeout(30000);

// Mock external services
jest.mock('../core/services/websocket.service', () => ({
  WebSocketService: {
    getInstance: jest.fn().mockReturnValue({
      broadcast: jest.fn(),
      send: jest.fn()
    })
  }
}), { virtual: true });

let mongoServer: MongoMemoryServer;
const testServer = createServer();

beforeAll(async () => {
  // Start in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Initialize services with test configuration
  await ServiceFactory.initialize({
    server: testServer,
    logger: {
      level: 'error',
      format: 'json',
      directory: 'logs/test'
    },
    database: {
      uri: mongoUri,
      name: 'test'
    },
    cache: {
      enabled: false,
      ttl: 0,
      checkPeriod: 0
    }
  });
});

afterAll(async () => {
  // Clean up resources
  const db = ServiceFactory.getDatabase();
  await db.disconnect();
  await mongoServer.stop();
  testServer.close();
});

beforeEach(async () => {
  // Clear all collections before each test
  const db = ServiceFactory.getDatabase();
  const collections = await db.getCollections();
  
  for (const collection of collections) {
    await collection.deleteMany({});
  }
});

// Global test utilities
global.createTestToken = (payload: any) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret');
};

// Add custom matchers if needed
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Global test utilities
export const testUtils = {
  createTestUser: async () => {
    // Implementation for creating test users
  },
  
  createTestRecipe: async () => {
    // Implementation for creating test recipes
  },
  
  generateAuthToken: async () => {
    // Implementation for generating test auth tokens
  }
}; 