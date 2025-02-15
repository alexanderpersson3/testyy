import { testRequest, generateTestToken, authHeader } from './setup';
import { userFixtures } from '../fixtures/users.fixture';
import { recipeFixtures } from '../fixtures/recipes.fixture';
import { getDb } from '../../core/database/database.service';

describe('Recipes API', () => {
  const db = getDb();
  const recipesCollection = db.collection('recipes');
  const usersCollection = db.collection('users');

  beforeEach(async () => {
    await recipesCollection.deleteMany({});
    await usersCollection.deleteMany({});
    await usersCollection.insertOne(userFixtures.regularUser);
  });

  describe('GET /api/recipes', () => {
    beforeEach(async () => {
      await recipesCollection.insertOne(recipeFixtures.basicRecipe);
      await recipesCollection.insertOne(recipeFixtures.premiumRecipe);
    });

    it('should return all public recipes', async () => {
      const response = await testRequest
        .get('/api/recipes');

      expect(response.status).toBe(200);
      expect(response.body.recipes).toHaveLength(2);
      expect(response.body.recipes[0]).toMatchObject({
        title: recipeFixtures.basicRecipe.title
      });
    });

    it('should filter recipes by cuisine', async () => {
      const response = await testRequest
        .get('/api/recipes')
        .query({ cuisine: 'ITALIAN' });

      expect(response.status).toBe(200);
      expect(response.body.recipes).toHaveLength(2);
      expect(response.body.recipes[0].cuisine).toBe('ITALIAN');
    });
  });

  describe('POST /api/recipes', () => {
    it('should create a new recipe when authenticated', async () => {
      const token = generateTestToken();
      const newRecipe = {
        title: 'New Recipe',
        description: 'A new test recipe',
        ingredients: [
          {
            name: 'Ingredient 1',
            quantity: 100,
            unit: 'g'
          }
        ],
        instructions: ['Step 1', 'Step 2'],
        prepTime: 10,
        cookTime: 20,
        servings: 4,
        difficulty: 'EASY',
        cuisine: 'ITALIAN'
      };

      const response = await testRequest
        .post('/api/recipes')
        .set(authHeader(token))
        .send(newRecipe);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        title: newRecipe.title,
        description: newRecipe.description
      });
    });

    it('should return 401 when not authenticated', async () => {
      const newRecipe = {
        title: 'New Recipe',
        description: 'A new test recipe'
      };

      const response = await testRequest
        .post('/api/recipes')
        .send(newRecipe);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/recipes/:id', () => {
    beforeEach(async () => {
      await recipesCollection.insertOne(recipeFixtures.basicRecipe);
    });

    it('should return a recipe by ID', async () => {
      const response = await testRequest
        .get(`/api/recipes/${recipeFixtures.basicRecipe._id}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        title: recipeFixtures.basicRecipe.title,
        description: recipeFixtures.basicRecipe.description
      });
    });

    it('should return 404 for non-existent recipe', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await testRequest
        .get(`/api/recipes/${nonExistentId}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/recipes/:id', () => {
    beforeEach(async () => {
      await recipesCollection.insertOne(recipeFixtures.basicRecipe);
    });

    it('should update a recipe when owner is authenticated', async () => {
      const token = generateTestToken(recipeFixtures.basicRecipe.userId.toString());
      const update = {
        title: 'Updated Recipe Title',
        description: 'Updated description'
      };

      const response = await testRequest
        .put(`/api/recipes/${recipeFixtures.basicRecipe._id}`)
        .set(authHeader(token))
        .send(update);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject(update);
    });

    it('should return 403 when not the owner', async () => {
      const token = generateTestToken();
      const update = {
        title: 'Updated Recipe Title'
      };

      const response = await testRequest
        .put(`/api/recipes/${recipeFixtures.basicRecipe._id}`)
        .set(authHeader(token))
        .send(update);

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/recipes/:id', () => {
    beforeEach(async () => {
      await recipesCollection.insertOne(recipeFixtures.basicRecipe);
    });

    it('should delete a recipe when owner is authenticated', async () => {
      const token = generateTestToken(recipeFixtures.basicRecipe.userId.toString());

      const response = await testRequest
        .delete(`/api/recipes/${recipeFixtures.basicRecipe._id}`)
        .set(authHeader(token));

      expect(response.status).toBe(204);

      const deletedRecipe = await recipesCollection.findOne({
        _id: recipeFixtures.basicRecipe._id
      });
      expect(deletedRecipe).toBeNull();
    });

    it('should return 403 when not the owner', async () => {
      const token = generateTestToken();

      const response = await testRequest
        .delete(`/api/recipes/${recipeFixtures.basicRecipe._id}`)
        .set(authHeader(token));

      expect(response.status).toBe(403);
    });
  });
}); 