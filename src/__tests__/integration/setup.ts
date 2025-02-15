import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectToDatabase, closeDatabase } from '../../core/database/database.service';
import { elasticClient } from '../../services/elastic-client';
import { WebSocketService } from '../../core/services/websocket.service';
import { app } from '../../app';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import { userFixtures } from '../fixtures/users.fixture';

export const testRequest = supertest(app);

let mongod: MongoMemoryServer;

beforeAll(async () => {
  // Start in-memory MongoDB instance
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URL = uri;
  process.env.JWT_SECRET = 'test-secret';

  // Mock Elasticsearch client
  jest.spyOn(elasticClient, 'ping').mockResolvedValue(true);
  jest.spyOn(elasticClient, 'index').mockResolvedValue({
    _id: '1',
    _index: 'test',
    _version: 1,
    result: 'created',
    _shards: { total: 1, successful: 1, failed: 0 }
  });
  jest.spyOn(elasticClient, 'update').mockResolvedValue({
    _id: '1',
    _index: 'test',
    _version: 2,
    result: 'updated',
    _shards: { total: 1, successful: 1, failed: 0 }
  });
  jest.spyOn(elasticClient, 'delete').mockResolvedValue({
    _id: '1',
    _index: 'test',
    _version: 1,
    result: 'deleted',
    _shards: { total: 1, successful: 1, failed: 0 }
  });
  jest.spyOn(elasticClient, 'search').mockResolvedValue({
    hits: {
      total: { value: 0, relation: 'eq' },
      hits: []
    }
  });

  // Mock WebSocket service
  const wsService = WebSocketService.getInstance();
  jest.spyOn(wsService, 'notifyUsers').mockImplementation(() => {});
  jest.spyOn(wsService, 'notifyAll').mockImplementation(() => {});

  // Connect to in-memory database
  await connectToDatabase();
});

afterAll(async () => {
  // Close database connection
  await closeDatabase();
  
  // Stop in-memory MongoDB instance
  await mongod.stop();
});

beforeEach(() => {
  jest.clearAllMocks();
});

export const generateTestToken = (userId: string = userFixtures.regularUser._id.toString()) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '1h' });
};

export const authHeader = (token: string) => ({
  Authorization: `Bearer ${token}`
}); 