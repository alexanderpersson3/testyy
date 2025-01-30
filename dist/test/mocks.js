import { jest } from '@jest/globals';
import { ObjectId } from 'mongodb';
// Create mock collection with proper return types
export const createMockCollection = () => {
    const mockFind = jest.fn();
    mockFind.mockReturnThis();
    const mockFindOne = jest.fn();
    mockFindOne.mockResolvedValue(null);
    const mockInsertOne = jest.fn();
    mockInsertOne.mockResolvedValue({
        acknowledged: true,
        insertedId: new ObjectId('test-id')
    });
    const mockUpdateOne = jest.fn();
    mockUpdateOne.mockResolvedValue({
        acknowledged: true,
        modifiedCount: 1,
        matchedCount: 1,
        upsertedCount: 0
    });
    const mockDeleteOne = jest.fn();
    mockDeleteOne.mockResolvedValue({
        acknowledged: true,
        deletedCount: 1
    });
    const mockAggregate = jest.fn();
    mockAggregate.mockReturnThis();
    const mockToArray = jest.fn();
    mockToArray.mockResolvedValue([]);
    const mockSort = jest.fn();
    mockSort.mockReturnThis();
    const mockLimit = jest.fn();
    mockLimit.mockReturnThis();
    const mockSkip = jest.fn();
    mockSkip.mockReturnThis();
    return {
        find: mockFind,
        findOne: mockFindOne,
        insertOne: mockInsertOne,
        updateOne: mockUpdateOne,
        deleteOne: mockDeleteOne,
        aggregate: mockAggregate,
        toArray: mockToArray,
        sort: mockSort,
        limit: mockLimit,
        skip: mockSkip
    };
};
// Create mock db
export const createMockDb = (mockCollection) => {
    const mockCollectionFn = jest.fn();
    mockCollectionFn.mockReturnValue(mockCollection);
    return { collection: mockCollectionFn };
};
// Mock Redis client
export const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    quit: jest.fn()
};
mockRedisClient.get.mockResolvedValue(null);
mockRedisClient.set.mockResolvedValue('OK');
mockRedisClient.del.mockResolvedValue(1);
mockRedisClient.quit.mockResolvedValue(true);
// Mock WebSocket
export const mockWebSocket = {
    WebSocket: jest.fn(),
    WebSocketServer: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        close: jest.fn()
    }))
};
//# sourceMappingURL=mocks.js.map