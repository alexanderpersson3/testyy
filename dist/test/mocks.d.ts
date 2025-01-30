import { jest } from '@jest/globals';
export type MockCollection = {
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
export type MockDb = {
    collection: jest.Mock;
};
export declare const createMockCollection: () => MockCollection;
export declare const createMockDb: (mockCollection: MockCollection) => MockDb;
export declare const mockRedisClient: {
    get: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
    set: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
    del: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
    quit: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
};
export declare const mockWebSocket: {
    WebSocket: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
    WebSocketServer: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
};
//# sourceMappingURL=mocks.d.ts.map