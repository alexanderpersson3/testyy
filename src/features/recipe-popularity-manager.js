import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';
import Redis from 'ioredis';

class RecipePopularityManager {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.CACHE_TTL = 60 * 60; // 1 hour in seconds
    this.COMMUNITY_RECIPES_CACHE_KEY = 'community:top_recipes';
    this.RISING_RECIPES_CACHE_KEY = 'community:rising_recipes';

    // Weights for popularity score calculation
    this.weights = {
      likes: 1.0,
      comments: 2.0,
      rating: 15.0,
      views: 0.1,
      saves: 3.0,
      shares: 4.0,
      timeSpent: 0.01, // per second
      timeDecay: 0.7, // decay factor
    };
  }

  /**
   * Calculate popularity score for a recipe
   * @param {Object} metrics Recipe metrics
   * @param {Date} createdAt Recipe creation date
   * @returns {number} Popularity score
   */
  calculatePopularityScore(metrics, createdAt) {
    const now = new Date();
    const ageInDays = (now - createdAt) / (1000 * 60 * 60 * 24);

    // Base score from engagement metrics
    const baseScore =
      this.weights.likes * (metrics.likesCount || 0) +
      this.weights.comments * (metrics.commentsCount || 0) +
      this.weights.rating * (metrics.averageRating || 0) +
      this.weights.views * (metrics.viewCount || 0) +
      this.weights.saves * (metrics.savesCount || 0) +
      this.weights.shares * (metrics.sharesCount || 0) +
      this.weights.timeSpent * (metrics.totalTimeSpent || 0);

    // Apply time decay
    return baseScore * Math.pow(this.weights.timeDecay, ageInDays);
  }

  /**
   * Calculate rising score for a recipe (last 24h engagement)
   * @param {Object} metrics Recipe metrics
   * @param {Object} previousMetrics Metrics from 24h ago
   * @returns {number} Rising score
   */
  calculateRisingScore(metrics, previousMetrics) {
    const getIncrease = (current, previous) => {
      const increase = (current || 0) - (previous || 0);
      return increase > 0 ? increase : 0;
    };

    return (
      this.weights.likes * getIncrease(metrics.likesCount, previousMetrics.likesCount) +
      this.weights.comments * getIncrease(metrics.commentsCount, previousMetrics.commentsCount) +
      this.weights.views * getIncrease(metrics.viewCount, previousMetrics.viewCount) +
      this.weights.saves * getIncrease(metrics.savesCount, previousMetrics.savesCount) +
      this.weights.shares * getIncrease(metrics.sharesCount, previousMetrics.sharesCount)
    );
  }

  /**
   * Update recipe metrics
   * @param {string} recipeId Recipe ID
   * @param {string} type Metric type
   * @param {number} timeSpent Time spent in seconds (optional)
   * @returns {Promise<void>}
   */
  async updateMetrics(recipeId, type, timeSpent = 0) {
    try {
      const db = getDb();
      const update = {
        $inc: {},
        $set: { updatedAt: new Date() },
      };

      switch (type) {
        case 'view':
          update.$inc.viewCount = 1;
          if (timeSpent > 0) {
            update.$inc.totalTimeSpent = timeSpent;
          }
          break;
        case 'like':
          update.$inc.likesCount = 1;
          break;
        case 'comment':
          update.$inc.commentsCount = 1;
          break;
        case 'save':
          update.$inc.savesCount = 1;
          break;
        case 'share':
          update.$inc.sharesCount = 1;
          break;
      }

      await db
        .collection('recipeMetrics')
        .updateOne({ recipeId: new ObjectId(recipeId) }, update, { upsert: true });

      // Invalidate cache
      await this.invalidateCache();
    } catch (error) {
      console.error('Error updating recipe metrics:', error);
      // Don't throw, just log the error
    }
  }

  /**
   * Update popularity scores for all community recipes
   * @returns {Promise<number>} Number of recipes updated
   */
  async updatePopularityScores() {
    try {
      const db = getDb();
      const now = new Date();
      const yesterday = new Date(now - 24 * 60 * 60 * 1000);

      // Get all community recipes with their metrics
      const recipes = await db
        .collection('recipes')
        .aggregate([
          {
            $match: {
              isCommunityRecipe: true,
            },
          },
          {
            $lookup: {
              from: 'recipeMetrics',
              localField: '_id',
              foreignField: 'recipeId',
              as: 'metrics',
            },
          },
          {
            $unwind: {
              path: '$metrics',
              preserveNullAndEmptyArrays: true,
            },
          },
        ])
        .toArray();

      // Get previous metrics for rising score calculation
      const previousMetrics = await db
        .collection('recipeMetricsHistory')
        .find({
          timestamp: {
            $gte: yesterday,
            $lt: now,
          },
        })
        .toArray();

      const previousMetricsMap = new Map(previousMetrics.map(m => [m.recipeId.toString(), m]));

      // Calculate and update scores
      const bulkOps = recipes.map(recipe => {
        const popularityScore = this.calculatePopularityScore(
          recipe.metrics || {},
          recipe.createdAt
        );

        const previousMetric = previousMetricsMap.get(recipe._id.toString());
        const risingScore = previousMetric
          ? this.calculateRisingScore(recipe.metrics || {}, previousMetric)
          : 0;

        return {
          updateOne: {
            filter: { _id: recipe._id },
            update: {
              $set: {
                popularityScore,
                risingScore,
                updatedAt: now,
              },
            },
          },
        };
      });

      if (bulkOps.length > 0) {
        await db.collection('recipes').bulkWrite(bulkOps);
      }

      // Save current metrics to history
      const metricsHistory = recipes.map(recipe => ({
        recipeId: recipe._id,
        ...recipe.metrics,
        timestamp: now,
      }));

      if (metricsHistory.length > 0) {
        await db.collection('recipeMetricsHistory').insertMany(metricsHistory);
      }

      // Clean up old history (keep last 7 days)
      const oldestToKeep = new Date(now - 7 * 24 * 60 * 60 * 1000);
      await db.collection('recipeMetricsHistory').deleteMany({
        timestamp: { $lt: oldestToKeep },
      });

      // Invalidate cache
      await this.invalidateCache();

      return recipes.length;
    } catch (error) {
      console.error('Error updating popularity scores:', error);
      throw error;
    }
  }

  /**
   * Get top community recipes
   * @param {Object} options Query options
   * @returns {Promise<Array>} Top recipes
   */
  async getTopRecipes({ limit = 20, offset = 0, timeRange, category, dietaryPreferences } = {}) {
    try {
      const db = getDb();
      const query = {
        isCommunityRecipe: true,
      };

      if (timeRange) {
        const now = new Date();
        query.createdAt = {
          $gte: new Date(now - timeRange * 24 * 60 * 60 * 1000),
        };
      }

      if (category) {
        query.category = category;
      }

      if (dietaryPreferences) {
        query.dietaryPreferences = { $in: dietaryPreferences };
      }

      const recipes = await db
        .collection('recipes')
        .aggregate([
          { $match: query },
          {
            $lookup: {
              from: 'users',
              localField: 'creatorId',
              foreignField: '_id',
              as: 'creator',
            },
          },
          { $unwind: '$creator' },
          {
            $lookup: {
              from: 'recipeMetrics',
              localField: '_id',
              foreignField: 'recipeId',
              as: 'metrics',
            },
          },
          { $unwind: '$metrics' },
          {
            $project: {
              'creator.password': 0,
              'creator.email': 0,
            },
          },
          { $sort: { popularityScore: -1 } },
          { $skip: offset },
          { $limit: limit },
        ])
        .toArray();

      return recipes;
    } catch (error) {
      console.error('Error getting top recipes:', error);
      throw error;
    }
  }

  /**
   * Get rising community recipes
   * @param {Object} options Query options
   * @returns {Promise<Array>} Rising recipes
   */
  async getRisingRecipes({ limit = 20, offset = 0, category, dietaryPreferences } = {}) {
    try {
      const db = getDb();
      const query = {
        isCommunityRecipe: true,
        risingScore: { $gt: 0 },
      };

      if (category) {
        query.category = category;
      }

      if (dietaryPreferences) {
        query.dietaryPreferences = { $in: dietaryPreferences };
      }

      const recipes = await db
        .collection('recipes')
        .aggregate([
          { $match: query },
          {
            $lookup: {
              from: 'users',
              localField: 'creatorId',
              foreignField: '_id',
              as: 'creator',
            },
          },
          { $unwind: '$creator' },
          {
            $lookup: {
              from: 'recipeMetrics',
              localField: '_id',
              foreignField: 'recipeId',
              as: 'metrics',
            },
          },
          { $unwind: '$metrics' },
          {
            $project: {
              'creator.password': 0,
              'creator.email': 0,
            },
          },
          { $sort: { risingScore: -1 } },
          { $skip: offset },
          { $limit: limit },
        ])
        .toArray();

      return recipes;
    } catch (error) {
      console.error('Error getting rising recipes:', error);
      throw error;
    }
  }

  /**
   * Cache recipes
   * @param {string} key Cache key
   * @param {Array} recipes Recipes to cache
   * @returns {Promise<void>}
   */
  async cacheRecipes(key, recipes) {
    try {
      await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(recipes));
    } catch (error) {
      console.error('Error caching recipes:', error);
      // Don't throw, just log the error
    }
  }

  /**
   * Get cached recipes
   * @param {string} key Cache key
   * @returns {Promise<Array|null>} Cached recipes or null
   */
  async getCachedRecipes(key) {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting cached recipes:', error);
      return null;
    }
  }

  /**
   * Invalidate recipe caches
   * @returns {Promise<void>}
   */
  async invalidateCache() {
    try {
      await Promise.all([
        this.redis.del(this.COMMUNITY_RECIPES_CACHE_KEY),
        this.redis.del(this.RISING_RECIPES_CACHE_KEY),
      ]);
    } catch (error) {
      console.error('Error invalidating cache:', error);
      // Don't throw, just log the error
    }
  }
}

export default new RecipePopularityManager();
