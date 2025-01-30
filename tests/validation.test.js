import request from 'supertest';
import { app } from '../app.js';
import { getDb } from '../config/db.js';
import { createStructuredLog } from '../config/cloud.js';

describe('Data Validation & Error Handling Tests', () => {
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
  });

  afterAll(async () => {
    await db.collection('users').deleteOne({ _id: testUser.insertedId });
  });

  describe('Recipe Validation', () => {
    it('should validate required recipe fields', async () => {
      const res = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          // Missing required fields
          title: '',
          ingredients: []
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain('title is required');
      expect(res.body.errors).toContain('ingredients must not be empty');
    });

    it('should validate ingredient structure', async () => {
      const res = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Test Recipe',
          ingredients: [
            { amount: 1 } // Missing item and unit
          ],
          instructions: ['Step 1']
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain('ingredient item is required');
      expect(res.body.errors).toContain('ingredient unit is required');
    });

    it('should validate media URLs', async () => {
      const res = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Test Recipe',
          ingredients: [
            { item: 'test', amount: 1, unit: 'cup' }
          ],
          instructions: ['Step 1'],
          media: {
            images: ['invalid-url'],
            video: 'not-a-url'
          }
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain('invalid image URL format');
      expect(res.body.errors).toContain('invalid video URL format');
    });
  });

  describe('User Profile Validation', () => {
    it('should validate email format', async () => {
      const res = await request(app)
        .patch('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: 'invalid-email'
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain('invalid email format');
    });

    it('should validate username requirements', async () => {
      const res = await request(app)
        .patch('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          username: 'a' // Too short
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain('username must be at least 3 characters');
    });

    it('should prevent duplicate usernames', async () => {
      // Create another user first
      await db.collection('users').insertOne({
        email: 'other@example.com',
        username: 'existinguser'
      });

      const res = await request(app)
        .patch('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          username: 'existinguser'
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain('username already taken');
    });
  });

  describe('Price Alert Validation', () => {
    it('should validate price thresholds', async () => {
      const res = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId: new ObjectId(),
          targetPrice: -1 // Invalid negative price
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain('target price must be positive');
    });

    it('should validate product existence', async () => {
      const res = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId: new ObjectId(), // Non-existent product
          targetPrice: 9.99
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('product not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      // Simulate DB error by passing invalid ObjectId
      const res = await request(app)
        .get('/api/recipes/invalid-id');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('invalid id format');
    });

    it('should handle rate limiting', async () => {
      // Make multiple requests quickly
      const promises = Array(10).fill().map(() => 
        request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'test123' })
      );

      const responses = await Promise.all(promises);
      const tooManyRequests = responses.some(res => res.status === 429);
      expect(tooManyRequests).toBe(true);
    });

    it('should handle invalid JSON', async () => {
      const res = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid json"');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('invalid JSON');
    });

    it('should handle file size limits', async () => {
      // Create large payload
      const largeImage = Buffer.alloc(6 * 1024 * 1024); // 6MB

      const res = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('image', largeImage, 'large.jpg');

      expect(res.status).toBe(413);
      expect(res.body.error).toContain('file too large');
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize HTML in text fields', async () => {
      const res = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Test Recipe <script>alert("xss")</script>',
          ingredients: [
            { item: 'test', amount: 1, unit: 'cup' }
          ],
          instructions: ['Step 1']
        });

      expect(res.status).toBe(200);
      expect(res.body.recipe.title).toBe('Test Recipe');
    });

    it('should handle SQL injection attempts', async () => {
      const res = await request(app)
        .get('/api/recipes')
        .query({ search: "'; DROP TABLE recipes; --" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('invalid characters in search');
    });
  });
}); 