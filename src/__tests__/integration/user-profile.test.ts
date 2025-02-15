import { testRequest, generateTestToken, authHeader } from './setup';
import { userFixtures } from '../fixtures/users.fixture';
import { databaseService } from '../../core/database/database.service';

describe('User Profile API', () => {
  const db = databaseService.getDb();
  const usersCollection = db.collection('users');

  beforeEach(async () => {
    await usersCollection.deleteMany({});
    await usersCollection.insertOne(userFixtures.regularUser);
  });

  describe('GET /api/users/:userId', () => {
    it('should return user profile successfully', async () => {
      const response = await testRequest
        .get(`/api/users/${userFixtures.regularUser._id}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        username: userFixtures.regularUser.username,
        displayName: userFixtures.regularUser.displayName,
        bio: userFixtures.regularUser.bio,
        preferences: userFixtures.regularUser.preferences,
        stats: expect.objectContaining({
          recipeCount: expect.any(Number),
          followerCount: expect.any(Number),
          followingCount: expect.any(Number),
          totalLikes: expect.any(Number)
        })
      });
    });

    it('should return 404 for non-existent user', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await testRequest
        .get(`/api/users/${nonExistentId}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'User not found');
    });

    it('should include isFollowing when authenticated', async () => {
      const token = generateTestToken();
      const response = await testRequest
        .get(`/api/users/${userFixtures.regularUser._id}`)
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('isFollowing');
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should update user profile successfully', async () => {
      const token = generateTestToken();
      const update = {
        displayName: 'Updated Name',
        bio: 'Updated bio',
        website: 'https://example.com',
        location: 'New Location'
      };

      const response = await testRequest
        .put('/api/users/profile')
        .set(authHeader(token))
        .send(update);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject(update);

      // Verify database update
      const updatedUser = await usersCollection.findOne({ _id: userFixtures.regularUser._id });
      expect(updatedUser).toMatchObject(update);
    });

    it('should return 401 when not authenticated', async () => {
      const update = { displayName: 'Updated Name' };
      const response = await testRequest
        .put('/api/users/profile')
        .send(update);

      expect(response.status).toBe(401);
    });

    it('should validate input data', async () => {
      const token = generateTestToken();
      const invalidUpdate = {
        displayName: 'x', // too short
        website: 'not-a-url'
      };

      const response = await testRequest
        .put('/api/users/profile')
        .set(authHeader(token))
        .send(invalidUpdate);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('PUT /api/users/preferences', () => {
    it('should update user preferences successfully', async () => {
      const token = generateTestToken();
      const update = {
        cuisine: ['ITALIAN', 'MEXICAN'],
        dietaryRestrictions: ['VEGETARIAN'],
        cookingLevel: 'INTERMEDIATE',
        servingSize: 4,
        measurementSystem: 'METRIC'
      };

      const response = await testRequest
        .put('/api/users/preferences')
        .set(authHeader(token))
        .send(update);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        preferences: update
      });

      // Verify database update
      const updatedUser = await usersCollection.findOne({ _id: userFixtures.regularUser._id });
      expect(updatedUser?.preferences).toMatchObject(update);
    });

    it('should return 401 when not authenticated', async () => {
      const update = { cuisine: ['ITALIAN'] };
      const response = await testRequest
        .put('/api/users/preferences')
        .send(update);

      expect(response.status).toBe(401);
    });

    it('should validate preference values', async () => {
      const token = generateTestToken();
      const invalidUpdate = {
        cookingLevel: 'EXPERT', // invalid enum value
        servingSize: 0 // below minimum
      };

      const response = await testRequest
        .put('/api/users/preferences')
        .set(authHeader(token))
        .send(invalidUpdate);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('POST /api/users/:userId/follow', () => {
    beforeEach(async () => {
      await usersCollection.insertOne(userFixtures.premiumUser);
    });

    it('should follow a user successfully', async () => {
      const token = generateTestToken();
      const response = await testRequest
        .post(`/api/users/${userFixtures.premiumUser._id}/follow`)
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        following: true
      });
    });

    it('should unfollow a user successfully', async () => {
      // First follow the user
      const token = generateTestToken();
      await testRequest
        .post(`/api/users/${userFixtures.premiumUser._id}/follow`)
        .set(authHeader(token));

      // Then unfollow
      const response = await testRequest
        .post(`/api/users/${userFixtures.premiumUser._id}/follow`)
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        following: false
      });
    });

    it('should return 401 when not authenticated', async () => {
      const response = await testRequest
        .post(`/api/users/${userFixtures.premiumUser._id}/follow`);

      expect(response.status).toBe(401);
    });

    it('should prevent self-following', async () => {
      const token = generateTestToken();
      const response = await testRequest
        .post(`/api/users/${userFixtures.regularUser._id}/follow`)
        .set(authHeader(token));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Cannot follow yourself');
    });
  });
}); 