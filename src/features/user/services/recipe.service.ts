import type { Collection } from 'mongodb';
import { ObjectId } from 'mongodb';
import type { 
  Recipe,
  CreateRecipeDTO,
  UpdateRecipeDTO,
  RecipeSearchQuery,
  RecipeLike,
  RecipeReport,
  RecipeMedia,
  RecipeReview
} from '../types/recipe.js';
import type {
  MongoFilter,
  MongoUpdate,
  MongoFindOptions,
  ModifyResult
} from '../types/mongodb.js';
import {
  MongoNotFoundError,
  MongoValidationError,
  MongoWriteError,
  MongoQueryError
} from '../types/mongodb-errors.js';
import { ValidationError } from '../types/validation-errors.js';
import { isMongoDocument, isObjectId } from '../types/mongodb.js';
import { DatabaseService } from '../db/database.service.js';
import { WebSocketService } from '../services/websocket.service.js';
import logger from '../utils/logger.js';

/**
 * Interface defining the core functionality of the Recipe service.
 * Handles all recipe-related operations including CRUD, search, and social interactions.
 */
export interface RecipeServiceInterface {
  /**
   * Creates a new recipe in the database.
   * @param input - The recipe data to create
   * @returns The created recipe document
   * @throws {ValidationError} If the recipe data is invalid
   * @throws {MongoWriteError} If the database operation fails
   */
  createRecipe(input: CreateRecipeDTO): Promise<Recipe>;

  /**
   * Retrieves a recipe by its ID.
   * @param recipeId - The ObjectId of the recipe to retrieve
   * @returns The recipe document if found
   * @throws {MongoNotFoundError} If the recipe doesn't exist
   * @throws {MongoQueryError} If the database operation fails
   */
  getRecipe(recipeId: ObjectId): Promise<Recipe>;

  /**
   * Retrieves multiple recipes by their IDs.
   * @param recipeIds - Array of recipe ObjectIds to retrieve
   * @returns Array of found recipe documents
   * @throws {MongoQueryError} If the database operation fails
   */
  getRecipes(recipeIds: ObjectId[]): Promise<Recipe[]>;

  /**
   * Updates an existing recipe.
   * @param recipeId - The ObjectId of the recipe to update
   * @param update - The update data for the recipe
   * @returns The updated recipe document
   * @throws {MongoNotFoundError} If the recipe doesn't exist
   * @throws {ValidationError} If the update data is invalid
   * @throws {MongoWriteError} If the database operation fails
   */
  updateRecipe(recipeId: ObjectId, update: UpdateRecipeDTO): Promise<Recipe>;

  /**
   * Deletes a recipe from the database.
   * @param recipeId - The ObjectId of the recipe to delete
   * @returns True if the recipe was deleted successfully
   * @throws {MongoNotFoundError} If the recipe doesn't exist
   * @throws {MongoWriteError} If the database operation fails
   */
  deleteRecipe(recipeId: ObjectId): Promise<boolean>;

  /**
   * Searches for recipes based on various criteria.
   * @param query - The search parameters
   * @returns Array of matching recipe documents
   * @throws {MongoQueryError} If the database operation fails
   */
  searchRecipes(query: RecipeSearchQuery): Promise<Recipe[]>;

  /**
   * Updates the rating of a recipe.
   * @param recipeId - The ObjectId of the recipe to update
   * @param rating - The new rating value (1-5)
   * @throws {ValidationError} If the rating is invalid
   * @throws {MongoWriteError} If the database operation fails
   */
  updateRating(recipeId: ObjectId, rating: number): Promise<void>;

  /**
   * Retrieves all recipes by a specific author.
   * @param authorId - The ObjectId of the author
   * @returns Array of recipe documents
   * @throws {MongoQueryError} If the database operation fails
   */
  getRecipesByAuthor(authorId: ObjectId): Promise<Recipe[]>;

  /**
   * Retrieves recipes that match specific tags.
   * @param tags - Array of tag strings to match
   * @returns Array of matching recipe documents
   * @throws {MongoQueryError} If the database operation fails
   */
  getRecipesByTags(tags: string[]): Promise<Recipe[]>;

  /**
   * Retrieves the most popular recipes.
   * @param limit - Maximum number of recipes to return
   * @returns Array of popular recipe documents
   * @throws {MongoQueryError} If the database operation fails
   */
  getPopularRecipes(limit?: number): Promise<Recipe[]>;

  /**
   * Finds a recipe by its exact title.
   * @param title - The title to search for
   * @returns The matching recipe document or null if not found
   * @throws {MongoQueryError} If the database operation fails
   */
  findRecipeByTitle(title: string): Promise<Recipe | null>;

  /**
   * Toggles a user's like status for a recipe.
   * @param recipeId - The ObjectId of the recipe
   * @param userId - The ObjectId of the user
   * @returns True if the recipe is now liked, false if unliked
   * @throws {MongoWriteError} If the database operation fails
   */
  toggleLike(recipeId: ObjectId, userId: ObjectId): Promise<boolean>;

  /**
   * Retrieves likes for a recipe with optional user details.
   * @param recipeId - The ObjectId of the recipe
   * @param options - Optional parameters for pagination and user inclusion
   * @returns Object containing likes array and total count
   * @throws {MongoQueryError} If the database operation fails
   */
  getRecipeLikes(
    recipeId: ObjectId,
    options?: {
      page?: number;
      limit?: number;
      includeUser?: boolean;
      excludeFields?: string[];
    }
  ): Promise<{
    likes: Array<RecipeLike & { user?: { _id: ObjectId; name: string } }>;
    total: number;
  }>;

  /**
   * Reports a recipe for inappropriate content or copyright violation.
   * @param recipeId - The ObjectId of the recipe to report
   * @param userId - The ObjectId of the user making the report
   * @param report - The report details
   * @throws {ValidationError} If the report data is invalid
   * @throws {MongoWriteError} If the database operation fails
   */
  reportRecipe(
    recipeId: ObjectId,
    userId: ObjectId,
    report: {
      reason: 'inappropriate' | 'copyright' | 'spam' | 'other';
      description?: string;
    }
  ): Promise<void>;
}

/**
 * Implementation of the Recipe service.
 * Handles all recipe-related operations using MongoDB for storage.
 */
export class RecipeService implements RecipeServiceInterface {
  private static instance: RecipeService;
  private initialized: boolean = false;
  private db: DatabaseService;
  private recipesCollection!: Collection<Recipe>;
  private likesCollection!: Collection<RecipeLike>;
  private reportsCollection!: Collection<RecipeReport>;
  private wsService: WebSocketService;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.wsService = WebSocketService.getInstance();
    this.initialize().catch(error => {
      logger.error('Failed to initialize RecipeService:', error);
    });
  }

  /**
   * Gets the singleton instance of RecipeService.
   * @returns The RecipeService instance
   */
  public static getInstance(): RecipeService {
    if (!RecipeService.instance) {
      RecipeService.instance = new RecipeService();
    }
    return RecipeService.instance;
  }

  /**
   * Initializes the service by setting up database collections.
   * @private
   * @throws {MongoQueryError} If database initialization fails
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.db.connect();
      this.recipesCollection = this.db.getCollection<Recipe>('recipes');
      this.likesCollection = this.db.getCollection<RecipeLike>('recipe_likes');
      this.reportsCollection = this.db.getCollection<RecipeReport>('recipe_reports');
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize RecipeService:', error);
      throw new MongoQueryError('Failed to initialize RecipeService', error);
    }
  }

  /**
   * Ensures the service is initialized before performing operations.
   * @private
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async createRecipe(input: CreateRecipeDTO): Promise<Recipe> {
    try {
      await this.ensureInitialized();

      const now = new Date();
      const recipe: Recipe = {
        _id: new ObjectId(),
        ...input,
        createdAt: now,
        updatedAt: now
      };

      const result = await this.recipesCollection.insertOne(recipe);
      if (!result.acknowledged) {
        throw new MongoWriteError('Failed to create recipe');
      }

      this.wsService.broadcast('recipe:created', recipe);
      return recipe;
    } catch (error) {
      if (error instanceof MongoWriteError) throw error;
      logger.error('Failed to create recipe:', error);
      throw new MongoWriteError('Failed to create recipe', error);
    }
  }

  async getRecipe(recipeId: ObjectId): Promise<Recipe> {
    try {
      await this.ensureInitialized();

      if (!isObjectId(recipeId)) {
        throw new ValidationError('Invalid recipe ID format');
      }

      const recipe = await this.recipesCollection.findOne({ _id: recipeId });
      if (!recipe) {
        throw new MongoNotFoundError('Recipe not found');
      }

      return recipe;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      if (error instanceof MongoNotFoundError) throw error;
      logger.error('Failed to get recipe:', error);
      throw new MongoQueryError('Failed to get recipe', error);
    }
  }

  async getRecipes(recipeIds: ObjectId[]): Promise<Recipe[]> {
    try {
      await this.ensureInitialized();

      if (!recipeIds.every(isObjectId)) {
        throw new ValidationError('Invalid recipe ID format in array');
      }

      const filter: MongoFilter<Recipe> = { _id: { $in: recipeIds } };
      return this.recipesCollection.find(filter).toArray();
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      logger.error('Failed to get recipes:', error);
      throw new MongoQueryError('Failed to get recipes', error);
    }
  }

  async updateRecipe(recipeId: ObjectId, update: UpdateRecipeDTO): Promise<Recipe> {
    try {
      await this.ensureInitialized();

      if (!isObjectId(recipeId)) {
        throw new ValidationError('Invalid recipe ID format');
      }

      const mongoUpdate: MongoUpdate<Recipe> = {
        $set: {
          ...update,
          updatedAt: new Date()
        }
      };

      const result = await this.recipesCollection.findOneAndUpdate(
        { _id: recipeId },
        mongoUpdate,
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new MongoNotFoundError('Recipe not found');
      }

      const updatedRecipe = result.value;
      if (!isMongoDocument(updatedRecipe)) {
        throw new MongoWriteError('Invalid document returned from database');
      }

      this.wsService.broadcast('recipe:updated', { recipeId, update: updatedRecipe });
      return updatedRecipe;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      if (error instanceof MongoNotFoundError) throw error;
      if (error instanceof MongoWriteError) throw error;
      logger.error('Failed to update recipe:', error);
      throw new MongoWriteError('Failed to update recipe', error);
    }
  }

  async deleteRecipe(recipeId: ObjectId): Promise<boolean> {
    try {
      await this.ensureInitialized();

      if (!isObjectId(recipeId)) {
        throw new ValidationError('Invalid recipe ID format');
      }

      const result = await this.recipesCollection.deleteOne({ _id: recipeId });
      if (result.deletedCount === 0) {
        throw new MongoNotFoundError('Recipe not found');
      }

      this.wsService.broadcast('recipe:deleted', { recipeId });
      return true;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      if (error instanceof MongoNotFoundError) throw error;
      logger.error('Failed to delete recipe:', error);
      throw new MongoWriteError('Failed to delete recipe', error);
    }
  }

  async searchRecipes(query: RecipeSearchQuery): Promise<Recipe[]> {
    try {
      await this.ensureInitialized();

      const filter: MongoFilter<Recipe> = {};
      const options: MongoFindOptions<Recipe> = {
        limit: query.limit || 20,
        skip: query.offset || 0,
        sort: { [query.sortBy || 'createdAt']: -1 }
      };

      if (query.text) {
        filter.$text = { $search: query.text };
      }
      if (query.cuisine) {
        filter.cuisine = query.cuisine;
      }
      if (query.difficulty) {
        filter.difficulty = query.difficulty;
      }
      if (query.tags?.length) {
        filter.tags = { $all: query.tags };
      }

      return this.recipesCollection.find(filter, options).toArray();
    } catch (error) {
      logger.error('Failed to search recipes:', error);
      throw new MongoQueryError('Failed to search recipes', error);
    }
  }

  async updateRating(recipeId: ObjectId, rating: number): Promise<void> {
    try {
      await this.ensureInitialized();

      if (!isObjectId(recipeId)) {
        throw new ValidationError('Invalid recipe ID format');
      }

      if (rating < 1 || rating > 5) {
        throw new ValidationError('Rating must be between 1 and 5');
      }

      const update: MongoUpdate<Recipe> = {
        $inc: {
          'ratings.count': 1,
          'ratings.total': rating
        },
        $set: {
          'ratings.average': rating,
          updatedAt: new Date()
        }
      };

      const result = await this.recipesCollection.updateOne(
        { _id: recipeId },
        update
      );

      if (result.matchedCount === 0) {
        throw new MongoNotFoundError('Recipe not found');
      }
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      if (error instanceof MongoNotFoundError) throw error;
      logger.error('Failed to update recipe rating:', error);
      throw new MongoWriteError('Failed to update recipe rating', error);
    }
  }

  async getRecipesByAuthor(authorId: ObjectId): Promise<Recipe[]> {
    await this.ensureInitialized();
    try {
      return this.recipesCollection
        .find({ 'author._id': authorId })
        .sort({ createdAt: -1 })
        .toArray();
    } catch (error) {
      logger.error('Failed to get recipes by author:', error);
      throw new MongoQueryError('Failed to get recipes by author', error);
    }
  }

  async getRecipesByTags(tags: string[]): Promise<Recipe[]> {
    await this.ensureInitialized();
    try {
      return this.recipesCollection
        .find({ tags: { $all: tags } })
        .sort({ 'ratings.average': -1 })
        .toArray();
    } catch (error) {
      logger.error('Failed to get recipes by tags:', error);
      throw new MongoQueryError('Failed to get recipes by tags', error);
    }
  }

  async getPopularRecipes(limit: number = 10): Promise<Recipe[]> {
    await this.ensureInitialized();
    try {
      return this.recipesCollection
        .find({})
        .sort({ 'ratings.average': -1, 'ratings.count': -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      logger.error('Failed to get popular recipes:', error);
      throw new MongoQueryError('Failed to get popular recipes', error);
    }
  }

  async findRecipeByTitle(title: string): Promise<Recipe | null> {
    await this.ensureInitialized();
    try {
      return this.recipesCollection.findOne({ title });
    } catch (error) {
      logger.error('Failed to find recipe by title:', error);
      throw new MongoQueryError('Failed to find recipe by title', error);
    }
  }

  async toggleLike(recipeId: ObjectId, userId: ObjectId): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const existingLike = await this.likesCollection.findOne({ recipeId, userId });

      if (existingLike) {
        await Promise.all([
          this.likesCollection.deleteOne({ _id: existingLike._id }),
          this.recipesCollection.updateOne(
            { _id: recipeId },
            { $inc: { 'stats.likes': -1 } }
          )
        ]);
        return false;
      }

      const now = new Date();
      const newLike: RecipeLike = {
        _id: new ObjectId(),
        userId,
        recipeId,
        createdAt: now,
        updatedAt: now
      };

      await Promise.all([
        this.likesCollection.insertOne(newLike),
        this.recipesCollection.updateOne(
          { _id: recipeId },
          { $inc: { 'stats.likes': 1 } }
        )
      ]);
      return true;
    } catch (error) {
      logger.error('Failed to toggle recipe like:', error);
      throw new MongoWriteError('Failed to toggle like', error);
    }
  }

  async getRecipeLikes(
    recipeId: ObjectId,
    options: {
      page?: number;
      limit?: number;
      includeUser?: boolean;
      excludeFields?: string[];
    } = {}
  ): Promise<{
    likes: Array<RecipeLike & { user?: { _id: ObjectId; name: string } }>;
    total: number;
  }> {
    await this.ensureInitialized();

    try {
      if (!isObjectId(recipeId)) {
        throw new ValidationError('Invalid recipe ID format');
      }

      const page = options.page || 1;
      const limit = Math.min(options.limit || 20, 50);
      const skip = (page - 1) * limit;

      const pipeline: any[] = [{ $match: { recipeId } }];

      if (options.includeUser) {
        pipeline.push(
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user'
            }
          },
          { $unwind: '$user' }
        );

        if (options.excludeFields?.length) {
          const projection: Record<string, number> = {
            _id: 1,
            userId: 1,
            recipeId: 1,
            createdAt: 1,
            'user._id': 1,
            'user.name': 1
          };
          options.excludeFields.forEach(field => {
            projection[field] = 0;
          });
          pipeline.push({ $project: projection });
        }
      }

      pipeline.push(
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit }
      );

      const [likes, total] = await Promise.all([
        this.likesCollection
          .aggregate<RecipeLike & { user?: { _id: ObjectId; name: string } }>(pipeline)
          .toArray(),
        this.likesCollection.countDocuments({ recipeId })
      ]);

      return { likes, total };
    } catch (error) {
      logger.error('Failed to get recipe likes:', error);
      throw new MongoQueryError('Failed to get recipe likes', error);
    }
  }

  async reportRecipe(
    recipeId: ObjectId,
    userId: ObjectId,
    report: {
      reason: 'inappropriate' | 'copyright' | 'spam' | 'other';
      description?: string;
    }
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      const now = new Date();
      const reportDoc: RecipeReport = {
        _id: new ObjectId(),
        recipeId,
        userId,
        reason: report.reason,
        description: report.description ?? '',
        status: 'pending',
        createdAt: now,
        updatedAt: now
      };

      await this.reportsCollection.insertOne(reportDoc);
    } catch (error) {
      logger.error('Failed to report recipe:', error);
      throw new MongoWriteError('Failed to report recipe', error);
    }
  }
}

export const recipeService = RecipeService.getInstance();
