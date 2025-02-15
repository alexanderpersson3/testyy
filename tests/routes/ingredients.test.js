import { expect } from 'chai';
import request from 'supertest';
import { ObjectId } from 'mongodb';
import { createTestIngredient, createTestUser, createTestProduct } from '../helpers/test-utils.js';
import { setupMockDb, closeMockDb, getMockDb, clearMockDb } from '../mock-db.js';
import * as ingredientService from '../../services/ingredient-service.js';
import app from '../../app.js';
import jwt from 'jsonwebtoken';

describe('Ingredient Routes', () => {
  let db;
  let testUser;
  let adminUser;
  let userToken;
  let adminToken;

  before(async () => {
    db = await setupMockDb();
    ingredientService.setTestDb(db);

    // Create test users
    testUser = createTestUser();
    adminUser = createTestUser({ role: 'admin' });
    await db.collection('users').insertMany([testUser, adminUser]);

    // Create tokens
    userToken = jwt.sign({ userId: testUser._id, role: 'user' }, process.env.JWT_SECRET);
    adminToken = jwt.sign({ userId: adminUser._id, role: 'admin' }, process.env.JWT_SECRET);

    try {
      await db.createCollection('normalized_ingredients');
    } catch (error) {
      // Collection might already exist
    }
    await db
      .collection('normalized_ingredients')
      .createIndex({ name: 'text', normalized_name: 'text' }, { default_language: 'none' });
  });

  beforeEach(async () => {
    await clearMockDb();
  });

  after(async () => {
    await closeMockDb();
  });

  describe('GET /api/ingredients/search', () => {
    beforeEach(async () => {
      // Insert test ingredients
      const testIngredients = [
        createTestIngredient({
          name: 'milk',
          normalized_name: 'milk',
          category: 'dairy',
        }),
        createTestIngredient({
          name: 'bread',
          normalized_name: 'bread',
          category: 'bakery',
        }),
      ];
      await db.collection('normalized_ingredients').insertMany(testIngredients);
    });

    it('should search ingredients by name', async () => {
      const response = await request(app)
        .get('/api/ingredients/search')
        .query({ q: 'milk' })
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0].name).to.equal('milk');
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/ingredients/search')
        .query({ category: 'dairy' })
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0].category).to.equal('dairy');
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/ingredients/search')
        .query({ limit: 1 })
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.lengthOf(1);
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/ingredients/search').query({ q: 'milk' });

      expect(response.status).to.equal(401);
    });
  });

  describe('GET /api/ingredients/categories', () => {
    beforeEach(async () => {
      // Insert test ingredients with different categories
      const testIngredients = [
        createTestIngredient({ name: 'milk1', normalized_name: 'milk1', category: 'dairy' }),
        createTestIngredient({ name: 'milk2', normalized_name: 'milk2', category: 'dairy' }),
        createTestIngredient({ name: 'meat1', normalized_name: 'meat1', category: 'meat' }),
      ];
      await db.collection('normalized_ingredients').insertMany(testIngredients);
    });

    it('should return categories with correct counts', async () => {
      const response = await request(app)
        .get('/api/ingredients/categories')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.lengthOf(2);
      const dairyCategory = response.body.find(c => c.category === 'dairy');
      expect(dairyCategory.count).to.equal(2);
      const meatCategory = response.body.find(c => c.category === 'meat');
      expect(meatCategory.count).to.equal(1);
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/ingredients/categories');

      expect(response.status).to.equal(401);
    });
  });

  describe('GET /api/ingredients/:ingredientId', () => {
    let testIngredient;

    beforeEach(async () => {
      testIngredient = createTestIngredient({
        name: 'test milk',
        normalized_name: 'test milk',
        category: 'dairy',
        products: [
          createTestProduct({ name: 'ICA Milk 1L', unit: 'l' }),
          createTestProduct({ name: 'Coop Milk 1L', unit: 'l' }),
        ],
      });
      const result = await db.collection('normalized_ingredients').insertOne(testIngredient);
      testIngredient._id = result.insertedId;
    });

    it('should return ingredient details', async () => {
      const response = await request(app)
        .get(`/api/ingredients/${testIngredient._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.exist;
      expect(response.body.name).to.equal(testIngredient.name);
      expect(response.body.best_prices).to.exist;
    });

    it('should return 404 for non-existent ingredient', async () => {
      const response = await request(app)
        .get('/api/ingredients/000000000000000000000000')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).to.equal(404);
    });

    it('should require authentication', async () => {
      const response = await request(app).get(`/api/ingredients/${testIngredient._id}`);

      expect(response.status).to.equal(401);
    });
  });

  describe('POST /api/ingredients/sync', () => {
    it('should require admin role', async () => {
      const response = await request(app)
        .post('/api/ingredients/sync')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).to.equal(403);
    });

    it('should sync ingredients successfully', async () => {
      const testProducts = [
        createTestProduct({ name: 'Test Milk 1L', unit: 'l' }),
        createTestProduct({ name: 'Test Bread 500g', unit: 'g' }),
      ];

      const response = await request(app)
        .post('/api/ingredients/sync')
        .send(testProducts)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).to.equal(200);
      expect(response.body.inserted + response.body.updated).to.equal(2);

      const ingredients = await db.collection('normalized_ingredients').find({}).toArray();
      expect(ingredients).to.have.lengthOf(2);
    });
  });
});
