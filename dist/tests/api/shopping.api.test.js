import { describe, expect, test, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { TestDatabase } from '../helpers/dbHelper';
import shoppingListRouter from '../../routes/shopping-list';
import { generateToken } from '../../utils/auth';
describe('Shopping API Endpoints', () => {
    let app;
    let testUser1;
    let testUser2;
    let testProducts;
    let authToken1;
    let authToken2;
    beforeAll(async () => {
        app = express();
        app.use(express.json());
        app.use('/api/shopping', shoppingListRouter);
        await TestDatabase.connect();
    });
    beforeEach(async () => {
        await TestDatabase.cleanup();
        // Create test users and products
        testUser1 = await TestDatabase.createTestUser({ email: 'user1@example.com' });
        testUser2 = await TestDatabase.createTestUser({ email: 'user2@example.com' });
        testProducts = await Promise.all([
            TestDatabase.createTestProduct({ name: 'Milk', price: 15.90 }),
            TestDatabase.createTestProduct({ name: 'Bread', price: 25.90 })
        ]);
        authToken1 = generateToken(testUser1);
        authToken2 = generateToken(testUser2);
    });
    afterAll(async () => {
        await TestDatabase.disconnect();
    });
    describe('Shopping List Management', () => {
        it('should create a new shopping list', async () => {
            const response = await request(app)
                .post('/api/shopping/lists')
                .set('Authorization', `Bearer ${authToken1}`)
                .send({
                name: 'Weekly Groceries',
                store: 'ICA'
            });
            expect(response.statusCode).toBe(200);
            expect(response.body.listId).toBeDefined();
            expect(response.body.name).toBe('Weekly Groceries');
        });
        test('PATCH /lists/:id/items - should add item with quantity and unit', async () => {
            // First create a list
            const listResponse = await request(app)
                .post('/api/shopping/lists')
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ name: 'Test List' });
            const response = await request(app)
                .patch(`/api/shopping/lists/${listResponse.body.listId}/items`)
                .set('Authorization', `Bearer ${authToken1}`)
                .send({
                productId: testProducts[0]._id,
                quantity: 2,
                unit: 'l',
                customName: 'Organic Milk'
            })
                .expect(200);
            expect(response.body.items).toHaveLength(1);
            expect(response.body.items[0]).toMatchObject({
                quantity: 2,
                unit: 'l',
                customName: 'Organic Milk'
            });
        });
        test('GET /lists - should sort lists by store', async () => {
            // Create multiple lists
            await request(app)
                .post('/api/shopping/lists')
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ name: 'List 1', store: 'Willys' });
            await request(app)
                .post('/api/shopping/lists')
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ name: 'List 2', store: 'ICA' });
            const response = await request(app)
                .get('/api/shopping/lists?sortBy=store&order=asc')
                .set('Authorization', `Bearer ${authToken1}`)
                .expect(200);
            const stores = response.body.lists.map((l) => l.store);
            expect(stores).toEqual(['ICA', 'Willys']);
        });
    });
    describe('Shared Lists', () => {
        test('POST /lists/:id/share - should share list with another user', async () => {
            // Create a list
            const listResponse = await request(app)
                .post('/api/shopping/lists')
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ name: 'Shared List' });
            const response = await request(app)
                .post(`/api/shopping/lists/${listResponse.body.listId}/share`)
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ userId: testUser2._id })
                .expect(200);
            expect(response.body.success).toBe(true);
            // Check that user2 can access the list
            const user2Response = await request(app)
                .get(`/api/shopping/lists/${listResponse.body.listId}`)
                .set('Authorization', `Bearer ${authToken2}`)
                .expect(200);
            expect(user2Response.body.name).toBe('Shared List');
        });
        test('GET /lists/shared - should list shared shopping lists', async () => {
            // Create and share a list
            const listResponse = await request(app)
                .post('/api/shopping/lists')
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ name: 'Shared List' });
            await request(app)
                .post(`/api/shopping/lists/${listResponse.body.listId}/share`)
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ userId: testUser2._id });
            const response = await request(app)
                .get('/api/shopping/lists/shared')
                .set('Authorization', `Bearer ${authToken2}`)
                .expect(200);
            expect(response.body.lists).toHaveLength(1);
            expect(response.body.lists[0].name).toBe('Shared List');
        });
    });
    describe('Favorite Items', () => {
        test('POST /favorites - should add item to favorites', async () => {
            const response = await request(app)
                .post('/api/shopping/favorites')
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ productId: testProducts[0]._id })
                .expect(201);
            expect(response.body.success).toBe(true);
        });
        test('GET /favorites - should list favorite items', async () => {
            // Add some favorites
            await request(app)
                .post('/api/shopping/favorites')
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ productId: testProducts[0]._id });
            await request(app)
                .post('/api/shopping/favorites')
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ productId: testProducts[1]._id });
            const response = await request(app)
                .get('/api/shopping/favorites')
                .set('Authorization', `Bearer ${authToken1}`)
                .expect(200);
            expect(response.body.favorites).toHaveLength(2);
            expect(response.body.favorites.map((f) => f.name)).toEqual(['Milk', 'Bread']);
        });
        test('DELETE /favorites/:id - should remove item from favorites', async () => {
            // First add to favorites
            await request(app)
                .post('/api/shopping/favorites')
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ productId: testProducts[0]._id });
            const response = await request(app)
                .delete(`/api/shopping/favorites/${testProducts[0]._id}`)
                .set('Authorization', `Bearer ${authToken1}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            // Verify it's removed
            const listResponse = await request(app)
                .get('/api/shopping/favorites')
                .set('Authorization', `Bearer ${authToken1}`)
                .expect(200);
            expect(listResponse.body.favorites).toHaveLength(0);
        });
    });
    describe('Shopping List Settings', () => {
        test('PATCH /settings - should update shopping list settings', async () => {
            const settings = {
                sortCompletedItems: true,
                sortByAlphabet: true,
                enableReminders: true,
                sortFavorites: true,
                enableSharedLists: true
            };
            const response = await request(app)
                .patch('/api/shopping/settings')
                .set('Authorization', `Bearer ${authToken1}`)
                .send(settings)
                .expect(200);
            expect(response.body.settings).toMatchObject(settings);
        });
        test('GET /settings - should return user shopping settings', async () => {
            // First update settings
            const settings = {
                sortCompletedItems: true,
                sortByAlphabet: false,
                enableReminders: true,
                sortFavorites: false,
                enableSharedLists: true
            };
            await request(app)
                .patch('/api/shopping/settings')
                .set('Authorization', `Bearer ${authToken1}`)
                .send(settings);
            const response = await request(app)
                .get('/api/shopping/settings')
                .set('Authorization', `Bearer ${authToken1}`)
                .expect(200);
            expect(response.body.settings).toMatchObject(settings);
        });
    });
});
//# sourceMappingURL=shopping.api.test.js.map