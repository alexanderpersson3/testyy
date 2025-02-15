import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, OptionalUnlessRequiredId } from 'mongodb';
import { DatabaseService } from '../db/database.service.js';
import { jest } from '@jest/globals';
import { ObjectId } from 'mongodb';
;
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
    // Create mock database service
    const mockDb = {
        getCollection: jest.fn((name) => db.collection(name)),
        connect: jest.fn(async () => { }),
        disconnect: jest.fn(async () => { }),
        isConnected: jest.fn(async () => true),
    };
    // Mock the DatabaseService.getInstance to return our mock
    jest.spyOn(DatabaseService, 'getInstance').mockReturnValue(mockDb);
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
    const result = await db.collection(collection).find().toArray();
    return result;
}
// Helper function to clear collection
export async function clearCollection(collection) {
    await db.collection(collection).deleteMany({});
}
// Helper function to create a test recipe
export function createTestRecipe(overrides = {}) {
    const baseRecipe = {
        userId: new ObjectId(),
        title: 'Test Recipe',
        name: 'Test Recipe',
        description: 'Test Description',
        ingredients: [],
        instructions: [],
        servings: 4,
        prepTime: 30,
        cookTime: 45,
        totalTime: 75,
        difficulty: 'medium',
        cuisine: 'Test Cuisine',
        nutritionalInfo: {
            calories: 500,
            protein: 20,
            carbohydrates: 60,
            fat: 25,
            fiber: 5,
        },
        tags: ['test'],
        images: [],
        isPrivate: false,
        isPro: false,
        categories: [],
        defaultLanguage: 'en',
        availableLanguages: ['en'],
        author: {
            _id: new ObjectId(),
            name: 'Test Author',
        },
        ratings: {
            average: 0,
            count: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    return { ...baseRecipe, ...overrides };
}
export { db };
//# sourceMappingURL=setup.js.map