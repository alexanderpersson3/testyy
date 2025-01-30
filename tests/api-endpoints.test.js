import request from 'supertest';
import app from '../app.js';
import { getDb } from '../db.js';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';

describe('API Endpoints Test Suite', () => {
  let testUser;
  let testUserToken;
  let testRecipe;
  let testAdmin;
  let testAdminToken;

  beforeAll(async () => {
    // Create test user
    testUser = {
      _id: new ObjectId(),
      email: 'test@example.com',
      username: 'testuser',
      password: '$2b$10$test_hash', // Pre-hashed password
      role: 'USER'
    };

    testAdmin = {
      _id: new ObjectId(),
      email: 'admin@example.com',
      username: 'admin',
      password: '$2b$10$test_hash',
      role: 'ADMIN'
    };

    // Generate tokens
    testUserToken = jwt.sign(
      { userId: testUser._id, role: testUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    testAdminToken = jwt.sign(
      { userId: testAdmin._id, role: testAdmin.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Insert test data
    const db = getDb();
    await db.collection('users').insertMany([testUser, testAdmin]);
  });

  afterAll(async () => {
    // Clean up test data
    const db = getDb();
    await db.collection('users').deleteMany({
      _id: { $in: [testUser._id, testAdmin._id] }
    });
  });

  describe('Authentication Endpoints', () => {
    test('POST /api/auth/register - Register new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          username: 'newuser',
          password: 'Test123!'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', 'newuser@example.com');
    });

    test('POST /api/auth/login - Login user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    });

    test('POST /api/auth/forgot-password - Request password reset', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'test@example.com'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    test('GET /api/auth/verify-email - Verify email', async () => {
      const res = await request(app)
        .get('/api/auth/verify-email')
        .query({ token: 'test_verification_token' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('verified');
    });
  });

  describe('Recipe Endpoints', () => {
    test('POST /api/recipes - Create recipe', async () => {
      const res = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          title: 'Test Recipe',
          description: 'Test description',
          ingredients: [
            { name: 'Ingredient 1', amount: 1, unit: 'cup' }
          ],
          instructions: ['Step 1', 'Step 2'],
          cookingTime: 30,
          servings: 4
        });

      expect(res.status).toBe(201);
      testRecipe = res.body;
    });

    test('GET /api/recipes - Get recipes list', async () => {
      const res = await request(app)
        .get('/api/recipes')
        .query({
          page: 1,
          limit: 10,
          sort: 'createdAt'
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.recipes)).toBe(true);
    });

    test('GET /api/recipes/search - Search recipes', async () => {
      const res = await request(app)
        .get('/api/recipes/search')
        .query({
          q: 'test',
          filters: JSON.stringify({
            cuisine: ['italian'],
            difficulty: 'easy'
          })
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.results)).toBe(true);
    });

    test('PUT /api/recipes/:recipeId - Update recipe', async () => {
      const res = await request(app)
        .put(`/api/recipes/${testRecipe._id}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          title: 'Updated Test Recipe'
        });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Test Recipe');
    });
  });

  describe('User Profile Endpoints', () => {
    test('GET /api/users/me - Get own profile', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email', testUser.email);
    });

    test('PUT /api/users/me - Update profile', async () => {
      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          bio: 'Test bio',
          preferences: {
            cuisine: ['italian', 'mexican']
          }
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('bio', 'Test bio');
    });
  });

  describe('Social Interaction Endpoints', () => {
    test('POST /api/recipes/:recipeId/like - Like recipe', async () => {
      const res = await request(app)
        .post(`/api/recipes/${testRecipe._id}/like`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('liked', true);
    });

    test('POST /api/recipes/:recipeId/comments - Add comment', async () => {
      const res = await request(app)
        .post(`/api/recipes/${testRecipe._id}/comments`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          text: 'Test comment'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('text', 'Test comment');
    });

    test('POST /api/social/follow/:userId - Follow user', async () => {
      const res = await request(app)
        .post(`/api/social/follow/${testAdmin._id}`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('following', true);
    });
  });

  describe('Price Tracking Endpoints', () => {
    test('POST /api/price-alerts - Create price alert', async () => {
      const res = await request(app)
        .post('/api/price-alerts')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          ingredientId: new ObjectId(),
          targetPrice: 9.99,
          condition: 'below'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('targetPrice', 9.99);
    });

    test('GET /api/price-history/:ingredientId - Get price history', async () => {
      const res = await request(app)
        .get(`/api/price-history/${new ObjectId()}`)
        .query({
          timeRange: 'month'
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.history)).toBe(true);
    });
  });

  describe('Admin Endpoints', () => {
    test('GET /api/admin/users - Get users list (admin only)', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .query({
          page: 1,
          limit: 10
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
    });

    test('GET /api/admin/analytics/users - Get user analytics', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/users')
        .set('Authorization', `Bearer ${testAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dailyActiveUsers');
      expect(res.body).toHaveProperty('monthlyActiveUsers');
    });
  });

  describe('Notification Endpoints', () => {
    test('GET /api/notifications - Get notifications', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${testUserToken}`)
        .query({
          page: 1,
          limit: 20
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.notifications)).toBe(true);
    });

    test('PUT /api/notifications/:notificationId/read - Mark notification as read', async () => {
      const res = await request(app)
        .put(`/api/notifications/${new ObjectId()}/read`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('read', true);
    });
  });

  describe('Search Endpoints', () => {
    test('GET /api/search/recipes - Search recipes', async () => {
      const res = await request(app)
        .get('/api/search/recipes')
        .query({
          q: 'test',
          filters: JSON.stringify({
            cuisine: ['italian'],
            cookingTime: { min: 0, max: 60 }
          }),
          sort: 'relevance',
          page: 1,
          limit: 10
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
      expect(res.body).toHaveProperty('total');
    });

    test('GET /api/search/users - Search users', async () => {
      const res = await request(app)
        .get('/api/search/users')
        .query({
          q: 'test',
          type: 'username',
          page: 1,
          limit: 10
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.results)).toBe(true);
    });
  });

  describe('Campaign Endpoints', () => {
    test('POST /api/ads/campaigns - Create ad campaign', async () => {
      const res = await request(app)
        .post('/api/ads/campaigns')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .send({
          name: 'Test Campaign',
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          budget: {
            total: 1000,
            daily: 100
          },
          targeting: {
            regions: ['US', 'UK'],
            userTypes: ['FREE']
          },
          ads: [{
            type: 'banner',
            content: {
              title: 'Test Ad',
              imageUrl: 'https://example.com/ad.jpg'
            }
          }]
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('name', 'Test Campaign');
    });

    test('GET /api/ads/campaigns/:campaignId/analytics - Get campaign analytics', async () => {
      const res = await request(app)
        .get(`/api/ads/campaigns/${new ObjectId()}/analytics`)
        .set('Authorization', `Bearer ${testAdminToken}`)
        .query({
          timeRange: 'week'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('impressions');
      expect(res.body).toHaveProperty('clicks');
      expect(res.body).toHaveProperty('ctr');
    });
  });

  describe('Error Handling', () => {
    test('404 - Not Found', async () => {
      const res = await request(app)
        .get('/api/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    test('401 - Unauthorized', async () => {
      const res = await request(app)
        .get('/api/users/me');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    test('403 - Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
    });
  });
}); 