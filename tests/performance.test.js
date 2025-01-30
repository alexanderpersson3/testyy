import request from 'supertest';
import { app } from '../app.js';
import { getDb } from '../config/db.js';
import { createStructuredLog } from '../config/cloud.js';
import { performance } from 'perf_hooks';

describe('Performance & Load Tests', () => {
  let db;
  let testUser;
  let userToken;

  beforeAll(async () => {
    db = await getDb();
    testUser = await db.collection('users').insertOne({
      email: 'test@example.com',
      username: 'testuser',
      role: 'user'
    });

    userToken = jwt.sign(
      { userId: testUser.insertedId.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create test data
    const recipes = Array(100).fill().map((_, i) => ({
      title: `Recipe ${i}`,
      author: testUser.insertedId,
      ingredients: [{ item: 'test', amount: 1, unit: 'cup' }],
      instructions: ['Step 1'],
      createdAt: new Date()
    }));
    await db.collection('recipes').insertMany(recipes);
  });

  afterAll(async () => {
    await db.collection('users').deleteOne({ _id: testUser.insertedId });
    await db.collection('recipes').deleteMany({ author: testUser.insertedId });
  });

  describe('API Response Times', () => {
    it('should handle recipe listing with pagination efficiently', async () => {
      const start = performance.now();
      const res = await request(app)
        .get('/api/recipes')
        .query({ page: 1, limit: 20 });
      const duration = performance.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(200); // Should respond within 200ms
      expect(res.body.recipes.length).toBe(20);
    });

    it('should handle search queries efficiently', async () => {
      const start = performance.now();
      const res = await request(app)
        .get('/api/recipes/search')
        .query({ q: 'Recipe', page: 1, limit: 20 });
      const duration = performance.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(300); // Search should complete within 300ms
    });

    it('should handle complex aggregation efficiently', async () => {
      const start = performance.now();
      const res = await request(app)
        .get('/api/recipes/stats')
        .set('Authorization', `Bearer ${userToken}`);
      const duration = performance.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(500); // Complex aggregation within 500ms
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple simultaneous requests', async () => {
      const requests = Array(50).fill().map(() => 
        request(app).get('/api/recipes')
      );

      const start = performance.now();
      const responses = await Promise.all(requests);
      const duration = performance.now() - start;

      expect(responses.every(res => res.status === 200)).toBe(true);
      expect(duration / 50).toBeLessThan(100); // Average response time under 100ms
    });

    it('should handle concurrent writes efficiently', async () => {
      const requests = Array(10).fill().map((_, i) => 
        request(app)
          .post('/api/recipes')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            title: `Concurrent Recipe ${i}`,
            ingredients: [{ item: 'test', amount: 1, unit: 'cup' }],
            instructions: ['Step 1']
          })
      );

      const start = performance.now();
      const responses = await Promise.all(requests);
      const duration = performance.now() - start;

      expect(responses.every(res => res.status === 201)).toBe(true);
      expect(duration / 10).toBeLessThan(200); // Average write time under 200ms
    });
  });

  describe('Database Performance', () => {
    it('should utilize indexes effectively', async () => {
      // Get explain plan for a query
      const explain = await db.collection('recipes').explain().find({
        title: /Recipe/,
        author: testUser.insertedId
      }).toArray();

      expect(explain.queryPlanner.winningPlan.stage).not.toBe('COLLSCAN');
      expect(explain.executionStats.executionTimeMillis).toBeLessThan(100);
    });

    it('should handle large result sets efficiently', async () => {
      const start = performance.now();
      const res = await request(app)
        .get('/api/recipes/export')
        .set('Authorization', `Bearer ${userToken}`);
      const duration = performance.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(1000); // Large data export within 1s
    });
  });

  describe('Cache Performance', () => {
    it('should utilize cache for repeated requests', async () => {
      // First request - uncached
      const start1 = performance.now();
      await request(app).get('/api/recipes/popular');
      const duration1 = performance.now() - start1;

      // Second request - should be cached
      const start2 = performance.now();
      const res = await request(app).get('/api/recipes/popular');
      const duration2 = performance.now() - start2;

      expect(res.status).toBe(200);
      expect(duration2).toBeLessThan(duration1 * 0.5); // Cached response should be twice as fast
    });

    it('should handle cache invalidation efficiently', async () => {
      // Create a new recipe
      await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Cache Test Recipe',
          ingredients: [{ item: 'test', amount: 1, unit: 'cup' }],
          instructions: ['Step 1']
        });

      const start = performance.now();
      const res = await request(app).get('/api/recipes/popular');
      const duration = performance.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(200); // Cache rebuild within 200ms
    });
  });

  describe('Memory Usage', () => {
    it('should handle file uploads without memory leaks', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform multiple file uploads
      for (let i = 0; i < 5; i++) {
        const image = Buffer.alloc(1024 * 1024); // 1MB
        await request(app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${userToken}`)
          .attach('image', image, 'test.jpg');
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
      
      expect(memoryIncrease).toBeLessThan(10); // Memory increase should be less than 10MB
    });

    it('should handle large response streaming efficiently', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      await request(app)
        .get('/api/recipes/export')
        .set('Authorization', `Bearer ${userToken}`);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
      
      expect(memoryIncrease).toBeLessThan(50); // Memory increase should be less than 50MB
    });
  });
}); 