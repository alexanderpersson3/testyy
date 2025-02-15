import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { jest, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

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

// Global test setup
beforeAll(async () => {
  // Any global setup needed before running tests
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  // Clean up after all tests
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