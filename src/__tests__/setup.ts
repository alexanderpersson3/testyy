import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectToDatabase, closeDatabase } from '../core/database/database.service';
import { elasticClient } from '../services/elastic-client';
import { WebSocketService } from '../core/services/websocket.service';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  // Start in-memory MongoDB instance
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URL = uri;

  // Mock Elasticsearch client
  jest.spyOn(elasticClient, 'ping').mockResolvedValue(true);
  jest.spyOn(elasticClient, 'index').mockResolvedValue({ result: 'created' });
  jest.spyOn(elasticClient, 'update').mockResolvedValue({ result: 'updated' });
  jest.spyOn(elasticClient, 'delete').mockResolvedValue({ result: 'deleted' });
  jest.spyOn(elasticClient, 'search').mockResolvedValue({
    hits: { total: { value: 0 }, hits: [] },
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