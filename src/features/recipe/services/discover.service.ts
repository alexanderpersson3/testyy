import type { Recipe } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
import type { getCollection } from '../types/express.js';
import { connectToDatabase } from '../db.js';;
import logger from '../utils/logger.js';
import { DatabaseError } from '../utils/errors.js';;

export class DiscoverService {
  private static instance: DiscoverService;

  private constructor() {}

  public static getInstance(): DiscoverService {
    if (!DiscoverService.instance) {
      DiscoverService.instance = new DiscoverService();
    }
    return DiscoverService.instance;
  }

  async getTrendingRecipes(limit: number) {
    try {
      const db = await connectToDatabase();
      const pipeline = [
        {
          $match: {
            visibility: 'public',
            'stats.viewCount': { $gt: 0 },
          },
        },
        {
          $addFields: {
            score: {
              $add: [
                { $multiply: ['$stats.viewCount', 1] },
                { $multiply: ['$stats.likeCount', 2] },
                { $multiply: ['$stats.commentCount', 3] },
                { $multiply: ['$stats.shareCount', 4] },
              ],
            },
          },
        },
        { $sort: { score: -1 } },
        { $limit: limit },
      ];

      return await getCollection('recipes').aggregate(pipeline).toArray();
    } catch (error) {
      logger.error('Error in getTrendingRecipes:', error);
      throw new DatabaseError('Failed to get trending recipes');
    }
  }

  async getPopularRecipes(limit: number) {
    try {
      const db = await connectToDatabase();
      const pipeline = [
        {
          $match: {
            visibility: 'public',
            'stats.likeCount': { $gt: 0 },
          },
        },
        { $sort: { 'stats.likeCount': -1 } },
        { $limit: limit },
      ];

      return await getCollection('recipes').aggregate(pipeline).toArray();
    } catch (error) {
      logger.error('Error in getPopularRecipes:', error);
      throw new DatabaseError('Failed to get popular recipes');
    }
  }

  async getRecentRecipes(limit: number) {
    try {
      const db = await connectToDatabase();
      return await getCollection('recipes')
        .find({ visibility: 'public' })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      logger.error('Error in getRecentRecipes:', error);
      throw new DatabaseError('Failed to get recent recipes');
    }
  }

  async getRecommendedRecipes(userId: ObjectId, limit: number) {
    try {
      const db = await connectToDatabase();

      // Get user's favorite recipes
      const favorites = await getCollection('favorite_recipes').find({ userId }).toArray();

      // Get user's recently viewed recipes
      const recentlyViewed = await getCollection('recipe_views')
        .find({ userId })
        .sort({ viewedAt: -1 })
        .limit(10)
        .toArray();

      // Get recipes with similar tags
      const userRecipes = await getCollection('recipes')
        .find({
          $or: [
            { _id: { $in: favorites.map(f => f.recipeId) } },
            { _id: { $in: recentlyViewed.map(v => v.recipeId) } },
          ],
        })
        .toArray();

      const userTags = [...new Set(userRecipes.flatMap(r => r.tags))];

      return await getCollection('recipes')
        .find({
          visibility: 'public',
          _id: { $nin: userRecipes.map(r => r._id) },
          tags: { $in: userTags },
        })
        .sort({ 'stats.likeCount': -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      logger.error('Error in getRecommendedRecipes:', error);
      throw new DatabaseError('Failed to get recommended recipes');
    }
  }

  async getRecipeSuggestions(limit: number) {
    try {
      const db = await connectToDatabase();
      return await getCollection('recipes')
        .aggregate([{ $match: { visibility: 'public' } }, { $sample: { size: limit } }])
        .toArray();
    } catch (error) {
      logger.error('Error in getRecipeSuggestions:', error);
      throw new DatabaseError('Failed to get recipe suggestions');
    }
  }

  async getRecipeCategories() {
    try {
      const db = await connectToDatabase();
      return await getCollection('recipe_categories')
        .find({ isActive: true })
        .sort({ order: 1 })
        .toArray();
    } catch (error) {
      logger.error('Error in getRecipeCategories:', error);
      throw new DatabaseError('Failed to get recipe categories');
    }
  }

  async getRecipesByCategory(categoryId: ObjectId, limit: number) {
    try {
      const db = await connectToDatabase();
      return await getCollection('recipes')
        .find({
          visibility: 'public',
          categoryId,
        })
        .sort({ 'stats.likeCount': -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      logger.error('Error in getRecipesByCategory:', error);
      throw new DatabaseError('Failed to get recipes by category');
    }
  }
} 