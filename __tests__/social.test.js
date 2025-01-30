const request = require('supertest');
const { MongoClient, ObjectId } = require('mongodb');
const app = require('../index');

describe('Social Features', () => {
  let connection;
  let db;
  let testUserId;
  let testToken;
  let testRecipeId;

  beforeAll(async () => {
    connection = await MongoClient.connect(process.env.MONGODB_URI);
    db = connection.db(process.env.MONGODB_DB);
    testUserId = await createTestUser();
    testToken = generateTestToken(testUserId);

    // Create a test recipe
    const result = await db.collection('recipes').insertOne({
      title: 'Test Recipe',
      description: 'Test Description',
      ingredients: [{ name: 'Test Ingredient', amount: 100, unit: 'gram' }],
      instructions: ['Test Step'],
      userId: testUserId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    testRecipeId = result.insertedId;
  });

  afterAll(async () => {
    await connection.close();
  });

  describe('Likes', () => {
    it('should like a recipe successfully', async () => {
      const response = await request(app)
        .post(`/api/social/recipes/${testRecipeId}/like`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.liked).toBe(true);

      // Verify like in database
      const like = await db.collection('likes').findOne({
        recipeId: testRecipeId,
        userId: testUserId
      });
      expect(like).not.toBeNull();
    });

    it('should unlike a previously liked recipe', async () => {
      // First like the recipe
      await db.collection('likes').insertOne({
        recipeId: testRecipeId,
        userId: testUserId,
        createdAt: new Date()
      });

      const response = await request(app)
        .post(`/api/social/recipes/${testRecipeId}/like`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.liked).toBe(false);

      // Verify like is removed from database
      const like = await db.collection('likes').findOne({
        recipeId: testRecipeId,
        userId: testUserId
      });
      expect(like).toBeNull();
    });

    it('should get recipe likes count', async () => {
      // Add some likes
      await db.collection('likes').insertMany([
        { recipeId: testRecipeId, userId: new ObjectId(), createdAt: new Date() },
        { recipeId: testRecipeId, userId: new ObjectId(), createdAt: new Date() }
      ]);

      const response = await request(app)
        .get(`/api/social/recipes/${testRecipeId}/likes`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBe(2);
    });
  });

  describe('Comments', () => {
    it('should add a comment successfully', async () => {
      const comment = { content: 'Test comment' };
      const response = await request(app)
        .post(`/api/social/recipes/${testRecipeId}/comments`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(comment);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe(comment.content);
      expect(response.body.data.userId).toBe(testUserId.toString());

      // Verify comment in database
      const savedComment = await db.collection('comments').findOne({
        recipeId: testRecipeId,
        userId: testUserId
      });
      expect(savedComment).not.toBeNull();
      expect(savedComment.content).toBe(comment.content);
    });

    it('should get recipe comments', async () => {
      // Add some comments
      await db.collection('comments').insertMany([
        {
          recipeId: testRecipeId,
          userId: testUserId,
          content: 'Comment 1',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          recipeId: testRecipeId,
          userId: testUserId,
          content: 'Comment 2',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);

      const response = await request(app)
        .get(`/api/social/recipes/${testRecipeId}/comments`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('user');
      expect(response.body.data[0].user).toHaveProperty('name');
    });

    it('should validate comment content', async () => {
      const response = await request(app)
        .post(`/api/social/recipes/${testRecipeId}/comments`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ content: '' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('Following', () => {
    let otherUserId;

    beforeEach(async () => {
      // Create another user to follow
      const result = await db.collection('users').insertOne({
        email: 'other@example.com',
        password: 'hashedpassword123',
        name: 'Other User',
        role: 'user',
        createdAt: new Date()
      });
      otherUserId = result.insertedId;
    });

    it('should follow a user successfully', async () => {
      const response = await request(app)
        .post(`/api/social/users/${otherUserId}/follow`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.following).toBe(true);

      // Verify following relationship in database
      const following = await db.collection('followers').findOne({
        followerId: testUserId,
        followingId: otherUserId
      });
      expect(following).not.toBeNull();
    });

    it('should unfollow a previously followed user', async () => {
      // First follow the user
      await db.collection('followers').insertOne({
        followerId: testUserId,
        followingId: otherUserId,
        createdAt: new Date()
      });

      const response = await request(app)
        .post(`/api/social/users/${otherUserId}/follow`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.following).toBe(false);

      // Verify following relationship is removed
      const following = await db.collection('followers').findOne({
        followerId: testUserId,
        followingId: otherUserId
      });
      expect(following).toBeNull();
    });

    it('should not allow following yourself', async () => {
      const response = await request(app)
        .post(`/api/social/users/${testUserId}/follow`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('You cannot follow yourself');
    });

    it('should get user followers', async () => {
      // Add some followers
      await db.collection('followers').insertMany([
        {
          followerId: new ObjectId(),
          followingId: testUserId,
          createdAt: new Date()
        },
        {
          followerId: new ObjectId(),
          followingId: testUserId,
          createdAt: new Date()
        }
      ]);

      const response = await request(app)
        .get(`/api/social/users/${testUserId}/followers`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should get users being followed', async () => {
      // Add some following relationships
      await db.collection('followers').insertMany([
        {
          followerId: testUserId,
          followingId: new ObjectId(),
          createdAt: new Date()
        },
        {
          followerId: testUserId,
          followingId: new ObjectId(),
          createdAt: new Date()
        }
      ]);

      const response = await request(app)
        .get(`/api/social/users/${testUserId}/following`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });
}); 