import request from 'supertest';
import { app } from '../app.js';
import { getDb } from '../config/db.js';
import { createStructuredLog } from '../config/cloud.js';
import { taskManager } from '../config/tasks.js';

describe('Scraper & Price Integration Tests', () => {
  let db;
  let testStore;
  let testProduct;
  let scraperToken;

  beforeAll(async () => {
    db = await getDb();
    
    // Create test store
    testStore = await db.collection('stores').insertOne({
      name: 'Test Store',
      chain: 'TestChain',
      location: {
        address: '123 Test St',
        coordinates: [0, 0]
      }
    });

    // Create test product
    testProduct = await db.collection('products').insertOne({
      name: 'Test Product',
      store: testStore.insertedId,
      category: 'Test Category',
      currentPrice: 9.99,
      priceHistory: []
    });

    // Create scraper auth token
    scraperToken = jwt.sign(
      { role: 'scraper' },
      process.env.SCRAPER_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await db.collection('stores').deleteOne({ _id: testStore.insertedId });
    await db.collection('products').deleteOne({ _id: testProduct.insertedId });
  });

  describe('Price Updates', () => {
    it('should handle batch price updates', async () => {
      const res = await request(app)
        .post('/api/scraper/prices/batch')
        .set('Authorization', `Bearer ${scraperToken}`)
        .send({
          storeId: testStore.insertedId.toString(),
          prices: [
            {
              productId: testProduct.insertedId.toString(),
              price: 8.99,
              timestamp: new Date(),
              source: 'web_scraper'
            }
          ]
        });

      expect(res.status).toBe(200);
      
      const updatedProduct = await db.collection('products').findOne({
        _id: testProduct.insertedId
      });
      expect(updatedProduct.currentPrice).toBe(8.99);
      expect(updatedProduct.priceHistory.length).toBe(1);
    });

    it('should prevent duplicate price updates', async () => {
      const timestamp = new Date();
      
      // First update
      await request(app)
        .post('/api/scraper/prices/batch')
        .set('Authorization', `Bearer ${scraperToken}`)
        .send({
          storeId: testStore.insertedId.toString(),
          prices: [
            {
              productId: testProduct.insertedId.toString(),
              price: 7.99,
              timestamp,
              source: 'web_scraper'
            }
          ]
        });

      // Duplicate update
      const res = await request(app)
        .post('/api/scraper/prices/batch')
        .set('Authorization', `Bearer ${scraperToken}`)
        .send({
          storeId: testStore.insertedId.toString(),
          prices: [
            {
              productId: testProduct.insertedId.toString(),
              price: 7.99,
              timestamp,
              source: 'web_scraper'
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('duplicate');
    });

    it('should trigger price alerts', async () => {
      // Create price alert
      await db.collection('price_alerts').insertOne({
        userId: new ObjectId(),
        productId: testProduct.insertedId,
        targetPrice: 6.99,
        status: 'active'
      });

      const res = await request(app)
        .post('/api/scraper/prices/batch')
        .set('Authorization', `Bearer ${scraperToken}`)
        .send({
          storeId: testStore.insertedId.toString(),
          prices: [
            {
              productId: testProduct.insertedId.toString(),
              price: 5.99,
              timestamp: new Date(),
              source: 'web_scraper'
            }
          ]
        });

      expect(res.status).toBe(200);
      
      // Verify notification was created
      const notification = await db.collection('notifications').findOne({
        type: 'PRICE_ALERT',
        'metadata.productId': testProduct.insertedId
      });
      expect(notification).toBeDefined();
    });
  });

  describe('Deal Management', () => {
    it('should create new deals', async () => {
      const res = await request(app)
        .post('/api/scraper/deals')
        .set('Authorization', `Bearer ${scraperToken}`)
        .send({
          storeId: testStore.insertedId.toString(),
          deals: [
            {
              productId: testProduct.insertedId.toString(),
              type: 'DISCOUNT',
              discount: 20,
              startDate: new Date(),
              endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
          ]
        });

      expect(res.status).toBe(200);
      
      const deal = await db.collection('deals').findOne({
        productId: testProduct.insertedId
      });
      expect(deal).toBeDefined();
      expect(deal.type).toBe('DISCOUNT');
    });

    it('should update existing deals', async () => {
      // Create existing deal
      const existingDeal = await db.collection('deals').insertOne({
        storeId: testStore.insertedId,
        productId: testProduct.insertedId,
        type: 'DISCOUNT',
        discount: 10,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      const res = await request(app)
        .post('/api/scraper/deals')
        .set('Authorization', `Bearer ${scraperToken}`)
        .send({
          storeId: testStore.insertedId.toString(),
          deals: [
            {
              id: existingDeal.insertedId.toString(),
              discount: 15,
              endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            }
          ]
        });

      expect(res.status).toBe(200);
      
      const updatedDeal = await db.collection('deals').findOne({
        _id: existingDeal.insertedId
      });
      expect(updatedDeal.discount).toBe(15);
    });

    it('should expire outdated deals', async () => {
      // Create expired deal
      await db.collection('deals').insertOne({
        storeId: testStore.insertedId,
        productId: testProduct.insertedId,
        type: 'DISCOUNT',
        discount: 10,
        startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      });

      const res = await request(app)
        .post('/api/scraper/cleanup')
        .set('Authorization', `Bearer ${scraperToken}`);

      expect(res.status).toBe(200);
      
      const expiredDeals = await db.collection('deals').find({
        endDate: { $lt: new Date() },
        status: { $ne: 'expired' }
      }).toArray();
      expect(expiredDeals.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid product IDs', async () => {
      const res = await request(app)
        .post('/api/scraper/prices/batch')
        .set('Authorization', `Bearer ${scraperToken}`)
        .send({
          storeId: testStore.insertedId.toString(),
          prices: [
            {
              productId: 'invalid_id',
              price: 9.99,
              timestamp: new Date(),
              source: 'web_scraper'
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('invalid product');
    });

    it('should handle scraper errors', async () => {
      const res = await request(app)
        .post('/api/scraper/errors')
        .set('Authorization', `Bearer ${scraperToken}`)
        .send({
          type: 'SCRAPE_ERROR',
          storeId: testStore.insertedId.toString(),
          message: 'Failed to scrape prices',
          timestamp: new Date(),
          metadata: {
            url: 'https://teststore.com/products',
            statusCode: 503
          }
        });

      expect(res.status).toBe(200);
      
      const error = await db.collection('scraper_errors').findOne({
        storeId: testStore.insertedId
      });
      expect(error).toBeDefined();
      expect(error.type).toBe('SCRAPE_ERROR');
    });
  });

  describe('Store Management', () => {
    it('should update store information', async () => {
      const res = await request(app)
        .post('/api/scraper/stores')
        .set('Authorization', `Bearer ${scraperToken}`)
        .send({
          stores: [
            {
              id: testStore.insertedId.toString(),
              name: 'Updated Test Store',
              openingHours: {
                monday: '9:00-18:00',
                tuesday: '9:00-18:00'
              }
            }
          ]
        });

      expect(res.status).toBe(200);
      
      const updatedStore = await db.collection('stores').findOne({
        _id: testStore.insertedId
      });
      expect(updatedStore.name).toBe('Updated Test Store');
      expect(updatedStore.openingHours).toBeDefined();
    });

    it('should handle new store locations', async () => {
      const res = await request(app)
        .post('/api/scraper/stores')
        .set('Authorization', `Bearer ${scraperToken}`)
        .send({
          stores: [
            {
              chain: 'TestChain',
              name: 'New Location',
              location: {
                address: '456 Test Ave',
                coordinates: [1, 1]
              }
            }
          ]
        });

      expect(res.status).toBe(200);
      
      const newStore = await db.collection('stores').findOne({
        'location.address': '456 Test Ave'
      });
      expect(newStore).toBeDefined();
      expect(newStore.chain).toBe('TestChain');
    });
  });
}); 