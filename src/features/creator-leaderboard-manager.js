import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';
import Redis from 'ioredis';

class CreatorLeaderboardManager {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.CACHE_TTL = 60 * 60; // 1 hour in seconds
    this.TOP_CREATORS_CACHE_KEY = 'creators:top';
    this.RISING_CREATORS_CACHE_KEY = 'creators:rising';

    // Weights for creator score calculation
    this.weights = {
      recipeCount: 1.0,
      avgRating: 10.0,
      followers: 0.5,
      likes: 0.2,
      comments: 0.3,
      saves: 0.4,
      timeDecay: 0.8, // decay factor per month
      activityBonus: 0.1, // bonus per day of activity
    };

    // Time windows
    this.ACTIVITY_WINDOW = 90; // days to consider for activity
    this.RISING_WINDOW = 30; // days to consider for rising stars
  }

  /**
   * Calculate creator score
   * @param {Object} stats Creator statistics
   * @param {Date} lastActive Last active date
   * @returns {number} Creator score
   */
  calculateCreatorScore(stats, lastActive) {
    const now = new Date();
    const monthsInactive = (now - lastActive) / (1000 * 60 * 60 * 24 * 30);

    // Base score from engagement metrics
    const baseScore =
      this.weights.recipeCount * (stats.recipeCount || 0) +
      this.weights.avgRating * (stats.averageRating || 0) +
      this.weights.followers * (stats.followersCount || 0) +
      this.weights.likes * (stats.totalLikes || 0) +
      this.weights.comments * (stats.totalComments || 0) +
      this.weights.saves * (stats.totalSaves || 0);

    // Activity bonus for recent logins/posts
    const activityBonus = this.weights.activityBonus * (stats.daysActive || 0);

    // Apply time decay
    return (baseScore + activityBonus) * Math.pow(this.weights.timeDecay, monthsInactive);
  }

  /**
   * Calculate rising score (recent growth)
   * @param {Object} currentStats Current statistics
   * @param {Object} previousStats Statistics from previous period
   * @returns {number} Rising score
   */
  calculateRisingScore(currentStats, previousStats) {
    const getGrowth = (current, previous) => {
      const growth = ((current || 0) - (previous || 0)) / (previous || 1);
      return growth > 0 ? growth : 0;
    };

    return (
      this.weights.followers *
        getGrowth(currentStats.followersCount, previousStats.followersCount) +
      this.weights.likes * getGrowth(currentStats.totalLikes, previousStats.totalLikes) +
      this.weights.recipeCount * getGrowth(currentStats.recipeCount, previousStats.recipeCount)
    );
  }

  /**
   * Update creator statistics
   * @returns {Promise<number>} Number of creators updated
   */
  async updateCreatorStats() {
    try {
      const db = getDb();
      const now = new Date();
      const activityThreshold = new Date(now - this.ACTIVITY_WINDOW * 24 * 60 * 60 * 1000);
      const risingThreshold = new Date(now - this.RISING_WINDOW * 24 * 60 * 60 * 1000);

      // Get all creators with their recipes and engagement metrics
      const creators = await db
        .collection('users')
        .aggregate([
          {
            $lookup: {
              from: 'recipes',
              localField: '_id',
              foreignField: 'creatorId',
              as: 'recipes',
            },
          },
          {
            $lookup: {
              from: 'followers',
              localField: '_id',
              foreignField: 'followedId',
              as: 'followers',
            },
          },
          {
            $project: {
              password: 0,
              email: 0,
              recipes: {
                $filter: {
                  input: '$recipes',
                  as: 'recipe',
                  cond: { $gte: ['$$recipe.createdAt', activityThreshold] },
                },
              },
            },
          },
        ])
        .toArray();

      // Get previous stats for rising score calculation
      const previousStats = await db
        .collection('creatorStats')
        .find({
          timestamp: {
            $gte: risingThreshold,
            $lt: now,
          },
        })
        .toArray();

      const previousStatsMap = new Map(previousStats.map(s => [s.userId.toString(), s]));

      // Calculate and update scores
      const bulkOps = creators.map(creator => {
        const stats = {
          recipeCount: creator.recipes.length,
          averageRating:
            creator.recipes.reduce((acc, r) => acc + (r.averageRating || 0), 0) /
            creator.recipes.length,
          followersCount: creator.followers.length,
          totalLikes: creator.recipes.reduce((acc, r) => acc + (r.likesCount || 0), 0),
          totalComments: creator.recipes.reduce((acc, r) => acc + (r.commentsCount || 0), 0),
          totalSaves: creator.recipes.reduce((acc, r) => acc + (r.savesCount || 0), 0),
          daysActive: new Set(creator.recipes.map(r => r.createdAt.toDateString())).size,
        };

        const creatorScore = this.calculateCreatorScore(stats, creator.lastActive || now);

        const previousStat = previousStatsMap.get(creator._id.toString());
        const risingScore = previousStat ? this.calculateRisingScore(stats, previousStat) : 0;

        return {
          updateOne: {
            filter: { _id: creator._id },
            update: {
              $set: {
                creatorScore,
                risingScore,
                stats,
                updatedAt: now,
              },
            },
          },
        };
      });

      if (bulkOps.length > 0) {
        await db.collection('users').bulkWrite(bulkOps);
      }

      // Save current stats to history
      const statsHistory = creators.map(creator => ({
        userId: creator._id,
        ...creator.stats,
        timestamp: now,
      }));

      if (statsHistory.length > 0) {
        await db.collection('creatorStats').insertMany(statsHistory);
      }

      // Clean up old history (keep last 90 days)
      const oldestToKeep = new Date(now - 90 * 24 * 60 * 60 * 1000);
      await db.collection('creatorStats').deleteMany({
        timestamp: { $lt: oldestToKeep },
      });

      // Invalidate cache
      await this.invalidateCache();

      return creators.length;
    } catch (error) {
      console.error('Error updating creator stats:', error);
      throw error;
    }
  }

  /**
   * Get top creators
   * @param {Object} options Query options
   * @returns {Promise<Array>} Top creators
   */
  async getTopCreators({ limit = 20, offset = 0, timeRange } = {}) {
    try {
      const db = getDb();
      const query = {
        creatorScore: { $gt: 0 },
      };

      if (timeRange) {
        const now = new Date();
        query.updatedAt = {
          $gte: new Date(now - timeRange * 24 * 60 * 60 * 1000),
        };
      }

      const creators = await db
        .collection('users')
        .aggregate([
          { $match: query },
          {
            $project: {
              password: 0,
              email: 0,
            },
          },
          { $sort: { creatorScore: -1 } },
          { $skip: offset },
          { $limit: limit },
        ])
        .toArray();

      return creators;
    } catch (error) {
      console.error('Error getting top creators:', error);
      throw error;
    }
  }

  /**
   * Get rising creators
   * @param {Object} options Query options
   * @returns {Promise<Array>} Rising creators
   */
  async getRisingCreators({ limit = 20, offset = 0 } = {}) {
    try {
      const db = getDb();
      const query = {
        risingScore: { $gt: 0 },
      };

      const creators = await db
        .collection('users')
        .aggregate([
          { $match: query },
          {
            $project: {
              password: 0,
              email: 0,
            },
          },
          { $sort: { risingScore: -1 } },
          { $skip: offset },
          { $limit: limit },
        ])
        .toArray();

      return creators;
    } catch (error) {
      console.error('Error getting rising creators:', error);
      throw error;
    }
  }

  /**
   * Cache creators
   * @param {string} key Cache key
   * @param {Array} creators Creators to cache
   * @returns {Promise<void>}
   */
  async cacheCreators(key, creators) {
    try {
      await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(creators));
    } catch (error) {
      console.error('Error caching creators:', error);
    }
  }

  /**
   * Get cached creators
   * @param {string} key Cache key
   * @returns {Promise<Array|null>} Cached creators or null
   */
  async getCachedCreators(key) {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting cached creators:', error);
      return null;
    }
  }

  /**
   * Invalidate creator caches
   * @returns {Promise<void>}
   */
  async invalidateCache() {
    try {
      await Promise.all([
        this.redis.del(this.TOP_CREATORS_CACHE_KEY),
        this.redis.del(this.RISING_CREATORS_CACHE_KEY),
      ]);
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  }
}

export default new CreatorLeaderboardManager();
