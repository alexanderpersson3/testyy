import request from 'supertest';
import { MongoClient, ObjectId } from 'mongodb';
import app from '../index.js';

describe('Recipe Endpoints', () => {
  let connection;
  let db;
  let testUserId;
  let testToken;

  beforeAll(async () => {
    connection = await MongoClient.connect(process.env.MONGODB_URI);
    db = connection.db(process.env.MONGODB_DB);
    testUserId = await createTestUser();
    testToken = generateTestToken(testUserId);
  });

  afterAll(async () => {
    await connection.close();
  });

  describe('POST /api/recipes', () => {
    const validRecipe = {
      title: 'Test Recipe',
      description: 'A test recipe description',
      ingredients: [
        {
          name: 'Test Ingredient',
          amount: 100,
          unit: 'gram',
        },
      ],
      instructions: ['Step 1: Test instruction', 'Step 2: Another test instruction'],
    };

    it('should create a recipe successfully', async () => {
      const response = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${testToken}`)
        .send(validRecipe);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('title', validRecipe.title);
      expect(response.body.data).toHaveProperty('userId', testUserId.toString());
      expect(response.body.data.ingredients).toHaveLength(1);
      expect(response.body.data.instructions).toHaveLength(2);
    });

    it('should require authentication', async () => {
      const response = await request(app).post('/api/recipes').send(validRecipe);

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          title: '',
          description: '',
          ingredients: [],
          instructions: [],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/recipes/:recipeId', () => {
    let testRecipe;

    beforeEach(async () => {
      const result = await db.collection('recipes').insertOne({
        title: 'Test Recipe',
        description: 'Description',
        ingredients: [{ name: 'Ingredient', amount: 100, unit: 'gram' }],
        instructions: ['Step 1'],
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      testRecipe = result.insertedId;
    });

    it('should get recipe details successfully', async () => {
      const response = await request(app).get(`/api/recipes/${testRecipe}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.response.data).toHaveProperty('title', 'Test Recipe');
    });

    it('should return 404 for non-existent recipe', async () => {
      const nonExistentId = new ObjectId();
      const response = await request(app).get(`/api/recipes/${nonExistentId}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/recipes/:recipeId', () => {
    let testRecipe;

    beforeEach(async () => {
      const result = await db.collection('recipes').insertOne({
        title: 'Original Recipe',
        description: 'Original description',
        ingredients: [{ name: 'Original Ingredient', amount: 100, unit: 'gram' }],
        instructions: ['Original step'],
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      testRecipe = result.insertedId;
    });

    it('should update recipe successfully', async () => {
      const updatedData = {
        title: 'Updated Recipe',
        description: 'Updated description',
        ingredients: [{ name: 'Updated Ingredient', amount: 200, unit: 'gram' }],
        instructions: ['Updated step'],
      };

      const response = await request(app)
        .put(`/api/recipes/${testRecipe}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('title', 'Updated Recipe');
    });

    it('should not update recipe of another user', async () => {
      const anotherUserId = await createTestUser();
      const anotherUserRecipe = await db.collection('recipes').insertOne({
        title: 'Another User Recipe',
        description: 'Description',
        ingredients: [{ name: 'Ingredient', amount: 100, unit: 'gram' }],
        instructions: ['Step 1'],
        userId: anotherUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .put(`/api/recipes/${anotherUserRecipe.insertedId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ title: 'Trying to update' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/recipes/:recipeId', () => {
    let testRecipe;

    beforeEach(async () => {
      const result = await db.collection('recipes').insertOne({
        title: 'Recipe to Delete',
        description: 'Description',
        ingredients: [{ name: 'Ingredient', amount: 100, unit: 'gram' }],
        instructions: ['Step 1'],
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      testRecipe = result.insertedId;
    });

    it('should delete recipe successfully', async () => {
      const response = await request(app)
        .delete(`/api/recipes/${testRecipe}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify recipe is deleted
      const deletedRecipe = await db.collection('recipes').findOne({ _id: testRecipe });
      expect(deletedRecipe).toBeNull();
    });

    it('should not delete recipe of another user', async () => {
      const anotherUserId = await createTestUser();
      const anotherUserRecipe = await db.collection('recipes').insertOne({
        title: 'Another User Recipe',
        description: 'Description',
        ingredients: [{ name: 'Ingredient', amount: 100, unit: 'gram' }],
        instructions: ['Step 1'],
        userId: anotherUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .delete(`/api/recipes/${anotherUserRecipe.insertedId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);

      // Verify recipe still exists
      const recipe = await db.collection('recipes').findOne({ _id: anotherUserRecipe.insertedId });
      expect(recipe).not.toBeNull();
    });
  });
});
