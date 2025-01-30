import { jest } from '@jest/globals';
// Create mock collection functions
const mockCollection = {
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
const mockDb = {
    collection: jest.fn().mockReturnValue(mockCollection)
};
// Create mock database functions
const mockConnectToDatabase = jest.fn().mockResolvedValue(mockDb);
// Export mock functions for use in tests
export { mockDb, mockCollection, mockConnectToDatabase };
//# sourceMappingURL=db.js.map