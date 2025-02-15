import { jest } from '@jest/globals';
// Create mock functions
const mockFindOne = jest.fn();
const mockInsertOne = jest.fn();
const mockUpdateOne = jest.fn();
const mockDeleteOne = jest.fn();
const mockFind = jest.fn();
// Set default responses
mockFindOne.mockImplementation(() => Promise.resolve(null));
mockInsertOne.mockImplementation(() => Promise.resolve({
    acknowledged: true,
    insertedId: new ObjectId(),
}));
mockUpdateOne.mockImplementation(() => Promise.resolve({
    acknowledged: true,
    modifiedCount: 1,
    matchedCount: 1,
    upsertedCount: 0,
}));
mockDeleteOne.mockImplementation(() => Promise.resolve({
    acknowledged: true,
    deletedCount: 1,
}));
mockFind.mockImplementation(function () {
    return this;
});
// Create mock collection
const mockCollection = {
    findOne: mockFindOne,
    insertOne: mockInsertOne,
    updateOne: mockUpdateOne,
    deleteOne: mockDeleteOne,
    find: mockFind,
};
// Create mock db
const mockDb = {
    collection: jest.fn(() => mockCollection),
};
// Create mock database connection
const mockConnectToDatabase = jest.fn(() => Promise.resolve(mockDb));
export { mockDb, mockCollection, mockConnectToDatabase, mockFindOne, mockInsertOne, mockUpdateOne, mockDeleteOne, mockFind, };
//# sourceMappingURL=db.js.map