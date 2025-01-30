import { jest } from '@jest/globals';
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
declare const mockCollection: MockCollection;
declare const mockDb: MockDb;
declare const mockConnectToDatabase: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
export { mockDb, mockCollection, mockConnectToDatabase };
//# sourceMappingURL=db.d.ts.map