import { ObjectId } from 'mongodb';
import type { Recipe } from '../types/recipe.js';
import type { MongoFilter, MongoFindOptions } from '../types/mongodb.js';
import { MongoQueryError } from '../types/mongodb-errors.js';
import { ValidationError } from '../types/validation-errors.js';
import { DatabaseService } from '../db/database.service.js';
import { isObjectId } from '../types/mongodb.js';
import logger from '../utils/logger.js';
import { RecipeScoringUtils } from '../utils/recipe-scoring.utils.js';

// Add new error types
export class RecommendationError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'RecommendationError';
  }
}

export class ScoringError extends RecommendationError {
  constructor(message: string, details?: unknown) {
    super(`Scoring failed: ${message}`, details);
    this.name = 'ScoringError';
  }
}

// Add type safety for scoring factors
export interface MatchFactors {
  preferences: number;
  history: number;
  popularity: number;
  seasonality: number;
  difficulty: number;
  timing: number;
}

export interface ScoredRecipe {
  recipe: Recipe;
  matchScore: number;
  matchFactors: MatchFactors;
}

export interface RecommendationContext {
  userId?: ObjectId;
  preferences?: {
    cuisines?: string[];
    dietary?: string[];
    difficulty?: Recipe['difficulty'][];
    maxTime?: number;
  };
  history?: {
    viewedRecipes?: ObjectId[];
    likedRecipes?: ObjectId[];
    cookedRecipes?: ObjectId[];
  };
  season?: string;
  mealType?: string;
  time?: Date;
}

/**
 * Service for generating personalized recipe recommendations.
 * Uses a scoring system based on user preferences, history, and recipe attributes.
 */
export class RecommendationService {
  private static instance: RecommendationService;
  private db: DatabaseService;
  private initialized: boolean = false;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.initialize().catch(error => {
      logger.error('Failed to initialize RecommendationService:', error);
    });
  }

  /**
   * Gets the singleton instance of RecommendationService.
   * @returns The RecommendationService instance
   */
  static getInstance(): RecommendationService {
    if (!RecommendationService.instance) {
      RecommendationService.instance = new RecommendationService();
    }
    return RecommendationService.instance;
  }

  private async initialize() {
    if (this.initialized) return;

    try {
      await this.db.connect();
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize RecommendationService:', error);
      throw new MongoQueryError('Failed to initialize RecommendationService', error);
    }
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Gets similar recipes based on a reference recipe.
   * @param recipeId - ID of the reference recipe
   * @param limit - Maximum number of recommendations to return
   * @returns Promise resolving to scored similar recipes
   * @throws {ValidationError} If recipe ID is invalid
   * @throws {MongoQueryError} If database query fails
   */
  async getSimilarRecipes(
    recipeId: ObjectId,
    limit: number = 5
  ): Promise<ScoredRecipe[]> {
    try {
      await this.ensureInitialized();

      if (!isObjectId(recipeId)) {
        throw new ValidationError('Invalid recipe ID format');
      }

      const recipe = await this.db.getCollection<Recipe>('recipes').findOne({ _id: recipeId });
      if (!recipe) {
        throw new ValidationError('Recipe not found');
      }

      const filter: MongoFilter<Recipe> = {
        _id: { $ne: recipeId },
        $or: [
          { cuisine: recipe.cuisine },
          { tags: { $in: recipe.tags } },
          { difficulty: recipe.difficulty }
        ]
      };

      const options: MongoFindOptions<Recipe> = {
        limit: limit * 2 // Get more recipes than needed to allow for scoring
      };

      const candidates = await this.db.getCollection<Recipe>('recipes')
        .find(filter, options)
        .toArray();

      const scoredRecipes = candidates.map(candidate => ({
        recipe: candidate,
        matchScore: RecipeScoringUtils.calculateSimilarityScore(recipe, candidate),
        matchFactors: RecipeScoringUtils.calculateMatchFactors(recipe, candidate)
      }));

      // Sort by match score and take the top N
      return scoredRecipes
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, limit);
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      logger.error('Failed to get similar recipes:', error);
      throw new MongoQueryError('Failed to get similar recipes', error);
    }
  }

  /**
   * Gets personalized recipe recommendations based on user context.
   * @param context - User's recommendation context (preferences, history, etc.)
   * @param limit - Maximum number of recommendations to return
   * @returns Promise resolving to scored recommended recipes
   * @throws {MongoQueryError} If database query fails
   */
  async getRecommendedRecipes(
    context: RecommendationContext,
    limit: number = 10
  ): Promise<ScoredRecipe[]> {
    try {
      await this.ensureInitialized();

      const filter: MongoFilter<Recipe> = {};
      const options: MongoFindOptions<Recipe> = { limit: limit * 2 };

      // Apply context-based filters
      if (context.preferences) {
        if (context.preferences.cuisines?.length) {
          filter.cuisine = { $in: context.preferences.cuisines };
        }
        if (context.preferences.difficulty?.length) {
          filter.difficulty = { $in: context.preferences.difficulty };
        }
        if (context.preferences.maxTime) {
          filter.$expr = {
            $lte: [
              { $add: ['$prepTime', '$cookTime'] },
              context.preferences.maxTime
            ]
          };
        }
      }

      // Exclude recently viewed recipes
      if (context.history?.viewedRecipes?.length) {
        filter._id = { $nin: context.history.viewedRecipes };
      }

      const candidates = await this.db.getCollection<Recipe>('recipes')
        .find(filter, options)
        .toArray();

      const scoredRecipes = candidates.map(recipe => ({
        recipe,
        matchScore: RecipeScoringUtils.calculateContextScore(recipe, context),
        matchFactors: RecipeScoringUtils.calculateContextFactors(recipe, context)
      }));

      // Sort by match score and take the top N
      return scoredRecipes
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, limit);
    } catch (error) {
      logger.error('Failed to get recommended recipes:', error);
      throw new MongoQueryError('Failed to get recommended recipes', error);
    }
  }

  /**
   * Calculates similarity score between two recipes.
   * @param recipe1 - First recipe to compare
   * @param recipe2 - Second recipe to compare
   * @returns Similarity score between 0 and 1
   * @throws {ScoringError} If scoring calculation fails
   * @private
   */
  private calculateSimilarityScore(recipe1: Recipe, recipe2: Recipe): number {
    try {
      let score = 0;

      // Compare cuisines (30% weight)
      if (recipe1.cuisine && recipe2.cuisine && recipe1.cuisine === recipe2.cuisine) {
        score += 0.3;
      }

      // Compare tags (30% weight)
      const commonTags = recipe1.tags.filter(tag => recipe2.tags.includes(tag));
      score += (commonTags.length / Math.max(recipe1.tags.length, recipe2.tags.length)) * 0.3;

      // Compare difficulty (20% weight)
      if (recipe1.difficulty === recipe2.difficulty) {
        score += 0.2;
      }

      // Compare cooking time (20% weight)
      const time1 = (recipe1.prepTime || 0) + (recipe1.cookTime || 0);
      const time2 = (recipe2.prepTime || 0) + (recipe2.cookTime || 0);
      const timeDiff = Math.abs(time1 - time2);
      score += Math.max(0, 0.2 - (timeDiff / 60) * 0.1);

      return Math.min(1, score);
    } catch (error) {
      throw new ScoringError('Failed to calculate similarity score', error);
    }
  }

  /**
   * Calculates match factors between two recipes.
   * @param recipe1 - First recipe to compare
   * @param recipe2 - Second recipe to compare
   * @returns Match factors for different comparison aspects
   * @throws {ScoringError} If factor calculation fails
   * @private
   */
  private calculateMatchFactors(recipe1: Recipe, recipe2: Recipe): MatchFactors {
    try {
      return {
        preferences: recipe1.cuisine === recipe2.cuisine ? 1 : 0,
        history: 0, // Not applicable for similarity comparison
        popularity: recipe2.ratings?.average || 0,
        seasonality: 0.5, // Default value when not considering season
        difficulty: recipe1.difficulty === recipe2.difficulty ? 1 : 0,
        timing: Math.max(0, 1 - Math.abs(
          ((recipe1.prepTime || 0) + (recipe1.cookTime || 0)) - 
          ((recipe2.prepTime || 0) + (recipe2.cookTime || 0))
        ) / 60)
      };
    } catch (error) {
      throw new ScoringError('Failed to calculate match factors', error);
    }
  }

  /**
   * Calculates context-based score for a recipe.
   * @param recipe - Recipe to score
   * @param context - User's recommendation context
   * @returns Context-based score between 0 and 1
   * @throws {ScoringError} If scoring calculation fails
   * @private
   */
  private calculateContextScore(recipe: Recipe, context: RecommendationContext): number {
    try {
      let score = 0;

      // Preference matching (30% weight)
      if (context.preferences) {
        if (context.preferences.cuisines?.includes(recipe.cuisine || '')) {
          score += 0.3;
        }
        if (context.preferences.difficulty?.includes(recipe.difficulty)) {
          score += 0.2;
        }
        if (context.preferences.maxTime) {
          const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
          if (totalTime <= context.preferences.maxTime) {
            score += 0.2 * (1 - totalTime / context.preferences.maxTime);
          }
        }
      }

      // Popularity (10% weight)
      if (recipe.ratings?.average) {
        score += Math.min(recipe.ratings.average / 5, 1) * 0.1;
      }

      // Season matching (20% weight)
      if (context.season && recipe.seasons?.includes(context.season)) {
        score += 0.2;
      }

      return Math.min(1, score);
    } catch (error) {
      throw new ScoringError('Failed to calculate context score', error);
    }
  }

  /**
   * Calculates context-based match factors for a recipe.
   * @param recipe - Recipe to analyze
   * @param context - User's recommendation context
   * @returns Match factors for different context aspects
   * @throws {ScoringError} If factor calculation fails
   * @private
   */
  private calculateContextFactors(recipe: Recipe, context: RecommendationContext): MatchFactors {
    try {
      const hasLikedRecipes = context.history?.likedRecipes?.length || 0;
      const isLiked = context.history?.likedRecipes?.includes(recipe._id) || false;

      return {
        preferences: context.preferences?.cuisines?.includes(recipe.cuisine || '') ? 1 : 0,
        history: hasLikedRecipes ? (isLiked ? 1 : 0) : 0.5,
        popularity: Math.min((recipe.ratings?.average || 0) / 5, 1),
        seasonality: context.season && recipe.seasons?.includes(context.season) ? 1 : 0.5,
        difficulty: context.preferences?.difficulty?.includes(recipe.difficulty) ? 1 : 0.5,
        timing: context.preferences?.maxTime
          ? Math.max(0, 1 - ((recipe.prepTime || 0) + (recipe.cookTime || 0)) / context.preferences.maxTime)
          : 0.5
      };
    } catch (error) {
      throw new ScoringError('Failed to calculate context factors', error);
    }
  }
}
