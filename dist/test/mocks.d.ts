import Redis from 'ioredis';
declare const mockCollection: {
    findOne: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
    insertOne: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
    updateOne: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
    deleteOne: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
    find: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
    aggregate: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
    sort: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
    limit: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
    skip: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
};
declare const mockDb: {
    collection: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
};
declare const mockRedis: Redis;
declare const mockWebSocket: {
    send: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
    close: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
    terminate: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
    on: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
    removeListener: import("jest-mock").Mock<import("jest-mock").UnknownFunction>;
};
export { mockCollection, mockDb, mockRedis, mockWebSocket };
