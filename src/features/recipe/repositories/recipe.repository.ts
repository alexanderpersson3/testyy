import { ObjectId } from 'mongodb';
import type { Filter, Sort, Document } from 'mongodb';
import { BaseRepository } from '../../../core/database/base.repository.js';
import type { Recipe, Difficulty } from '../types/recipe.types.js';
import type { MongoDocument } from '../../../core/database/types/mongodb.types.js';

/**
 * Recipe document with MongoDB fields
 */
export interface RecipeDocument extends Recipe, MongoDocument {}

/**
 * Recipe stats response type
 */
export interface RecipeStats {
  total: number;
  byDifficulty: Record<Difficulty, number>;
  byCuisine: Record<string, number>;
  averageRating: number;
  totalViews: number;
}

/**
 * Recipe search parameters
 */
export interface RecipeSearchParams {
  query?: string;
  cuisine?: string;
  difficulty?: Difficulty;
  tags?: string[];
  authorId?: ObjectId;
  minRating?: number;
  maxPrepTime?: number;
  maxCookTime?: number;
  includeIngredients?: string[];
  excludeIngredients?: string[];
  isPublished?: boolean;
  language?: string;
}

/**
 * Repository for managing recipes in MongoDB
 */
export class RecipeRepository extends BaseRepository<RecipeDocument> {
  constructor() {
    super('recipes');
  }

  /**
   * Find recipes by search parameters
   */
  async search(params: RecipeSearchParams): Promise<RecipeDocument[]> {
    const filter: Filter<RecipeDocument> = {};
    const sort: Sort = { updatedAt: -1 };

    // Full-text search
    if (params.query) {
      filter.$text = { $search: params.query };
      sort.score = { $meta: 'textScore' };
    }

    // Filter by cuisine
    if (params.cuisine) {
      filter.cuisine = params.cuisine;
    }

    // Filter by difficulty
    if (params.difficulty) {
      filter.difficulty = params.difficulty;
    }

    // Filter by tags
    if (params.tags?.length) {
      filter.tags = { $all: params.tags };
    }

    // Filter by author
    if (params.authorId) {
      filter['author._id'] = params.authorId;
    }

    // Filter by rating
    if (params.minRating) {
      filter['ratings.average'] = { $gte: params.minRating };
    }

    // Filter by prep time
    if (params.maxPrepTime) {
      filter.prepTime = { $lte: params.maxPrepTime };
    }

    // Filter by cook time
    if (params.maxCookTime) {
      filter.cookTime = { $lte: params.maxCookTime };
    }

    // Filter by ingredients
    if (params.includeIngredients?.length) {
      filter['ingredients.name'] = { $all: params.includeIngredients };
    }
    if (params.excludeIngredients?.length) {
      filter['ingredients.name'] = { $nin: params.excludeIngredients };
    }

    // Filter by publication status
    if (typeof params.isPublished === 'boolean') {
      filter.isPublished = params.isPublished;
    }

    // Filter by language
    if (params.language) {
      filter.language = params.language;
    }

    return this.find(filter, { sort });
  }

  /**
   * Find recipes by author
   */
  async findByAuthor(authorId: ObjectId): Promise<RecipeDocument[]> {
    return this.find({
      'author._id': authorId
    });
  }

  /**
   * Find recipes by cuisine
   */
  async findByCuisine(cuisine: string): Promise<RecipeDocument[]> {
    return this.find({ cuisine });
  }

  /**
   * Find recipes by difficulty
   */
  async findByDifficulty(difficulty: Difficulty): Promise<RecipeDocument[]> {
    return this.find({ difficulty });
  }

  /**
   * Find recipes by tags
   */
  async findByTags(tags: string[]): Promise<RecipeDocument[]> {
    return this.find({
      tags: { $all: tags }
    });
  }

  /**
   * Find popular recipes
   */
  async findPopular(limit: number = 10): Promise<RecipeDocument[]> {
    return this.find(
      { 'ratings.count': { $gt: 0 } },
      {
        sort: { 'ratings.average': -1, 'ratings.count': -1 },
        limit
      }
    );
  }

  /**
   * Find recent recipes
   */
  async findRecent(limit: number = 10): Promise<RecipeDocument[]> {
    return this.find(
      {},
      {
        sort: { createdAt: -1 },
        limit
      }
    );
  }

  /**
   * Find similar recipes
   */
  async findSimilar(recipeId: ObjectId): Promise<RecipeDocument[]> {
    const recipe = await this.findById(recipeId);
    if (!recipe) {
      return [];
    }

    return this.find({
      _id: { $ne: recipeId },
      $or: [
        { cuisine: recipe.cuisine },
        { tags: { $in: recipe.tags } },
        { difficulty: recipe.difficulty }
      ]
    });
  }

  /**
   * Update recipe rating
   */
  async updateRating(
    recipeId: ObjectId,
    rating: number
  ): Promise<RecipeDocument | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: recipeId },
      {
        $inc: {
          'ratings.count': 1,
          'ratings.total': rating
        },
        $set: {
          'ratings.average': {
            $divide: [
              { $add: ['$ratings.total', rating] },
              { $add: ['$ratings.count', 1] }
            ]
          },
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    return result.value as RecipeDocument | null;
  }

  /**
   * Increment view count
   */
  async incrementViews(recipeId: ObjectId): Promise<void> {
    await this.collection.updateOne(
      { _id: recipeId },
      {
        $inc: { 'stats.viewCount': 1 },
        $set: { updatedAt: new Date() }
      }
    );
  }

  /**
   * Get recipe stats
   */
  async getStats(): Promise<RecipeStats> {
    const pipeline = [
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byDifficulty: {
            $push: {
              k: '$difficulty',
              v: { $sum: 1 }
            }
          },
          byCuisine: {
            $push: {
              k: '$cuisine',
              v: { $sum: 1 }
            }
          },
          totalRating: { $sum: '$ratings.total' },
          totalRatings: { $sum: '$ratings.count' },
          totalViews: { $sum: '$stats.viewCount' }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          byDifficulty: { $arrayToObject: '$byDifficulty' },
          byCuisine: { $arrayToObject: '$byCuisine' },
          averageRating: {
            $cond: [
              { $gt: ['$totalRatings', 0] },
              { $divide: ['$totalRating', '$totalRatings'] },
              0
            ]
          },
          totalViews: 1
        }
      }
    ];

    const [stats] = await this.collection
      .aggregate<RecipeStats>(pipeline)
      .toArray();

    return stats || {
      total: 0,
      byDifficulty: {} as Record<Difficulty, number>,
      byCuisine: {},
      averageRating: 0,
      totalViews: 0
    };
  }
} 