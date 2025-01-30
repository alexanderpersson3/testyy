import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { config } from '../../config';
export class TestDatabase {
    static async connect() {
        this.mongod = await MongoMemoryServer.create();
        const uri = this.mongod.getUri();
        this.client = await MongoClient.connect(uri);
        this.db = this.client.db(config.mongodb.dbName);
    }
    static async disconnect() {
        if (this.client) {
            await this.client.close();
        }
        if (this.mongod) {
            await this.mongod.stop();
        }
    }
    static async cleanup() {
        if (this.db) {
            const collections = await this.db.collections();
            for (const collection of collections) {
                await collection.deleteMany({});
            }
        }
    }
    // User helpers
    static async createTestUser(data = {}) {
        const user = {
            email: data.email || 'test@example.com',
            name: data.name || 'Test User',
            isPremium: data.isPremium || false,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await this.db.collection('users').insertOne(user);
        return { ...user, _id: result.insertedId };
    }
    static async updateUser(userId, data) {
        await this.db.collection('users').updateOne({ _id: userId }, { $set: { ...data, updatedAt: new Date() } });
    }
    // Profile helpers
    static async createTestProfile(userId) {
        const profile = {
            userId,
            displayName: 'Test User',
            bio: 'Test bio',
            stats: {
                followers: 0,
                following: 0,
                recipes: 0
            },
            createdAt: new Date()
        };
        const result = await this.db.collection('user_profiles').insertOne(profile);
        return { ...profile, _id: result.insertedId };
    }
    // Recipe helpers
    static async createTestRecipe(data) {
        const recipe = {
            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await this.db.collection('recipes').insertOne(recipe);
        return { ...recipe, _id: result.insertedId };
    }
    // Story helpers
    static async createTestStory(userId, data = {}) {
        const story = {
            userId,
            type: 'image',
            content: 'Test story',
            mediaUrl: 'https://example.com/image.jpg',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            ...data
        };
        const result = await this.db.collection('stories').insertOne(story);
        return { ...story, _id: result.insertedId };
    }
    // Store helpers
    static async createTestStore(data = {}) {
        const store = {
            name: 'Test Store',
            type: 'supermarket',
            location: {
                address: 'Test Address',
                city: 'Test City',
                coordinates: [0, 0]
            },
            createdAt: new Date(),
            ...data
        };
        const result = await this.db.collection('stores').insertOne(store);
        return { ...store, _id: result.insertedId };
    }
    static async updateStore(storeId, updates) {
        await this.db.collection('stores').updateOne({ _id: storeId }, { $set: updates });
    }
    // Product helpers
    static async createTestProduct(data = {}) {
        const product = {
            name: 'Test Product',
            price: 9.99,
            category: 'test',
            createdAt: new Date(),
            ...data
        };
        const result = await this.db.collection('products').insertOne(product);
        return { ...product, _id: result.insertedId };
    }
}
//# sourceMappingURL=dbHelper.js.map