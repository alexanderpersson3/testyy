import request from 'supertest';
import { app } from '../app.js';
import { getDb } from '../config/db.js';
import { createStructuredLog } from '../config/cloud.js';
import { taskManager } from '../config/tasks.js';
import { elasticClient } from '../config/elastic.js';

describe('Integration Tests', () => {
  let db;
  let testUser;
  let userToken;
  let testRecipe;
  let testProduct;
  let testStore;

  beforeAll(async () => {
    db = await getDb();
    
    // Create test user
    testUser = await db.collection('users').insertOne({
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: '$2b$10$test',
      role: 'user',
      subscription: { status: 'active', plan: 'premium' }
    });

    userToken = jwt.sign(
      { userId: testUser.insertedId.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create test store
    testStore = await db.collection('stores').insertOne({
      name: 'Test Store',
      chain: 'TestChain',
      location: { address: '123 Test St', coordinates: [0, 0] }
    });

    // Create test product
    testProduct = await db.collection('products').insertOne({
      name: 'Test Ingredient',
      store: testStore.insertedId,
      currentPrice: 9.99,
      priceHistory: []
    });
  });

  afterAll(async () => {
    await db.collection('users').deleteOne({ _id: testUser.insertedId });
    await db.collection('stores').deleteOne({ _id: testStore.insertedId });
    await db.collection('products').deleteOne({ _id: testProduct.insertedId });
    await elasticClient.deleteByQuery({
      index: 'recipes',
      body: { query: { match_all: {} } }
    });
  });

  describe('Recipe Creation Flow', () => {
    it('should create recipe and trigger related processes', async () => {
      // Create recipe
      const recipeRes = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Integration Test Recipe',
          ingredients: [{
            item: testProduct.insertedId.toString(),
            amount: 1,
            unit: 'cup'
          }],
          instructions: ['Step 1'],
          cuisine: 'Test',
          difficulty: 'easy'
        });

      expect(recipeRes.status).toBe(201);
      testRecipe = recipeRes.body.recipe;

      // Verify recipe was indexed in Elasticsearch
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for indexing
      const searchRes = await request(app)
        .get('/api/recipes/search')
        .query({ q: 'Integration Test Recipe' });
      
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.recipes.some(r => r._id === testRecipe._id)).toBe(true);

      // Verify ingredient popularity was updated
      const product = await db.collection('products').findOne({
        _id: testProduct.insertedId
      });
      expect(product.usageCount).toBe(1);
    });

    it('should handle recipe interactions correctly', async () => {
      // Like recipe
      const likeRes = await request(app)
        .post(`/api/recipes/${testRecipe._id}/like`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(likeRes.status).toBe(200);

      // Verify notification was created
      const notification = await db.collection('notifications').findOne({
        type: 'RECIPE_LIKED',
        'metadata.recipeId': testRecipe._id
      });
      expect(notification).toBeDefined();

      // Comment on recipe
      const commentRes = await request(app)
        .post(`/api/recipes/${testRecipe._id}/comments`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ text: 'Test comment' });

      expect(commentRes.status).toBe(200);

      // Verify recipe stats were updated
      const recipe = await db.collection('recipes').findOne({
        _id: testRecipe._id
      });
      expect(recipe.stats.likes).toBe(1);
      expect(recipe.stats.comments).toBe(1);
    });
  });

  describe('Price Alert Flow', () => {
    it('should handle price updates and alerts', async () => {
      // Create price alert
      const alertRes = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId: testProduct.insertedId.toString(),
          targetPrice: 8.99
        });

      expect(alertRes.status).toBe(200);

      // Update price through scraper API
      const updateRes = await request(app)
        .post('/api/scraper/prices/batch')
        .set('Authorization', `Bearer ${process.env.SCRAPER_SECRET}`)
        .send({
          storeId: testStore.insertedId.toString(),
          prices: [{
            productId: testProduct.insertedId.toString(),
            price: 7.99,
            timestamp: new Date()
          }]
        });

      expect(updateRes.status).toBe(200);

      // Verify alert was triggered
      const notification = await db.collection('notifications').findOne({
        type: 'PRICE_ALERT',
        'metadata.productId': testProduct.insertedId
      });
      expect(notification).toBeDefined();

      // Verify price history was updated
      const product = await db.collection('products').findOne({
        _id: testProduct.insertedId
      });
      expect(product.currentPrice).toBe(7.99);
      expect(product.priceHistory.length).toBe(1);
    });
  });

  describe('Search & Discovery Flow', () => {
    it('should handle recipe search and filtering', async () => {
      // Search by title
      const titleSearch = await request(app)
        .get('/api/recipes/search')
        .query({ q: 'Integration Test' });
      
      expect(titleSearch.status).toBe(200);
      expect(titleSearch.body.recipes.length).toBeGreaterThan(0);

      // Filter by cuisine
      const cuisineFilter = await request(app)
        .get('/api/recipes/search')
        .query({ cuisine: 'Test' });
      
      expect(cuisineFilter.status).toBe(200);
      expect(cuisineFilter.body.recipes.length).toBeGreaterThan(0);

      // Complex query
      const complexSearch = await request(app)
        .get('/api/recipes/search')
        .query({
          q: 'Test',
          cuisine: 'Test',
          difficulty: 'easy',
          ingredients: [testProduct.insertedId.toString()]
        });
      
      expect(complexSearch.status).toBe(200);
      expect(complexSearch.body.recipes.length).toBeGreaterThan(0);
    });

    it('should track search analytics correctly', async () => {
      // Perform search
      await request(app)
        .get('/api/recipes/search')
        .query({ q: 'Analytics Test' });

      // Verify search was logged
      const searchLog = await db.collection('search_logs').findOne({
        query: 'Analytics Test'
      });
      expect(searchLog).toBeDefined();

      // Get search analytics
      const analyticsRes = await request(app)
        .get('/api/analytics/search')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(analyticsRes.status).toBe(200);
      expect(analyticsRes.body.searches).toBeGreaterThan(0);
    });
  });

  describe('Subscription & Payment Flow', () => {
    it('should handle subscription verification', async () => {
      // Verify iOS receipt
      const iosRes = await request(app)
        .post('/api/subscription/verify/ios')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          receipt: 'test_receipt',
          productId: 'premium_monthly'
        });

      expect(iosRes.status).toBe(200);
      expect(iosRes.body.subscription.status).toBe('active');

      // Verify subscription status affects feature access
      const premiumFeatureRes = await request(app)
        .get('/api/recipes/premium-content')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(premiumFeatureRes.status).toBe(200);
    });
  });

  describe('Background Jobs Flow', () => {
    it('should process jobs correctly', async () => {
      // Create job that triggers email
      const emailJob = await taskManager.createTask('email', {
        type: 'WELCOME_EMAIL',
        userId: testUser.insertedId.toString()
      });

      expect(emailJob).toBeDefined();

      // Verify job was processed
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for processing
      const jobResult = await db.collection('email_logs').findOne({
        userId: testUser.insertedId
      });
      expect(jobResult).toBeDefined();
      expect(jobResult.status).toBe('sent');
    });
  });
}); 