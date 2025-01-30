import { describe, expect, test, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { ObjectId } from 'mongodb';
import { TestDatabase } from '../helpers/dbHelper';
import storeRouter from '../../routes/stores';
import { generateToken } from '../../utils/auth';

// Define the response type that supertest actually returns
interface TestResponse {
  status: number;
  statusCode: number;
  body: any;
  headers: Record<string, string>;
  type: string;
  text: string;
}

describe('Store API Endpoints', () => {
  let app: express.Application;
  let testUser1: any;
  let testStore: any;
  let testProducts: any[];
  let authToken1: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/stores', storeRouter);

    await TestDatabase.connect();
  });

  beforeEach(async () => {
    await TestDatabase.cleanup();
    
    // Create test user
    testUser1 = await TestDatabase.createTestUser({ email: 'user1@example.com' });
    
    // Create test store
    testStore = await TestDatabase.createTestStore({
      name: 'ICA Maxi',
      location: {
        address: 'Test Street 1',
        city: 'Stockholm',
        coordinates: [18.0686, 59.3293]
      },
      type: 'supermarket'
    });
    
    // Create test products
    testProducts = await Promise.all([
      TestDatabase.createTestProduct({
        name: 'Milk',
        price: 15.90,
        store: testStore._id,
        category: 'dairy'
      }),
      TestDatabase.createTestProduct({
        name: 'Bread',
        price: 25.90,
        store: testStore._id,
        category: 'bakery',
        onSale: true,
        salePrice: 19.90
      })
    ]);
    
    authToken1 = generateToken(testUser1);
  });

  afterAll(async () => {
    await TestDatabase.disconnect();
  });

  describe('Store Listing', () => {
    test('GET / - should list stores with filters', async () => {
      const response = await request(app)
        .get('/api/stores')
        .query({
          type: 'supermarket',
          city: 'Stockholm'
        })
        .expect(200) as unknown as TestResponse;

      expect(response.body.stores).toHaveLength(1);
      expect(response.body.stores[0].name).toBe('ICA Maxi');
    });

    test('GET /nearby - should find stores by location', async () => {
      const response = await request(app)
        .get('/api/stores/nearby')
        .query({
          lat: 59.3293,
          lng: 18.0686,
          radius: 5 // km
        })
        .expect(200) as unknown as TestResponse;

      expect(response.body.stores).toHaveLength(1);
      expect(response.body.stores[0].distance).toBeLessThan(1); // km
    });

    test('GET /fastest - should sort stores by queue time', async () => {
      // Add queue time data
      await TestDatabase.updateStore(testStore._id, { currentQueueTime: 5 }); // minutes
      
      const response = await request(app)
        .get('/api/stores/fastest')
        .expect(200) as unknown as TestResponse;

      expect(response.body.stores[0].currentQueueTime).toBe(5);
    });
  });

  describe('Store Details', () => {
    test('GET /:id - should return store details', async () => {
      const response = await request(app)
        .get(`/api/stores/${testStore._id}`)
        .expect(200) as unknown as TestResponse;

      expect(response.body.store).toMatchObject({
        name: 'ICA Maxi',
        location: {
          city: 'Stockholm'
        }
      });
    });

    test('GET /:id/categories - should list store categories', async () => {
      const response = await request(app)
        .get(`/api/stores/${testStore._id}/categories`)
        .expect(200) as unknown as TestResponse;

      expect(response.body.categories).toEqual(
        expect.arrayContaining(['dairy', 'bakery'])
      );
    });

    test('GET /:id/flyer - should return store flyer', async () => {
      const response = await request(app)
        .get(`/api/stores/${testStore._id}/flyer`)
        .expect(200) as unknown as TestResponse;

      expect(response.body.flyer).toBeDefined();
      expect(response.body.flyer.validFrom).toBeDefined();
      expect(response.body.flyer.validTo).toBeDefined();
      expect(response.body.flyer.deals).toBeDefined();
    });
  });

  describe('Product Information', () => {
    test('GET /:storeId/products - should list store products', async () => {
      const response = await request(app)
        .get(`/api/stores/${testStore._id}/products`)
        .expect(200) as unknown as TestResponse;

      expect(response.body.products).toHaveLength(2);
      expect(response.body.products[0].name).toBe('Milk');
    });

    test('GET /:storeId/products/:id - should return product details', async () => {
      const response = await request(app)
        .get(`/api/stores/${testStore._id}/products/${testProducts[0]._id}`)
        .expect(200) as unknown as TestResponse;

      expect(response.body.product).toMatchObject({
        name: 'Milk',
        price: 15.90
      });
    });

    test('GET /:storeId/products/:id/related - should return related products', async () => {
      const response = await request(app)
        .get(`/api/stores/${testStore._id}/products/${testProducts[0]._id}/related`)
        .expect(200) as unknown as TestResponse;

      expect(response.body.related).toBeDefined();
      expect(response.body.frequentlyBoughtTogether).toBeDefined();
      expect(response.body.alternatives).toBeDefined();
    });
  });

  describe('Deals & Campaigns', () => {
    test('GET /:storeId/deals - should list store deals', async () => {
      const response = await request(app)
        .get(`/api/stores/${testStore._id}/deals`)
        .expect(200) as unknown as TestResponse;

      expect(response.body.deals).toHaveLength(1);
      expect(response.body.deals[0].product.name).toBe('Bread');
      expect(response.body.deals[0].salePrice).toBe(19.90);
    });

    test('GET /deals/nearby - should find deals in nearby stores', async () => {
      const response = await request(app)
        .get('/api/stores/deals/nearby')
        .query({
          lat: 59.3293,
          lng: 18.0686,
          radius: 5
        })
        .expect(200) as unknown as TestResponse;

      expect(response.body.deals).toHaveLength(1);
      expect(response.body.deals[0].store.name).toBe('ICA Maxi');
    });
  });

  describe('Store Types', () => {
    test('GET /types/pharmacy - should list pharmacy stores', async () => {
      // Create a pharmacy store
      await TestDatabase.createTestStore({
        name: 'Apotek Hjärtat',
        type: 'pharmacy',
        location: {
          city: 'Stockholm'
        }
      });

      const response = await request(app)
        .get('/api/stores')
        .query({ type: 'pharmacy' })
        .expect(200) as unknown as TestResponse;

      expect(response.body.stores).toHaveLength(1);
      expect(response.body.stores[0].name).toBe('Apotek Hjärtat');
    });

    test('GET /types/affiliate - should list affiliate stores', async () => {
      // Create an affiliate store
      await TestDatabase.createTestStore({
        name: 'Partner Store',
        type: 'affiliate',
        location: {
          city: 'Stockholm'
        }
      });

      const response = await request(app)
        .get('/api/stores')
        .query({ type: 'affiliate' })
        .expect(200) as unknown as TestResponse;

      expect(response.body.stores).toHaveLength(1);
      expect(response.body.stores[0].name).toBe('Partner Store');
    });
  });
}); 