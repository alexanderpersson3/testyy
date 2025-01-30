import { describe, expect, test, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { ObjectId } from 'mongodb';
import { TestDatabase } from '../helpers/dbHelper';
import socialRouter from '../../routes/social';
import { generateToken } from '../../utils/auth';

// Define the response type that supertest actually returns
interface TestResponse {
  status: number;
  statusCode: number;
  body: any;
  headers: Record<string, string>;
  type: string;
  text: string;
}

describe('Social API Endpoints', () => {
  let app: express.Application;
  let testUser1: any;
  let testUser2: any;
  let testProfile1: any;
  let testProfile2: any;
  let authToken1: string;
  let authToken2: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/social', socialRouter);

    await TestDatabase.connect();
  });

  beforeEach(async () => {
    await TestDatabase.cleanup();
    
    // Create test users and profiles
    testUser1 = await TestDatabase.createTestUser({ email: 'user1@example.com' });
    testUser2 = await TestDatabase.createTestUser({ email: 'user2@example.com' });
    testProfile1 = await TestDatabase.createTestProfile(testUser1._id);
    testProfile2 = await TestDatabase.createTestProfile(testUser2._id);
    
    // Generate auth tokens
    authToken1 = generateToken(testUser1);
    authToken2 = generateToken(testUser2);
  });

  afterAll(async () => {
    await TestDatabase.disconnect();
  });

  describe('Profile Management', () => {
    test('GET /profile - should return user profile', async () => {
      const response = await request(app)
        .get('/api/social/profile')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200) as unknown as TestResponse;

      expect(response.body.profile).toBeDefined();
      expect(response.body.profile.displayName).toBe('Test User');
      expect(response.body.profile.userId).toBe(testUser1._id.toString());
    });

    test('PATCH /profile - should update user profile', async () => {
      const response = await request(app)
        .patch('/api/social/profile')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          displayName: 'Updated Name',
          bio: 'Updated bio'
        })
        .expect(200) as unknown as TestResponse;

      expect(response.body.success).toBe(true);

      // Verify update
      const profileResponse = await request(app)
        .get('/api/social/profile')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200) as unknown as TestResponse;

      expect(profileResponse.body.profile.displayName).toBe('Updated Name');
      expect(profileResponse.body.profile.bio).toBe('Updated bio');
    });
  });

  describe('Story Management', () => {
    test('POST /stories - should create new story', async () => {
      const response = await request(app)
        .post('/api/social/stories')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          content: 'Test story',
          type: 'text'
        })
        .expect(201) as unknown as TestResponse;

      expect(response.body.storyId).toBeDefined();
    });

    test('GET /stories - should list user stories', async () => {
      // First create a story
      await request(app)
        .post('/api/social/stories')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          content: 'Test story',
          type: 'text'
        });

      const response = await request(app)
        .get('/api/social/stories')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200) as unknown as TestResponse;

      expect(response.body.stories).toHaveLength(1);
      expect(response.body.stories[0].content).toBe('Test story');
    });

    test('POST /stories/:id/comments - should add comment to story', async () => {
      // First create a story
      const storyResponse = await request(app)
        .post('/api/social/stories')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          content: 'Test story',
          type: 'text'
        }) as unknown as TestResponse;

      const response = await request(app)
        .post(`/api/social/stories/${storyResponse.body.storyId}/comments`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          content: 'Test comment'
        })
        .expect(201) as unknown as TestResponse;

      expect(response.body.commentId).toBeDefined();
    });
  });

  describe('Following & Blocking', () => {
    test('POST /follow/:userId - should follow user', async () => {
      const response = await request(app)
        .post(`/api/social/follow/${testUser2._id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200) as unknown as TestResponse;

      expect(response.body.success).toBe(true);
    });

    test('POST /unfollow/:userId - should unfollow user', async () => {
      // First follow
      await request(app)
        .post(`/api/social/follow/${testUser2._id}`)
        .set('Authorization', `Bearer ${authToken1}`);

      const response = await request(app)
        .post(`/api/social/unfollow/${testUser2._id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200) as unknown as TestResponse;

      expect(response.body.success).toBe(true);

      // Verify unfollow
      const profile1 = await request(app)
        .get('/api/social/profile')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200) as unknown as TestResponse;

      expect(profile1.body.profile.stats.following).toBe(0);
    });

    test('POST /block/:userId - should block user', async () => {
      const response = await request(app)
        .post(`/api/social/block/${testUser2._id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200) as unknown as TestResponse;

      expect(response.body.success).toBe(true);
    });

    test('GET /blocked - should list blocked users', async () => {
      // First block a user
      await request(app)
        .post(`/api/social/block/${testUser2._id}`)
        .set('Authorization', `Bearer ${authToken1}`);

      const blockedResponse = await request(app)
        .get('/api/social/blocked')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200) as unknown as TestResponse;

      expect(blockedResponse.body.blockedUsers).toHaveLength(1);
    });
  });

  describe('Content Reporting', () => {
    test('POST /report - should report content', async () => {
      const response = await request(app)
        .post('/api/social/report')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          contentId: new ObjectId(),
          contentType: 'story',
          reason: 'inappropriate',
          description: 'Test report'
        })
        .expect(201) as unknown as TestResponse;

      expect(response.body.reportId).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid token', async () => {
      await request(app)
        .patch('/api/social/profiles/me')
        .set('Authorization', 'Bearer invalid_token')
        .send({ displayName: 'Test' })
        .expect(401);
    });

    test('should handle missing token', async () => {
      await request(app)
        .patch('/api/social/profiles/me')
        .send({ displayName: 'Test' })
        .expect(401);
    });

    test('should handle invalid ObjectId', async () => {
      await request(app)
        .get('/api/social/profiles/invalid_id')
        .expect(400);
    });

    test('should handle not found resources', async () => {
      const nonExistentId = new ObjectId();
      await request(app)
        .get(`/api/social/profiles/${nonExistentId}`)
        .expect(404);
    });
  });
}); 