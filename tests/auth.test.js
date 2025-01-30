import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import { getDb } from '../config/db.js';
import { createStructuredLog } from '../config/cloud.js';
import bcrypt from 'bcryptjs';
import { MongoClient, ObjectId } from 'mongodb';
import { connect } from '../db.js';

describe('Authentication & Authorization Tests', () => {
  let db;
  let testUser;
  let adminUser;
  let expiredToken;
  let validToken;
  let adminToken;

  beforeAll(async () => {
    db = await connect();
    await db.collection('users').deleteMany({});
    
    // Create a test user
    const hashedPassword = await bcrypt.hash('testPassword123', 10);
    testUser = await db.collection('users').insertOne({
      email: 'test@example.com',
      password: hashedPassword,
      username: 'testuser',
      isVerified: true,
      createdAt: new Date()
    });

    // Create admin user
    adminUser = await db.collection('users').insertOne({
      email: 'admin@example.com',
      username: 'admin',
      passwordHash: '$2b$10$test',
      role: 'admin'
    });

    // Create tokens
    expiredToken = jwt.sign(
      { userId: testUser._id },
      process.env.JWT_SECRET,
      { expiresIn: '0s' }
    );

    validToken = jwt.sign(
      { userId: testUser._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { userId: adminUser.insertedId.toString(), role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await db.collection('users').deleteMany({});
    await db.close();
  });

  describe('Login Flow', () => {
    it('should return 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid', password: 'test123' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 401 for non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'test123' });
      
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('should return token for valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'testPassword123' });
      
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });
  });

  describe('Token Validation', () => {
    it('should reject requests without token', async () => {
      const res = await request(app).get('/api/user/profile');
      expect(res.status).toBe(401);
    });

    it('should reject expired tokens', async () => {
      const res = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${expiredToken}`);
      
      expect(res.status).toBe(401);
    });

    it('should accept valid tokens', async () => {
      const res = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(res.status).toBe(200);
    });
  });

  describe('Role-Based Access Control', () => {
    it('should deny admin routes to normal users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(res.status).toBe(403);
    });

    it('should allow admin routes to admin users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
    });

    it('should prevent role escalation attempts', async () => {
      const res = await request(app)
        .post('/api/user/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ role: 'admin' });
      
      expect(res.status).toBe(400);
    });
  });

  describe('Token Refresh', () => {
    it('should issue new token with valid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: validToken });
      
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('should reject invalid refresh tokens', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid' });
      
      expect(res.status).toBe(401);
    });
  });

  describe('Session Management', () => {
    it('should invalidate all sessions on password change', async () => {
      // Change password
      await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ 
          currentPassword: 'testPassword123',
          newPassword: 'newtestPassword123'
        });

      // Try to use old token
      const res = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(res.status).toBe(401);
    });

    it('should handle concurrent sessions correctly', async () => {
      const token1 = jwt.sign(
        { userId: testUser._id, sessionId: '1' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const token2 = jwt.sign(
        { userId: testUser._id, sessionId: '2' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const [res1, res2] = await Promise.all([
        request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${token1}`),
        request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${token2}`)
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'newuser@example.com',
          username: 'newuser',
          password: 'Password123!'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('userId');
      expect(res.body).toHaveProperty('message', 'User registered successfully');
    });

    it('should not allow registration with existing email', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          username: 'anotheruser',
          password: 'Password123!'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Email already exists');
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testPassword123'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('userId');
    });

    it('should not login with incorrect password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });
  });

  describe('POST /auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      const token = 'valid-verification-token';
      const user = await db.collection('users').insertOne({
        email: 'unverified@example.com',
        username: 'unverified',
        password: await bcrypt.hash('password123', 10),
        verificationToken: token,
        isVerified: false
      });

      const res = await request(app)
        .post('/auth/verify-email')
        .send({ token });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Email verified successfully');

      const updatedUser = await db.collection('users').findOne({ _id: user.insertedId });
      expect(updatedUser.isVerified).toBe(true);
      expect(updatedUser.verificationToken).toBeUndefined();
    });

    it('should not verify email with invalid token', async () => {
      const res = await request(app)
        .post('/auth/verify-email')
        .send({ token: 'invalid-token' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid verification token');
    });
  });
}); 