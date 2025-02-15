import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import { connectToDatabase } from '../../db.js';
let mongod;
let mongoClient;
let db;
beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    // Set environment variables for testing
    process.env.MONGODB_URI = uri;
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    // Connect to in-memory database
    mongoClient = await MongoClient.connect(uri);
    db = mongoClient.db('test');
    // Mock the connectToDatabase function to return our test db
    jest.spyOn(require('../../db'), 'connectToDatabase').mockResolvedValue(db);
});
afterAll(async () => {
    // Clean up
    await mongoClient?.close();
    await mongod?.stop();
});
beforeEach(async () => {
    // Clear all collections before each test
    const collections = await db.collections();
    for (const collection of collections) {
        await collection.deleteMany({});
    }
});
// Helper function to create test data
export async function createTestData(collection, data) {
    await db.collection(collection).insertMany(data);
}
// Helper function to get data from collection
export async function getCollectionData(collection) {
    return db.collection(collection).find().toArray();
}
// Helper function to clear collection
export async function clearCollection(collection) {
    await db.collection(collection).deleteMany({});
}
export { db };
//# sourceMappingURL=setup.js.map