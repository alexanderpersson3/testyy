import { ObjectId } from 'mongodb';
import type { Recipe, User, ShoppingList, Store } from '../features';

export const createTestUser = (overrides: Partial<User> = {}): User => ({
  _id: new ObjectId(),
  username: 'testuser',
  email: 'test@example.com',
  password: 'hashedpassword',
  displayName: 'Test User',
  createdAt: new Date(),
  updatedAt: new Date(),
  preferences: {
    cuisine: [],
    dietaryRestrictions: [],
    cookingLevel: 'BEGINNER',
    servingSize: 2,
    measurementSystem: 'METRIC',
  },
  ...overrides,
});

export const createTestRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  _id: new ObjectId(),
  userId: new ObjectId(),
  title: 'Test Recipe',
  description: 'A test recipe',
  ingredients: [],
  instructions: [],
  prepTime: 15,
  cookTime: 30,
  servings: 4,
  difficulty: 'EASY',
  cuisine: 'ITALIAN',
  tags: ['test'],
  isPublished: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  stats: {
    rating: 0,
    ratingCount: 0,
    favoriteCount: 0,
    viewCount: 0,
  },
  ...overrides,
});

export const createTestShoppingList = (overrides: Partial<ShoppingList> = {}): ShoppingList => ({
  _id: new ObjectId(),
  userId: new ObjectId(),
  name: 'Test Shopping List',
  items: [],
  isDefault: false,
  status: 'active',
  lastModified: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createTestStore = (overrides: Partial<Store> = {}): Store => ({
  _id: new ObjectId(),
  name: 'Test Store',
  location: {
    address: '123 Test St',
    city: 'Test City',
    state: 'Test State',
    country: 'Test Country',
    postalCode: '12345',
  },
  operatingHours: {
    monday: { open: '09:00', close: '18:00' },
  },
  contact: {},
  ratings: {
    average: 0,
    count: 0,
  },
  features: [],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const expectDatesEqual = (date1: Date, date2: Date) => {
  expect(date1.getTime()).toBe(date2.getTime());
};

export const expectObjectIdsEqual = (id1: ObjectId, id2: ObjectId) => {
  expect(id1.toString()).toBe(id2.toString());
}; 