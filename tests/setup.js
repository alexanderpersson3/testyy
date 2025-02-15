const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

jest.mock('../db', () => {
  const mockMongoose = require('mongoose');
  return {
    connectDB: jest.fn().mockImplementation(async () => {
      await mockMongoose.connect(process.env.MONGO_URI);
      return mockMongoose;
    }),
    disconnectDB: jest.fn().mockImplementation(async () => {
      await mockMongoose.disconnect();
    }),
    getDb: jest.fn().mockImplementation(() => {
      if (!mockMongoose.connection.db) {
        throw new Error('Database not connected');
      }
      return mockMongoose.connection.db;
    }),
  };
});

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Setup configuration', () => {
  test('should have valid test environment', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});
