import { getDb } from '../../config/db.js';
import { ObjectId } from 'mongodb';
import { getRedisClient } from '../redis.js';
import type { Redis as RedisClient } from 'ioredis';

export interface LeaderboardOptions {
  limit?: number;
  offset?: number;
}

export interface UserBadge {
  type: string;
  level: number;
  earnedAt: Date;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  rank: number;
}

export interface UserRank {
  currentRank: number;
  totalUsers: number;
  score: number;
  nextRank?: {
    score: number;
    remaining: number;
  };
}

interface BadgeLevel {
  level: number;
  threshold: number;
  name: string;
}

interface BadgeType {
  type: string;
  levels: BadgeLevel[];
}

class AchievementManager {
  private redis!: RedisClient;
  private readonly CACHE_TTL = 3600; // 1 hour

  private readonly badges: Record<string, BadgeType> = {
    RECIPE_CREATOR: {
      type: 'recipes_created',
      levels: [
        { level: 1, threshold: 1, name: 'Recipe Novice' },
        { level: 2, threshold: 5, name: 'Recipe Enthusiast' },
        { level: 3, threshold: 25, name: 'Recipe Master' },
        { level: 4, threshold: 100, name: 'Recipe Legend' }
      ]
    },
    LIKES_RECEIVED: {
      type: 'total_likes',
      levels: [
        { level: 1, threshold: 10, name: 'Rising Star' },
        { level: 2, threshold: 50, name: 'Community Favorite' },
        { level: 3, threshold: 250, name: 'Trending Chef' },
        { level: 4, threshold: 1000, name: 'Culinary Influencer' }
      ]
    },
    DAILY_STREAK: {
      type: 'daily_streak',
      levels: [
        { level: 1, threshold: 7, name: 'Weekly Chef' },
        { level: 2, threshold: 30, name: 'Dedicated Chef' },
        { level: 3, threshold: 90, name: 'Consistent Chef' },
        { level: 4, threshold: 365, name: 'Chef of the Year' }
      ]
    }
  };

  async initialize(): Promise<void> {
    try {
      this.redis = await getRedisClient();
    } catch (err) {
      console.error('Failed to initialize Redis client:', err);
      throw err;
    }
  }

  constructor() {
    this.initialize().catch(err => {
      console.error('Failed to initialize Redis client:', err);
      throw err;
    });
  }

  async getLeaderboard(
    metric: string,
    options: LeaderboardOptions = {}
  ): Promise<LeaderboardEntry[]> {
    const { limit = 10, offset = 0 } = options;
    const cacheKey = `leaderboard:${metric}:${limit}:${offset}`;

    // Try to get from cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const db = await getDb();
    const pipeline = [
      { $sort: { [`metrics.${metric}`]: -1 } },
      { $skip: offset },
      { $limit: limit },
      {
        $project: {
          userId: '$_id',
          username: '$username',
          score: `$metrics.${metric}`,
          rank: { $add: [offset, { $indexOfArray: ['$_id', '$_id'] }, 1] }
        }
      }
    ];

    const leaderboard = await db
      .collection('users')
      .aggregate(pipeline)
      .toArray() as LeaderboardEntry[];

    // Cache the result
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(leaderboard));

    return leaderboard;
  }

  async getUserBadges(userId: string): Promise<UserBadge[]> {
    const db = await getDb();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { badges: 1 } }
    );

    return user?.badges || [];
  }

  async getUserRank(userId: string, metric: string): Promise<UserRank> {
    const db = await getDb();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { [`metrics.${metric}`]: 1 } }
    );

    if (!user) {
      throw new Error('User not found');
    }

    const score = user.metrics?.[metric] || 0;
    const totalUsers = await db.collection('users').countDocuments();
    const higherScores = await db.collection('users').countDocuments({
      [`metrics.${metric}`]: { $gt: score }
    });

    const currentRank = higherScores + 1;
    const nextScore = await db.collection('users').findOne(
      { [`metrics.${metric}`]: { $gt: score } },
      { sort: { [`metrics.${metric}`]: 1 }, projection: { [`metrics.${metric}`]: 1 } }
    );

    const rank: UserRank = {
      currentRank,
      totalUsers,
      score
    };

    if (nextScore) {
      rank.nextRank = {
        score: nextScore.metrics[metric],
        remaining: nextScore.metrics[metric] - score
      };
    }

    return rank;
  }

  async trackAchievement(
    userId: string,
    achievementType: string,
    value: number
  ): Promise<{ badges: UserBadge[]; newBadges: UserBadge[] }> {
    const db = await getDb();
    const badgeType = Object.values(this.badges).find((badge: BadgeType) => badge.type === achievementType);

    if (!badgeType) {
      throw new Error('Invalid achievement type');
    }

    // Update metrics
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $inc: { [`metrics.${achievementType}`]: value },
        $setOnInsert: { badges: [] }
      },
      { upsert: true }
    );

    // Check for new badges
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { metrics: 1, badges: 1 } }
    );

    const currentValue = user?.metrics?.[achievementType] || 0;
    const existingBadges = user?.badges || [];
    const newBadges: UserBadge[] = [];

    for (const level of badgeType.levels) {
      if (
        currentValue >= level.threshold &&
        !existingBadges.some((badge: UserBadge) => badge.type === achievementType && badge.level === level.level)
      ) {
        const badge: UserBadge = {
          type: achievementType,
          level: level.level,
          earnedAt: new Date()
        };
        newBadges.push(badge);
      }
    }

    if (newBadges.length > 0) {
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $push: { badges: { $each: newBadges } } } as any
      );
    }

    return {
      badges: [...existingBadges, ...newBadges],
      newBadges
    };
  }
}

export default new AchievementManager(); 