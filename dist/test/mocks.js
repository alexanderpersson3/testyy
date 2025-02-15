import { jest } from '@jest/globals';
import Redis from 'ioredis';
// Create mock collection
const mockCollection = {
    findOne: jest.fn().mockImplementation(() => Promise.resolve({
        _id: new ObjectId('test-id'),
        name: 'Test Document',
    })),
    insertOne: jest.fn().mockImplementation(() => Promise.resolve({
        acknowledged: true,
        insertedId: new ObjectId('test-id'),
    })),
    updateOne: jest.fn().mockImplementation(() => Promise.resolve({
        acknowledged: true,
        modifiedCount: 1,
        matchedCount: 1,
        upsertedCount: 0,
    })),
    deleteOne: jest.fn().mockImplementation(() => Promise.resolve({
        acknowledged: true,
        deletedCount: 1,
    })),
    find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockImplementation(() => Promise.resolve([])),
    }),
    aggregate: jest.fn().mockReturnValue({
        toArray: jest.fn().mockImplementation(() => Promise.resolve([])),
    }),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
};
// Create mock db
const mockDb = {
    collection: jest.fn().mockReturnValue(mockCollection),
};
// Create mock Redis client
const mockRedis = {
    get: jest.fn().mockImplementation(() => Promise.resolve(null)),
    set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
    del: jest.fn().mockImplementation(() => Promise.resolve(1)),
    quit: jest.fn().mockImplementation(() => Promise.resolve(true)),
};
// Mock WebSocket Client
const mockWebSocket = {
    send: jest.fn(),
    close: jest.fn(),
    terminate: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
};
// Export all mocks
export { mockCollection, mockDb, mockRedis, mockWebSocket };
//# sourceMappingURL=mocks.js.map