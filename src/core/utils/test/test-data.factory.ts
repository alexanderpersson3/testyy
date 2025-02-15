import { ObjectId } from 'mongodb';
import type { UserDocument, UserPreferences, UserProfile, UserStats } from '../../repositories/user.repository.js';
import type { RecipeDocument } from '../../repositories/recipe.repository.js';
import type { CommentDocument } from '../../repositories/comment.repository.js';
import type { CollectionDocument } from '../../repositories/collection.repository.js';
import { MongoTestUtils } from './mongodb.test.utils.js';

/**
 * Default test user preferences
 */
const defaultUserPreferences: UserPreferences = {
  language: 'en',
  theme: 'light',
  notifications: true,
  emailNotifications: true,
  timezone: 'UTC'
};

/**
 * Default test user stats
 */
const defaultUserStats: UserStats = {
  recipesCreated: 0,
  recipesLiked: 0,
  recipesSaved: 0,
  commentsPosted: 0,
  ratingsGiven: 0,
  collectionsCreated: 0
};

/**
 * Default test user profile
 */
const defaultUserProfile: UserProfile = {
  name: 'Test User',
  bio: 'Test bio',
  location: 'Test location'
};

/**
 * User test data factory
 */
export const createTestUser = (
  overrides: Partial<Omit<UserDocument, '_id' | 'createdAt' | 'updatedAt'>> = {}
): Omit<UserDocument, '_id' | 'createdAt' | 'updatedAt'> => ({
  email: `test-${Date.now()}@example.com`,
  username: `testuser-${Date.now()}`,
  hashedPassword: 'hashedTestPassword123',
  role: 'user',
  preferences: { ...defaultUserPreferences },
  stats: { ...defaultUserStats },
  profile: { ...defaultUserProfile },
  isVerified: true,
  isActive: true,
  twoFactorEnabled: false,
  loginAttempts: 0,
  ...overrides
});

/**
 * Recipe test data factory
 */
export const createTestRecipe = (
  authorId: ObjectId,
  authorName: string = 'Test Author',
  overrides: Partial<Omit<RecipeDocument, '_id' | 'createdAt' | 'updatedAt'>> = {}
): Omit<RecipeDocument, '_id' | 'createdAt' | 'updatedAt'> => ({
  title: `Test Recipe ${Date.now()}`,
  description: 'A test recipe description',
  ingredients: [
    { name: 'Test Ingredient 1', amount: 1, unit: 'cup' },
    { name: 'Test Ingredient 2', amount: 2, unit: 'tablespoon' }
  ],
  instructions: [
    { step: 1, text: 'Test instruction step 1' },
    { step: 2, text: 'Test instruction step 2' }
  ],
  prepTime: 15,
  cookTime: 30,
  servings: 4,
  difficulty: 'medium',
  cuisine: 'italian',
  tags: ['test', 'recipe'],
  images: [],
  author: {
    _id: authorId,
    name: authorName
  },
  ratings: {
    average: 0,
    count: 0,
    total: 0
  },
  ...overrides
});

/**
 * Comment test data factory
 */
export const createTestComment = (
  authorId: ObjectId,
  authorName: string,
  recipeId: ObjectId,
  parentId?: ObjectId,
  overrides: Partial<Omit<CommentDocument, '_id' | 'createdAt' | 'updatedAt'>> = {}
): Omit<CommentDocument, '_id' | 'createdAt' | 'updatedAt'> => ({
  content: `Test comment ${Date.now()}`,
  author: {
    _id: authorId,
    name: authorName
  },
  recipeId,
  parentId,
  status: 'active',
  votes: {
    upvotes: 0,
    downvotes: 0,
    total: 0,
    voters: []
  },
  edited: false,
  replyCount: 0,
  ...overrides
});

/**
 * Collection test data factory
 */
export const createTestCollection = (
  ownerId: ObjectId,
  ownerName: string,
  overrides: Partial<Omit<CollectionDocument, '_id' | 'createdAt' | 'updatedAt'>> = {}
): Omit<CollectionDocument, '_id' | 'createdAt' | 'updatedAt'> => ({
  name: `Test Collection ${Date.now()}`,
  description: 'A test collection description',
  owner: {
    _id: ownerId,
    name: ownerName
  },
  recipes: [],
  collaborators: [],
  privacy: 'private',
  tags: ['test', 'collection'],
  stats: {
    recipeCount: 0,
    totalCookTime: 0,
    averageDifficulty: 0,
    cuisineDistribution: {},
    lastUpdated: new Date()
  },
  settings: {
    allowComments: true,
    showIngredients: true,
    showNutrition: true,
    defaultSort: 'manual'
  },
  lastActivityAt: new Date(),
  ...overrides
});

/**
 * Test data factories for repositories
 */
export const TestDataFactory = {
  /**
   * Create and save test users
   */
  users: {
    createOne: (overrides?: Partial<Omit<UserDocument, '_id' | 'createdAt' | 'updatedAt'>>) =>
      MongoTestUtils.createTestDocument(createTestUser(overrides)),

    createMany: (count: number, baseOverrides?: Partial<Omit<UserDocument, '_id' | 'createdAt' | 'updatedAt'>>) =>
      MongoTestUtils.createTestDataFactory<UserDocument>().createMany(count, createTestUser(baseOverrides)),

    saveOne: async (overrides?: Partial<Omit<UserDocument, '_id' | 'createdAt' | 'updatedAt'>>) =>
      (await MongoTestUtils.createTestDocuments('users', [createTestUser(overrides)]))[0],

    saveMany: async (count: number, baseOverrides?: Partial<Omit<UserDocument, '_id' | 'createdAt' | 'updatedAt'>>) =>
      MongoTestUtils.createTestDocuments(
        'users',
        Array.from({ length: count }, () => createTestUser(baseOverrides))
      )
  },

  /**
   * Create and save test recipes
   */
  recipes: {
    createOne: (authorId: ObjectId, authorName?: string, overrides?: Partial<Omit<RecipeDocument, '_id' | 'createdAt' | 'updatedAt'>>) =>
      MongoTestUtils.createTestDocument(createTestRecipe(authorId, authorName, overrides)),

    createMany: (
      count: number,
      authorId: ObjectId,
      authorName?: string,
      baseOverrides?: Partial<Omit<RecipeDocument, '_id' | 'createdAt' | 'updatedAt'>>
    ) =>
      MongoTestUtils.createTestDataFactory<RecipeDocument>().createMany(
        count,
        createTestRecipe(authorId, authorName, baseOverrides)
      ),

    saveOne: async (authorId: ObjectId, authorName?: string, overrides?: Partial<Omit<RecipeDocument, '_id' | 'createdAt' | 'updatedAt'>>) =>
      (await MongoTestUtils.createTestDocuments('recipes', [createTestRecipe(authorId, authorName, overrides)]))[0],

    saveMany: async (
      count: number,
      authorId: ObjectId,
      authorName?: string,
      baseOverrides?: Partial<Omit<RecipeDocument, '_id' | 'createdAt' | 'updatedAt'>>
    ) =>
      MongoTestUtils.createTestDocuments(
        'recipes',
        Array.from({ length: count }, () => createTestRecipe(authorId, authorName, baseOverrides))
      )
  },

  /**
   * Create and save test comments
   */
  comments: {
    createOne: (
      authorId: ObjectId,
      authorName: string,
      recipeId: ObjectId,
      parentId?: ObjectId,
      overrides?: Partial<Omit<CommentDocument, '_id' | 'createdAt' | 'updatedAt'>>
    ) =>
      MongoTestUtils.createTestDocument(createTestComment(authorId, authorName, recipeId, parentId, overrides)),

    createMany: (
      count: number,
      authorId: ObjectId,
      authorName: string,
      recipeId: ObjectId,
      parentId?: ObjectId,
      baseOverrides?: Partial<Omit<CommentDocument, '_id' | 'createdAt' | 'updatedAt'>>
    ) =>
      MongoTestUtils.createTestDataFactory<CommentDocument>().createMany(
        count,
        createTestComment(authorId, authorName, recipeId, parentId, baseOverrides)
      ),

    saveOne: async (
      authorId: ObjectId,
      authorName: string,
      recipeId: ObjectId,
      parentId?: ObjectId,
      overrides?: Partial<Omit<CommentDocument, '_id' | 'createdAt' | 'updatedAt'>>
    ) =>
      (await MongoTestUtils.createTestDocuments('comments', [
        createTestComment(authorId, authorName, recipeId, parentId, overrides)
      ]))[0],

    saveMany: async (
      count: number,
      authorId: ObjectId,
      authorName: string,
      recipeId: ObjectId,
      parentId?: ObjectId,
      baseOverrides?: Partial<Omit<CommentDocument, '_id' | 'createdAt' | 'updatedAt'>>
    ) =>
      MongoTestUtils.createTestDocuments(
        'comments',
        Array.from({ length: count }, () =>
          createTestComment(authorId, authorName, recipeId, parentId, baseOverrides)
        )
      )
  },

  /**
   * Create and save test collections
   */
  collections: {
    createOne: (
      ownerId: ObjectId,
      ownerName: string,
      overrides?: Partial<Omit<CollectionDocument, '_id' | 'createdAt' | 'updatedAt'>>
    ) =>
      MongoTestUtils.createTestDocument(createTestCollection(ownerId, ownerName, overrides)),

    createMany: (
      count: number,
      ownerId: ObjectId,
      ownerName: string,
      baseOverrides?: Partial<Omit<CollectionDocument, '_id' | 'createdAt' | 'updatedAt'>>
    ) =>
      MongoTestUtils.createTestDataFactory<CollectionDocument>().createMany(
        count,
        createTestCollection(ownerId, ownerName, baseOverrides)
      ),

    saveOne: async (
      ownerId: ObjectId,
      ownerName: string,
      overrides?: Partial<Omit<CollectionDocument, '_id' | 'createdAt' | 'updatedAt'>>
    ) =>
      (await MongoTestUtils.createTestDocuments('collections', [
        createTestCollection(ownerId, ownerName, overrides)
      ]))[0],

    saveMany: async (
      count: number,
      ownerId: ObjectId,
      ownerName: string,
      baseOverrides?: Partial<Omit<CollectionDocument, '_id' | 'createdAt' | 'updatedAt'>>
    ) =>
      MongoTestUtils.createTestDocuments(
        'collections',
        Array.from({ length: count }, () =>
          createTestCollection(ownerId, ownerName, baseOverrides)
        )
      )
  }
}; 