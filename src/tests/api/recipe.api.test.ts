/// <reference types="jest" />
/// <reference path="../../types/test.d.ts" />

import { describe, expect, test, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { TestDatabase } from '../helpers/dbHelper';
import router from '../../routes/recipes';
import { generateToken } from '../../utils/auth';

// Extend supertest Response type
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeValidObjectId(): R;
    }
  }
}

describe('Recipe API Endpoints', () => {
  let app: express.Application;
  let testUser1: any;
  let testUser2: any;
  let testRecipe: any;
  let authToken1: string;
  let authToken2: string;
  let agent: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/recipes', router);
    agent = request(app);

    await TestDatabase.connect();
  });

  beforeEach(async () => {
    await TestDatabase.cleanup();
    
    // Create test users
    testUser1 = await TestDatabase.createTestUser({ email: 'user1@example.com' });
    testUser2 = await TestDatabase.createTestUser({ email: 'user2@example.com' });
    
    // Create test recipe
    testRecipe = await TestDatabase.createTestRecipe({
      title: 'Test Recipe',
      author: testUser1._id,
      ingredients: [
        { name: 'Ingredient 1', amount: 100, unit: 'g' },
        { name: 'Ingredient 2', amount: 200, unit: 'ml' }
      ],
      instructions: ['Step 1', 'Step 2'],
      tags: ['vegetarian', 'easy']
    });
    
    authToken1 = generateToken(testUser1);
    authToken2 = generateToken(testUser2);
  });

  afterAll(async () => {
    await TestDatabase.disconnect();
  });

  describe('Recipe Discovery', () => {
    test('GET /discover - should return curated recipes', async () => {
      const response = await agent
        .get('/api/recipes/discover')
        .expect(200);

      expect(response.body.recipes).toBeDefined();
      expect(response.body.recipes).toHaveLength(1);
      expect(response.body.recipes[0].title).toBe('Test Recipe');
    });

    test('GET /user/:userId - should return user recipes', async () => {
      const response = await agent
        .get(`/api/recipes/user/${testUser1._id}`)
        .expect(200);

      expect(response.body.recipes).toHaveLength(1);
      expect(response.body.recipes[0].author).toBe(testUser1._id.toString());
    });
  });

  describe('Recipe Management', () => {
    test('POST /cookbook - should add recipe to cookbook', async () => {
      const response = await agent
        .post('/api/recipes/cookbook')
        .set('Authorization', `Bearer ${authToken2}`)
        .send({ recipeId: testRecipe._id })
        .expect(201);

      expect(response.body.success).toBe(true);

      // Verify it's in the cookbook
      const cookbookResponse = await agent
        .get('/api/recipes/cookbook')
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(200);

      expect(cookbookResponse.body.recipes).toHaveLength(1);
      expect(cookbookResponse.body.recipes[0]._id).toBe(testRecipe._id.toString());
    });

    test('POST /:id/remix - should create recipe copy', async () => {
      const response = await agent
        .post(`/api/recipes/${testRecipe._id}/remix`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          title: 'Remixed Recipe',
          modifications: {
            ingredients: [
              { name: 'New Ingredient', amount: 150, unit: 'g' }
            ]
          }
        })
        .expect(201);

      expect(response.body.recipe.title).toBe('Remixed Recipe');
      expect(response.body.recipe.originalRecipeId).toBe(testRecipe._id.toString());
    });

    test('GET /:id/export-text - should export recipe as text', async () => {
      const response = await agent
        .get(`/api/recipes/${testRecipe._id}/export-text`)
        .expect(200);

      expect(response.body.text).toContain('Test Recipe');
      expect(response.body.text).toContain('Ingredient 1');
      expect(response.body.text).toContain('Step 1');
    });
  });

  describe('Recipe Interactions', () => {
    test('POST /:id/like - should like recipe', async () => {
      const response = await agent
        .post(`/api/recipes/${testRecipe._id}/like`)
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Check likes list
      const likesResponse = await agent
        .get(`/api/recipes/${testRecipe._id}/likes`)
        .expect(200);

      expect(likesResponse.body.users).toHaveLength(1);
      expect(likesResponse.body.users[0]._id).toBe(testUser2._id.toString());
    });

    test('POST /:id/report - should report recipe', async () => {
      const response = await agent
        .post(`/api/recipes/${testRecipe._id}/report`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          reason: 'inappropriate',
          description: 'Test report'
        })
        .expect(201);

      expect(response.body.reportId).toBeDefined();
    });
  });

  describe('Recipe Import', () => {
    test('POST /import - should import recipe from URL', async () => {
      const response = await agent
        .post('/api/recipes/import')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          url: 'https://example.com/recipe'
        })
        .expect(201);

      expect(response.body.recipe).toBeDefined();
      expect(response.body.recipe.title).toBeDefined();
      expect(response.body.recipe.ingredients).toBeDefined();
      expect(response.body.recipe.instructions).toBeDefined();
    });

    test('POST /import/image - should import recipe from image', async () => {
      const response = await agent
        .post('/api/recipes/import/image')
        .set('Authorization', `Bearer ${authToken1}`)
        .attach('image', 'path/to/recipe.jpg')
        .expect(201);

      expect(response.body.recipe).toBeDefined();
      expect(response.body.status).toBe('processing'); // OCR might be async
    });
  });

  describe('Pro Features', () => {
    test('GET /:id/pro-tips - should return pro tips for premium users', async () => {
      // Make user1 premium
      await TestDatabase.updateUser(testUser1._id, { isPremium: true });

      const response = await agent
        .get(`/api/recipes/${testRecipe._id}/pro-tips`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.tips).toBeDefined();
      expect(response.body.techniques).toBeDefined();
      expect(response.body.variations).toBeDefined();
    });

    test('GET /:id/pro-tips - should block access for non-premium users', async () => {
      await agent
        .get(`/api/recipes/${testRecipe._id}/pro-tips`)
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(403);
    });
  });

  describe('Recipe Search', () => {
    test('GET /search - should search by multiple criteria', async () => {
      const response = await agent
        .get('/api/recipes/search')
        .query({
          query: 'Test',
          tags: ['vegetarian'],
          difficulty: 'easy',
          time: '30min'
        })
        .expect(200);

      expect(response.body.recipes).toHaveLength(1);
      expect(response.body.recipes[0].title).toBe('Test Recipe');
    });

    test('GET /search/categories - should return search categories', async () => {
      const response = await agent
        .get('/api/recipes/search/categories')
        .expect(200);

      expect(response.body.categories).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'cuisine',
            items: expect.any(Array)
          }),
          expect.objectContaining({
            name: 'ingredients',
            items: expect.any(Array)
          })
        ])
      );
    });
  });
}); 