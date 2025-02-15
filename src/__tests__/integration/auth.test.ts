import { testRequest, generateTestToken, authHeader } from './setup';
import { userFixtures } from '../fixtures/users.fixture';
import { getDb } from '../../core/database/database.service';

describe('Auth API', () => {
  const db = getDb();
  const usersCollection = db.collection('users');

  beforeEach(async () => {
    await usersCollection.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'Password123!',
        displayName: 'New User'
      };

      const response = await testRequest
        .post('/api/auth/register')
        .send(newUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        username: newUser.username,
        email: newUser.email,
        displayName: newUser.displayName
      });
    });

    it('should return 400 if username is taken', async () => {
      await usersCollection.insertOne(userFixtures.regularUser);

      const newUser = {
        username: userFixtures.regularUser.username,
        email: 'different@example.com',
        password: 'Password123!',
        displayName: 'New User'
      };

      const response = await testRequest
        .post('/api/auth/register')
        .send(newUser);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await usersCollection.insertOne(userFixtures.regularUser);
    });

    it('should login successfully with correct credentials', async () => {
      const credentials = {
        email: userFixtures.regularUser.email,
        password: 'correctpassword'
      };

      const response = await testRequest
        .post('/api/auth/login')
        .send(credentials);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        username: userFixtures.regularUser.username,
        email: userFixtures.regularUser.email
      });
    });

    it('should return 401 with incorrect password', async () => {
      const credentials = {
        email: userFixtures.regularUser.email,
        password: 'wrongpassword'
      };

      const response = await testRequest
        .post('/api/auth/login')
        .send(credentials);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    beforeEach(async () => {
      await usersCollection.insertOne(userFixtures.regularUser);
    });

    it('should return user profile with valid token', async () => {
      const token = generateTestToken();

      const response = await testRequest
        .get('/api/auth/me')
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        username: userFixtures.regularUser.username,
        email: userFixtures.regularUser.email
      });
    });

    it('should return 401 without token', async () => {
      const response = await testRequest
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
}); 