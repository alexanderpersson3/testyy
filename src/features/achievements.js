import { Router } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import rateLimiter from '../middleware/rate-limit.js';

const router = Router();

// Validation schemas
const achievementSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  category: z.enum(['RECIPES', 'SOCIAL', 'CHALLENGES', 'COLLECTIONS', 'SPECIAL']),
  type: z.enum(['COUNTER', 'MILESTONE', 'COLLECTION', 'STREAK']),
  requirements: z.object({
    target: z.number().int().positive(),
    metric: z.string(),
    conditions: z
      .array(
        z.object({
          field: z.string(),
          operator: z.enum(['equals', 'gt', 'gte', 'lt', 'lte', 'in', 'contains']),
          value: z.any(),
        })
      )
      .optional(),
  }),
  rewards: z.object({
    points: z.number().int().nonnegative(),
    badge: z
      .object({
        name: z.string(),
        icon: z.string().url(),
        color: z.string(),
      })
      .optional(),
    unlocks: z.array(z.string()).optional(),
  }),
  isActive: z.boolean().default(true),
  order: z.number().int().nonnegative().optional(),
});

// Admin: Create achievement
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const validatedData = achievementSchema.parse(req.body);

    const achievement = {
      ...validatedData,
      createdBy: new ObjectId(req.user.id),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('achievements').insertOne(achievement);

    const createdAchievement = await db.collection('achievements').findOne({
      _id: result.insertedId,
    });

    res.status(201).json(createdAchievement);
  } catch (error) {
    throw error;
  }
});

// Get all achievements
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { category, isActive = true } = req.query;

    const query = { isActive: isActive === 'true' };
    if (category) query.category = category;

    // Get user's progress
    const userProgress = await db
      .collection('user_achievements')
      .find({ userId: new ObjectId(req.user.id) })
      .toArray();

    const progressMap = new Map(userProgress.map(p => [p.achievementId.toString(), p]));

    // Get achievements with progress
    const achievements = await db
      .collection('achievements')
      .find(query)
      .sort({ order: 1, category: 1 })
      .toArray();

    const achievementsWithProgress = achievements.map(achievement => ({
      ...achievement,
      progress: progressMap.get(achievement._id.toString()) || {
        status: 'NOT_STARTED',
        currentValue: 0,
        completedAt: null,
      },
    }));

    res.json(achievementsWithProgress);
  } catch (error) {
    throw error;
  }
});

// Get user's achievements
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const targetUserId = new ObjectId(req.params.userId);
    const { status, category } = req.query;

    const query = {
      userId: targetUserId,
    };
    if (status) query.status = status;

    const userAchievements = await db
      .collection('user_achievements')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'achievements',
            localField: 'achievementId',
            foreignField: '_id',
            as: 'achievement',
          },
        },
        { $unwind: '$achievement' },
        {
          $match: category ? { 'achievement.category': category } : {},
        },
        {
          $sort: {
            'achievement.category': 1,
            'achievement.order': 1,
            completedAt: -1,
          },
        },
      ])
      .toArray();

    // Get user stats
    const stats = await db
      .collection('user_achievements')
      .aggregate([
        { $match: { userId: targetUserId } },
        {
          $group: {
            _id: null,
            totalPoints: {
              $sum: {
                $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$achievement.rewards.points', 0],
              },
            },
            completedCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0],
              },
            },
            inProgressCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'IN_PROGRESS'] }, 1, 0],
              },
            },
          },
        },
      ])
      .next();

    res.json({
      achievements: userAchievements,
      stats: stats || {
        totalPoints: 0,
        completedCount: 0,
        inProgressCount: 0,
      },
    });
  } catch (error) {
    throw error;
  }
});

// Get user's badges
router.get('/badges', authenticateToken, async (req, res) => {
  try {
    const db = getDb();

    const badges = await db
      .collection('user_achievements')
      .aggregate([
        {
          $match: {
            userId: new ObjectId(req.user.id),
            status: 'COMPLETED',
            'achievement.rewards.badge': { $exists: true },
          },
        },
        {
          $lookup: {
            from: 'achievements',
            localField: 'achievementId',
            foreignField: '_id',
            as: 'achievement',
          },
        },
        { $unwind: '$achievement' },
        {
          $project: {
            badge: '$achievement.rewards.badge',
            achievedAt: '$completedAt',
            category: '$achievement.category',
          },
        },
        { $sort: { achievedAt: -1 } },
      ])
      .toArray();

    res.json(badges);
  } catch (error) {
    throw error;
  }
});

// Update achievement progress
router.post('/progress/:achievementId', authenticateToken, rateLimiter.high(), async (req, res) => {
  try {
    const db = getDb();
    const achievementId = new ObjectId(req.params.achievementId);
    const { value } = z
      .object({
        value: z.number().int().nonnegative(),
      })
      .parse(req.body);

    // Get achievement details
    const achievement = await db.collection('achievements').findOne({
      _id: achievementId,
      isActive: true,
    });

    if (!achievement) {
      return res.status(404).json({ message: 'Achievement not found' });
    }

    // Update or create progress
    const progress = {
      userId: new ObjectId(req.user.id),
      achievementId,
      currentValue: value,
      status: value >= achievement.requirements.target ? 'COMPLETED' : 'IN_PROGRESS',
      updatedAt: new Date(),
    };

    if (progress.status === 'COMPLETED') {
      progress.completedAt = new Date();
    }

    const result = await db.collection('user_achievements').findOneAndUpdate(
      {
        userId: new ObjectId(req.user.id),
        achievementId,
      },
      {
        $set: progress,
      },
      {
        upsert: true,
        returnDocument: 'after',
      }
    );

    // If newly completed, create notification
    if (progress.status === 'COMPLETED' && !result.value.completedAt) {
      await db.collection('notifications').insertOne({
        userId: new ObjectId(req.user.id),
        type: 'ACHIEVEMENT_UNLOCKED',
        title: 'Achievement Unlocked!',
        message: `You've earned the "${achievement.name}" achievement!`,
        data: {
          achievementId,
          badge: achievement.rewards.badge,
        },
        createdAt: new Date(),
      });
    }

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

// Admin: Update achievement
router.patch('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const achievementId = new ObjectId(req.params.id);
    const updates = achievementSchema.partial().parse(req.body);

    const result = await db.collection('achievements').findOneAndUpdate(
      { _id: achievementId },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
          updatedBy: new ObjectId(req.user.id),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Achievement not found' });
    }

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

// Admin: Delete achievement
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const achievementId = new ObjectId(req.params.id);

    const result = await db.collection('achievements').findOneAndUpdate(
      { _id: achievementId },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
          updatedBy: new ObjectId(req.user.id),
        },
      }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Achievement not found' });
    }

    res.json({ message: 'Achievement deactivated successfully' });
  } catch (error) {
    throw error;
  }
});

// Get achievement leaderboard
router.get('/:id/leaderboard', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const achievementId = new ObjectId(req.params.id);
    const { limit = 10 } = req.query;

    const leaderboard = await db
      .collection('user_achievements')
      .aggregate([
        {
          $match: {
            achievementId,
            status: 'COMPLETED',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            username: '$user.username',
            displayName: '$user.displayName',
            avatar: '$user.avatar',
            completedAt: 1,
            currentValue: 1,
          },
        },
        { $sort: { completedAt: 1 } },
        { $limit: parseInt(limit) },
      ])
      .toArray();

    res.json(leaderboard);
  } catch (error) {
    throw error;
  }
});

export default router;
