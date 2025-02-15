import { ObjectId } from 'mongodb';

export const userFixtures = {
  regularUser: {
    _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4567'),
    username: 'testuser',
    email: 'test@example.com',
    password: '$2b$10$abcdefghijklmnopqrstuvwxyz123456789',
    displayName: 'Test User',
    bio: 'A test user',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    preferences: {
      cuisine: ['ITALIAN', 'MEXICAN'],
      dietaryRestrictions: ['VEGETARIAN'],
      cookingLevel: 'INTERMEDIATE',
      servingSize: 4,
      measurementSystem: 'METRIC'
    }
  },
  adminUser: {
    _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4568'),
    username: 'admin',
    email: 'admin@example.com',
    password: '$2b$10$abcdefghijklmnopqrstuvwxyz123456789',
    displayName: 'Admin User',
    role: 'ADMIN',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01')
  },
  premiumUser: {
    _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4569'),
    username: 'premium',
    email: 'premium@example.com',
    password: '$2b$10$abcdefghijklmnopqrstuvwxyz123456789',
    displayName: 'Premium User',
    role: 'PREMIUM',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    subscription: {
      plan: 'PREMIUM',
      validUntil: new Date('2024-01-01')
    }
  }
}; 