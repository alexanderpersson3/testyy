import { testRequest, generateTestToken, authHeader } from './setup';
import { storeFixtures } from '../fixtures/stores.fixture';
import { storeDealFixtures } from '../fixtures/store-deals.fixture';
import { storeProductFixtures } from '../fixtures/store-products.fixture';
import { databaseService } from '../../core/database/database.service';

describe('Store API', () => {
  const db = databaseService.getDb();
  const storesCollection = db.collection('stores');
  const storeDealsCollection = db.collection('store_deals');
  const storeProductsCollection = db.collection('store_products');

  beforeEach(async () => {
    await storesCollection.deleteMany({});
    await storeDealsCollection.deleteMany({});
    await storeProductsCollection.deleteMany({});
  });

  describe('GET /api/stores', () => {
    beforeEach(async () => {
      await storesCollection.insertOne(storeFixtures.localStore);
      await storesCollection.insertOne(storeFixtures.supermarket);
    });

    it('should return all active stores', async () => {
      const response = await testRequest
        .get('/api/stores');

      expect(response.status).toBe(200);
      expect(response.body.stores).toHaveLength(2);
      expect(response.body.stores[0]).toMatchObject({
        name: storeFixtures.localStore.name,
        location: storeFixtures.localStore.location
      });
    });

    it('should filter stores by city', async () => {
      const response = await testRequest
        .get('/api/stores')
        .query({ city: 'Test City' });

      expect(response.status).toBe(200);
      expect(response.body.stores).toHaveLength(2);
      expect(response.body.stores[0].location.city).toBe('Test City');
    });

    it('should filter stores by features', async () => {
      const response = await testRequest
        .get('/api/stores')
        .query({ features: ['pharmacy'] });

      expect(response.status).toBe(200);
      expect(response.body.stores).toHaveLength(1);
      expect(response.body.stores[0].name).toBe(storeFixtures.supermarket.name);
    });

    it('should search stores by location radius', async () => {
      const response = await testRequest
        .get('/api/stores')
        .query({
          latitude: 40.7128,
          longitude: -74.0060,
          radius: 1 // 1km radius
        });

      expect(response.status).toBe(200);
      expect(response.body.stores).toHaveLength(2);
    });
  });

  describe('GET /api/stores/:storeId', () => {
    beforeEach(async () => {
      await storesCollection.insertOne(storeFixtures.localStore);
    });

    it('should return store details', async () => {
      const response = await testRequest
        .get(`/api/stores/${storeFixtures.localStore._id}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        name: storeFixtures.localStore.name,
        location: storeFixtures.localStore.location,
        operatingHours: storeFixtures.localStore.operatingHours,
        contact: storeFixtures.localStore.contact,
        ratings: storeFixtures.localStore.ratings,
        features: storeFixtures.localStore.features
      });
    });

    it('should return 404 for non-existent store', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await testRequest
        .get(`/api/stores/${nonExistentId}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Store not found');
    });
  });

  describe('GET /api/stores/:storeId/deals', () => {
    beforeEach(async () => {
      await storesCollection.insertOne(storeFixtures.localStore);
      await storeDealsCollection.insertOne(storeDealFixtures.weeklyDeal);
    });

    it('should return store deals', async () => {
      const response = await testRequest
        .get(`/api/stores/${storeFixtures.localStore._id}/deals`);

      expect(response.status).toBe(200);
      expect(response.body.deals).toHaveLength(1);
      expect(response.body.deals[0]).toMatchObject({
        title: storeDealFixtures.weeklyDeal.title,
        description: storeDealFixtures.weeklyDeal.description,
        items: expect.arrayContaining([
          expect.objectContaining({
            name: storeDealFixtures.weeklyDeal.items[0].name,
            discountPercentage: storeDealFixtures.weeklyDeal.items[0].discountPercentage
          })
        ])
      });
    });

    it('should filter deals by active status', async () => {
      const response = await testRequest
        .get(`/api/stores/${storeFixtures.localStore._id}/deals`)
        .query({ active: true });

      expect(response.status).toBe(200);
      expect(response.body.deals).toHaveLength(1);
      expect(response.body.deals[0].isActive).toBe(true);
    });
  });

  describe('GET /api/stores/:storeId/products', () => {
    beforeEach(async () => {
      await storesCollection.insertOne(storeFixtures.localStore);
      await storeProductsCollection.insertOne(storeProductFixtures.freshProduce);
      await storeProductsCollection.insertOne(storeProductFixtures.dairyProduct);
    });

    it('should return store products', async () => {
      const response = await testRequest
        .get(`/api/stores/${storeFixtures.localStore._id}/products`);

      expect(response.status).toBe(200);
      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0]).toMatchObject({
        name: storeProductFixtures.freshProduce.name,
        category: storeProductFixtures.freshProduce.category,
        price: storeProductFixtures.freshProduce.price
      });
    });

    it('should filter products by category', async () => {
      const response = await testRequest
        .get(`/api/stores/${storeFixtures.localStore._id}/products`)
        .query({ category: 'Produce' });

      expect(response.status).toBe(200);
      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0].category).toBe('Produce');
    });

    it('should filter products by in-stock status', async () => {
      const response = await testRequest
        .get(`/api/stores/${storeFixtures.localStore._id}/products`)
        .query({ inStock: true });

      expect(response.status).toBe(200);
      expect(response.body.products.every(p => p.inStock)).toBe(true);
    });
  });
}); 