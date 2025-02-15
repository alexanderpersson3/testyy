import { ObjectId } from 'mongodb';
import { databaseService } from '../../core/database/database.service';
import { testRequest } from '../integration/setup';
import { userFixtures } from '../fixtures/users.fixture';

// Database cleanup helpers
export const cleanupCollections = async (...collections: string[]) => {
  const db = databaseService.getDb();
  await Promise.all(
    collections.map(collection => db.collection(collection).deleteMany({}))
  );
};

export const cleanupDatabase = async () => {
  const db = databaseService.getDb();
  const collections = await db.collections();
  await Promise.all(
    collections.map(collection => collection.deleteMany({}))
  );
};

// Authentication helpers
export const loginUser = async (email: string, password: string) => {
  const response = await testRequest
    .post('/api/auth/login')
    .send({ email, password });
  return response.body.token;
};

export const registerUser = async (userData: {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}) => {
  const response = await testRequest
    .post('/api/auth/register')
    .send(userData);
  return response.body;
};

// Request validation helpers
export const expectValidationError = (response: any, field?: string) => {
  expect(response.status).toBe(400);
  expect(response.body).toHaveProperty('status', 'error');
  expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
  if (field) {
    expect(response.body.errors).toContainEqual(
      expect.objectContaining({ field })
    );
  }
};

export const expectAuthenticationError = (response: any) => {
  expect(response.status).toBe(401);
  expect(response.body).toHaveProperty('status', 'error');
  expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
};

export const expectNotFoundError = (response: any, message?: string) => {
  expect(response.status).toBe(404);
  expect(response.body).toHaveProperty('status', 'error');
  expect(response.body).toHaveProperty('code', 'NOT_FOUND');
  if (message) {
    expect(response.body).toHaveProperty('message', message);
  }
};

// Response assertion helpers
export const expectSuccessResponse = (response: any, status = 200) => {
  expect(response.status).toBe(status);
  if (status !== 204) {
    expect(response.body).toBeDefined();
  }
};

export const expectPaginatedResponse = (response: any, {
  page,
  limit,
  totalItems,
  totalPages
}: {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}) => {
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('pagination');
  expect(response.body.pagination).toMatchObject({
    page,
    limit,
    totalItems,
    totalPages
  });
};

// Data creation helpers
export const createTestData = async (collection: string, data: any) => {
  const db = databaseService.getDb();
  const result = await db.collection(collection).insertOne({
    _id: new ObjectId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...data
  });
  return result.insertedId;
};

export const createTestDataBulk = async (collection: string, data: any[]) => {
  const db = databaseService.getDb();
  const docs = data.map(item => ({
    _id: new ObjectId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...item
  }));
  const result = await db.collection(collection).insertMany(docs);
  return Object.values(result.insertedIds);
};

// Mock data helpers
export const mockObjectId = () => new ObjectId();

export const mockDate = (isoDate: string = '2023-01-01T00:00:00.000Z') => 
  new Date(isoDate);

// Test user helpers
export const createTestUser = async (overrides = {}) => {
  const userData = {
    ...userFixtures.regularUser,
    _id: new ObjectId(),
    ...overrides
  };
  const db = databaseService.getDb();
  await db.collection('users').insertOne(userData);
  return userData;
};

export const createTestUserAndLogin = async (overrides = {}) => {
  const user = await createTestUser(overrides);
  const token = await loginUser(user.email, 'correctpassword');
  return { user, token };
}; 