/// <reference types="jest" />
import { jest } from '@jest/globals';
import { MongoClient, Db, FindOptions, InsertOneResult, DeleteResult, UpdateResult, } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { db } from '../db/database.service.js';
import { UserRole } from '../types/auth.js';
import { DatabaseService } from '../db/database.service.js';
import { ObjectId } from 'mongodb';
;
import { LanguageCode } from '../types/language.js';
import { connectToDatabase } from '../db.js';
import { Challenge, ChallengeSubmission } from '../types/challenge.js';
import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';
let mongod;
let mongoClient;
let testDb;
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
    testDb = mongoClient.db('test');
    // Mock DatabaseService
    const mockDb = {
        connect: jest.fn(),
        getCollection: jest.fn().mockReturnValue(testDb.collection('test')),
        isConnected: jest.fn().mockReturnValue(true),
    };
    jest.spyOn(DatabaseService, 'getInstance').mockReturnValue(mockDb);
});
afterAll(async () => {
    await mongoClient?.close();
    await mongod?.stop();
});
beforeEach(async () => {
    const collections = await testDb.collections();
    for (const collection of collections) {
        await collection.deleteMany({});
    }
});
// Helper to create mock collection methods
function createMockCollectionMethods() {
    const toArrayMock = jest.fn().mockImplementation(() => Promise.resolve([]));
    const limitMock = jest.fn().mockReturnValue({ toArray: toArrayMock });
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });
    const findMock = jest.fn().mockImplementation(() => ({
        sort: sortMock,
        toArray: toArrayMock,
    }));
    const findOneMock = jest.fn().mockImplementation(async () => null);
    const insertOneMock = jest.fn().mockImplementation(async () => ({
        acknowledged: true,
        insertedId: new ObjectId(),
    }));
    const updateOneMock = jest.fn().mockImplementation(async () => ({
        acknowledged: true,
        modifiedCount: 1,
        upsertedId: null,
        upsertedCount: 0,
        matchedCount: 1,
    }));
    const deleteOneMock = jest.fn().mockImplementation(async () => ({
        acknowledged: true,
        deletedCount: 1,
    }));
    const aggregateMock = jest.fn().mockImplementation(() => ({
        toArray: jest.fn().mockImplementation(() => Promise.resolve([])),
    }));
    const countDocumentsMock = jest.fn().mockImplementation(async () => 0);
    const distinctMock = jest.fn().mockImplementation(async () => []);
    return {
        findOne: findOneMock,
        find: findMock,
        insertOne: insertOneMock,
        updateOne: updateOneMock,
        deleteOne: deleteOneMock,
        aggregate: aggregateMock,
        countDocuments: countDocumentsMock,
        distinct: distinctMock,
    };
}
// Initialize mock collections
export const mockCollections = {
    users: {
        ...createMockCollectionMethods(),
    },
    recipes: {
        ...createMockCollectionMethods(),
    },
    challenges: {
        ...createMockCollectionMethods(),
    },
    submissions: {
        ...createMockCollectionMethods(),
    },
    timers: {},
    timerGroups: {},
};
// Helper function to setup mock data
export const setupMockData = {
    user: (data = {}) => {
        const defaultUser = {
            _id: new ObjectId(),
            id: new ObjectId().toString(),
            email: 'test@example.com',
            password: 'hashedPassword',
            role: UserRole.USER,
            name: 'Test User',
            preferences: {
                theme: 'light',
                notifications: true,
                language: 'en',
                emailNotifications: false,
                pushNotifications: false,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        // Create a new object with the default values and merge with provided data
        const mergedUser = {
            ...defaultUser,
            ...data,
            // If preferences are provided, merge them with defaults
            preferences: data.preferences
                ? { ...defaultUser.preferences, ...data.preferences }
                : defaultUser.preferences,
        };
        mockCollections.users.findOne.mockResolvedValueOnce(mergedUser);
        return mergedUser;
    },
    recipe: (data = {}) => {
        const defaultRecipe = {
            _id: new ObjectId(),
            title: 'Test Recipe',
            description: 'Test Description',
            ingredients: [],
            instructions: [],
            servings: 4,
            prepTime: 30,
            cookTime: 45,
            totalTime: 75,
            difficulty: 'medium',
            cuisine: 'Test',
            tags: [],
            images: [],
            author: {
                _id: new ObjectId(),
                name: 'Test Author',
            },
            ratings: {
                average: 0,
                count: 0,
            },
            language: 'en',
            availableLanguages: ['en'],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        // Create a new object with the default values
        const mergedRecipe = { ...defaultRecipe };
        // Merge the data
        Object.assign(mergedRecipe, data);
        mockCollections.recipes.findOne.mockResolvedValueOnce(mergedRecipe);
        return mergedRecipe;
    },
};
// Helper to clear mock data
export const clearMockData = () => {
    Object.values(mockCollections).forEach(collection => {
        Object.keys(collection).forEach(key => {
            const method = collection[key];
            if (jest.isMockFunction(method)) {
                method.mockClear();
            }
        });
    });
};
// Global test timeout
jest.setTimeout(30000);
// Helper function to create test data with proper typing
export async function createTestData(collection, data) {
    await testDb.collection(collection).insertMany(data);
}
// Helper function to get data from collection with proper typing
export async function getCollectionData(collection, filter = {}, options = {}) {
    return testDb.collection(collection).find(filter, options).toArray();
}
// Helper function to clear collection
export async function clearCollection(collection) {
    await testDb.collection(collection).deleteMany({});
}
// Helper function to create test user with proper typing
export async function createTestUser(overrides = {}) {
    const db = await connectToDatabase();
    const defaultUser = {
        id: new ObjectId().toString(),
        email: 'test@example.com',
        password: 'hashedPassword',
        name: 'Test User',
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    const userData = { ...defaultUser, ...overrides };
    const result = await db.collection('users').insertOne(userData);
    return {
        ...userData,
        _id: result.insertedId,
    };
}
export { testDb as db };
// Extend Vitest's expect method with methods from react-testing-library
expect.extend(matchers);
// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
    cleanup();
});
//# sourceMappingURL=setup.js.map