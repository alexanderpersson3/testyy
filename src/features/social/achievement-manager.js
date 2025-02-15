import { getDb } from '../../config/db.js';
import { ObjectId } from 'mongodb';
import Redis from 'ioredis';

class AchievementManager {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);

    // Define badge types and their requirements
    this.badges = {
      RECIPE_CREATOR: {
        levels: [
          { id: 'RECIPE_CREATOR_1', name: 'Recipe Rookie', requirement: 1 },
          { id: 'RECIPE_CREATOR_2', name: 'Recipe Expert', requirement: 10 },
          { id: 'RECIPE_CREATOR_3', name: 'Recipe Master', requirement: 50 },
        ],
        type: 'recipes_created',
      },
      RECIPE_LIKES: {
        levels: [
          { id: 'RECIPE_LIKES_1', name: 'Rising Star', requirement: 10 },
          { id: 'RECIPE_LIKES_2', name: 'Community Favorite', requirement: 100 },
          { id: 'RECIPE_LIKES_3', name: 'Recipe Legend', requirement: 1000 },
        ],
        type: 'total_likes',
      },
      WEEKLY_STREAK: {
        levels: [
          { id: 'WEEKLY_STREAK_1', name: 'Consistent Cook', requirement: 7 },
          { id: 'WEEKLY_STREAK_2', name: 'Dedicated Chef', requirement: 30 },
          { id: 'WEEKLY_STREAK_3', name: 'Kitchen Warrior', requirement: 90 },
        ],
        type: 'daily_streak',
      },
    };
  }

  /**
   * Track a user achievement and award badges
   * @param {string} userId User ID
   * @param {string} achievementType Type of achievement
   * @param {number} value Achievement value
   * @returns {Promise<Object>} Awarded badges if any
   */
  async trackAchievement(userId, achievementType, value) {
    try {
      const db = getDb();
      const now = new Date();

      // Update user stats
      const stats = await db.collection('user_stats').findOneAndUpdate(
        { userId: new ObjectId(userId) },
        {
          $inc: { [achievementType]: value },
          $setOnInsert: { createdAt: now },
          $set: { updatedAt: now },
        },
        { upsert: true, returnDocument: 'after' }
      );

      // Check for new badges
      const newBadges = await this.checkAndAwardBadges(
        userId,
        achievementType,
        stats[achievementType]
      );

      // Invalidate leaderboard cache if achievement affects rankings
      if (['recipes_created', 'total_likes'].includes(achievementType)) {
        await this.invalidateLeaderboardCache(achievementType);
      }

      return newBadges;
    } catch (error) {
      console.error('Error tracking achievement:', error);
      throw error;
    }
  }

  /**
   * Check and award badges based on achievements
   * @param {string} userId User ID
   * @param {string} achievementType Achievement type
   * @param {number} value Current value
   * @returns {Promise<Array>} Newly awarded badges
   */
  async checkAndAwardBadges(userId, achievementType, value) {
    try {
      const db = getDb();
      const newBadges = [];

      // Find badge type matching achievement
      const badgeType = Object.values(this.badges).find(b => b.type === achievementType);
      if (!badgeType) return newBadges;

      // Check each level
      for (const level of badgeType.levels) {
        if (value >= level.requirement) {
          // Check if badge already awarded
          const existing = await db.collection('user_badges').findOne({
            userId: new ObjectId(userId),
            badgeId: level.id,
          });

          if (!existing) {
            // Award new badge
            const badge = {
              userId: new ObjectId(userId),
              badgeId: level.id,
              badgeName: level.name,
              achievementType,
              value,
              awardedAt: new Date(),
            };

            await db.collection('user_badges').insertOne(badge);
            newBadges.push(badge);
          }
        }
      }

      return newBadges;
    } catch (error) {
      console.error('Error checking badges:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard for a specific metric
   * @param {string} metric Metric to rank by
   * @param {Object} options Pagination options
   * @returns {Promise<Array>} Leaderboard entries
   */
  async getLeaderboard(metric, { limit = 10, offset = 0 } = {}) {
    try {
      // Try to get from cache first
      const cacheKey = `leaderboard:${metric}:${limit}:${offset}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const db = getDb();

      const leaderboard = await db
        .collection('user_stats')
        .aggregate([
          {
            $sort: { [metric]: -1 },
          },
          {
            $skip: offset,
          },
          {
            $limit: limit,
          },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user',
            },
          },
          {
            $unwind: '$user',
          },
          {
            $project: {
              userId: 1,
              username: '$user.username',
              value: `$${metric}`,
              rank: { $add: [offset, { $indexOfArray: ['$_id', '$_id'] }] },
            },
          },
        ])
        .toArray();

      // Cache for 1 hour
      await this.redis.setex(cacheKey, 3600, JSON.stringify(leaderboard));

      return leaderboard;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get user's badges
   * @param {string} userId User ID
   * @returns {Promise<Array>} User badges
   */
  async getUserBadges(userId) {
    try {
      const db = getDb();

      return await db
        .collection('user_badges')
        .find({ userId: new ObjectId(userId) })
        .sort({ awardedAt: -1 })
        .toArray();
    } catch (error) {
      console.error('Error getting user badges:', error);
      throw error;
    }
  }

  /**
   * Get user's rank for a specific metric
   * @param {string} userId User ID
   * @param {string} metric Metric to check rank for
   * @returns {Promise<Object>} User's rank and value
   */
  async getUserRank(userId, metric) {
    try {
      const db = getDb();

      const stats = await db
        .collection('user_stats')
        .aggregate([
          {
            $sort: { [metric]: -1 },
          },
          {
            $group: {
              _id: null,
              items: { $push: '$$ROOT' },
            },
          },
          {
            $project: {
              rank: {
                $add: [{ $indexOfArray: ['$items.userId', new ObjectId(userId)] }, 1],
              },
              value: {
                $let: {
                  vars: {
                    userStats: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$items',
                            cond: { $eq: ['$$this.userId', new ObjectId(userId)] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: `$$userStats.${metric}`,
                },
              },
            },
          },
        ])
        .next();

      return stats || { rank: null, value: 0 };
    } catch (error) {
      console.error('Error getting user rank:', error);
      throw error;
    }
  }

  /**
   * Invalidate leaderboard cache for a metric
   * @param {string} metric Metric to invalidate
   */
  async invalidateLeaderboardCache(metric) {
    try {
      const keys = await this.redis.keys(`leaderboard:${metric}:*`);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch (error) {
      console.error('Error invalidating leaderboard cache:', error);
      throw error;
    }
  }
}

export default new AchievementManager();
