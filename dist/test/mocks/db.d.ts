import { jest } from '@jest/globals';
type MockFn = jest.Mock;
interface MockCollection {
    findOne: MockFn;
    insertOne: MockFn;
    updateOne: MockFn;
    deleteOne: MockFn;
    find: MockFn;
}
interface MockDb {
    collection: MockFn;
}
declare const mockFindOne: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
declare const mockInsertOne: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
declare const mockUpdateOne: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
declare const mockDeleteOne: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
declare const mockFind: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
declare const mockCollection: MockCollection;
declare const mockDb: MockDb;
declare const mockConnectToDatabase: import("jest-mock").Mock<() => Promise<MockDb>>;
export { mockDb, mockCollection, mockConnectToDatabase, mockFindOne, mockInsertOne, mockUpdateOne, mockDeleteOne, mockFind, };
