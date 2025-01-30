import { jest } from '@jest/globals';
import { Collection, Db } from 'mongodb';

// Define mock types
type MockCollection = {
  find: jest.Mock;
  findOne: jest.Mock;
  insertOne: jest.Mock;
  updateOne: jest.Mock;
  deleteOne: jest.Mock;
  aggregate: jest.Mock;
  toArray: jest.Mock;
  sort: jest.Mock;
  limit: jest.Mock;
  skip: jest.Mock;
};

type MockDb = {
  collection: jest.Mock;
};

// Create mock collection functions
const mockCollection: MockCollection = {
  find: jest.fn().mockReturnThis(),
  findOne: jest.fn(),
  insertOne: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
  aggregate: jest.fn().mockReturnThis(),
  toArray: jest.fn(),
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis()
};

// Create mock db
const mockDb: MockDb = {
  collection: jest.fn().mockReturnValue(mockCollection)
};

// Create mock database functions
const mockConnectToDatabase = jest.fn().mockResolvedValue(mockDb);

// Export mock functions for use in tests
export { mockDb, mockCollection, mockConnectToDatabase }; 
