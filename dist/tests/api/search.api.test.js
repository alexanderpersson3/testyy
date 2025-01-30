import { describe, expect, test, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { TestDatabase } from '../helpers/dbHelper';
import searchRouter from '../../routes/search';
import app from '../../app.js';
describe('Search API Endpoints', () => {
    let testApp;
    let testProducts;
    beforeAll(async () => {
        testApp = express();
        testApp.use(express.json());
        testApp.use('/api/search', searchRouter);
        await TestDatabase.connect();
    });
    beforeEach(async () => {
        await TestDatabase.cleanup();
        // Create test products
        testProducts = await Promise.all([
            TestDatabase.createTestProduct({ name: 'Ägg', price: 29.90, category: 'dairy' }),
            TestDatabase.createTestProduct({ name: 'Äggula (pastöriserad)', price: 39.90, category: 'dairy' }),
            TestDatabase.createTestProduct({ name: 'Äggvita (pastöriserad)', price: 34.90, category: 'dairy' }),
            TestDatabase.createTestProduct({ name: 'Pasta', price: 19.90, category: 'dry_goods' })
        ]);
    });
    afterAll(async () => {
        await TestDatabase.disconnect();
    });
    describe('Auto-complete Search', () => {
        test('GET /suggestions - should return matching product suggestions', async () => {
            const response = await request(app)
                .get('/api/search/suggestions')
                .query({ q: 'ägg' })
                .expect(200);
            const suggestions = response.body.suggestions;
            expect(suggestions).toHaveLength(3);
            expect(suggestions[0].name).toBe('Ägg');
            expect(suggestions).toEqual([
                { name: 'Ägg', category: 'dairy' },
                { name: 'Äggula', category: 'dairy' },
                { name: 'Äggvita', category: 'dairy' }
            ]);
        });
        test('GET /suggestions - should filter suggestions by category', async () => {
            const response = await request(app)
                .get('/api/search/suggestions')
                .query({ q: 'ägg', category: 'dairy' })
                .expect(200);
            const suggestions = response.body.suggestions;
            expect(suggestions).toHaveLength(2);
            expect(suggestions.every(s => s.category === 'dairy')).toBe(true);
        });
        test('GET /suggestions - should return error for short query', async () => {
            const response = await request(app)
                .get('/api/search/suggestions')
                .query({ q: 'a' })
                .expect(400);
            expect(response.body.error).toBe('Query must be at least 2 characters');
        });
    });
    describe('Product Search & Sorting', () => {
        test('GET /products - should sort products by name', async () => {
            const response = await request(app)
                .get('/api/search/products')
                .query({ q: 'mjölk', sort: 'name' })
                .expect(200);
            const products = response.body.products;
            const names = products.map(p => p.name);
            expect(names).toEqual([...names].sort());
        });
        test('GET /products - should sort products by price', async () => {
            const response = await request(app)
                .get('/api/search/products')
                .query({ q: 'mjölk', sort: 'price' })
                .expect(200);
            const products = response.body.products;
            const prices = products.map(p => p.price);
            expect(prices).toEqual([...prices].sort((a, b) => a - b));
        });
        test('GET /products - should filter by category', async () => {
            const response = await request(app)
                .get('/api/search/products')
                .query({ q: 'mjölk', category: 'dairy' })
                .expect(200);
            const products = response.body.products;
            expect(products).toHaveLength(3);
            expect(products.every(p => p.category === 'dairy')).toBe(true);
        });
        test('GET /products - should filter by store', async () => {
            const response = await request(app)
                .get('/api/search/products')
                .query({ q: 'mjölk', store: 'ica,coop' })
                .expect(200);
            const products = response.body.products;
            expect(products).toHaveLength(2);
            expect(products.every(p => ['ica', 'coop'].includes(p.store.toLowerCase()))).toBe(true);
        });
    });
    describe('Search Analytics', () => {
        test('GET /terms - should return popular search terms', async () => {
            const response = await request(app)
                .get('/api/search/terms')
                .expect(200);
            const terms = response.body.terms;
            expect(terms).toEqual([
                { term: 'mjölk', count: 100 },
                { term: 'bröd', count: 80 },
                { term: 'ägg', count: 60 }
            ]);
        });
        test('GET /categories - should return product categories', async () => {
            const response = await request(app)
                .get('/api/search/categories')
                .expect(200);
            const categories = response.body.categories;
            expect(categories).toEqual([
                { id: 'dairy', name: 'Mejeri' },
                { id: 'bread', name: 'Bröd' },
                { id: 'meat', name: 'Kött' }
            ]);
        });
    });
});
//# sourceMappingURL=search.api.test.js.map