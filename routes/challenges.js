import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import rateLimiter from '../middleware/rate-limit.js';
import challengeManager from '../services/challenge-manager.js';
import gamificationManager from '../services/gamification-manager.js';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';

const router = express.Router();

// Validation schemas
const paginationSchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  offset: z.string().regex(/^\d+$/).transform(Number).default('0')
});

const challengeSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  type: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'SEASONAL', 'SPECIAL']),
  category: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  requirements: z.object({
    recipeCount: z.number().int().optional(),
    cuisineTypes: z.array(z.string()).optional(),
    ingredients: z.array(z.string()).optional(),
    techniques: z.array(z.string()).optional(),
    maxTime: z.number().int().optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional()
  }),
  rewards: z.object({
    points: z.number().int(),
    badge: z.string().optional(),
    achievement: z.string().optional(),
    premium: z.boolean().default(false)
  }),
  isActive: z.boolean().default(true)
});

const submissionSchema = z.object({
  recipeId: z.string(),
  notes: z.string().max(500).optional(),
  images: z.array(z.string()).optional()
});

// Get challenges with filters
router.get(
  '/',
  rateLimiter.api(),
  validateRequest({
    query: paginationSchema.extend({
      status: z.string().optional(),
      type: z.string().optional(),
      creatorId: z.string().optional(),
      search: z.string().optional(),
      sortBy: z.string().optional(),
      sortOrder: z.string().transform(Number).optional()
    })
  }),
  async (req, res) => {
    try {
      const result = await challengeManager.getChallenges(req.query);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Error getting challenges:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get challenges'
      });
    }
  }
);

// Get suggested challenges
router.get(
  '/suggested',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      const challenges = await challengeManager.getSuggestedChallenges(req.user.id);
      res.json({
        success: true,
        data: challenges
      });
    } catch (error) {
      console.error('Error getting suggested challenges:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get suggested challenges'
      });
    }
  }
);

// Get active challenges
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const now = new Date();

    const challenges = await db.collection('challenges')
      .aggregate([
        {
          $match: {
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gt: now }
          }
        },
        {
          $lookup: {
            from: 'challenge_participants',
            let: { challengeId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$challengeId', '$$challengeId'] },
                      { $eq: ['$userId', userId] }
                    ]
                  }
                }
              }
            ],
            as: 'participation'
          }
        },
        {
          $addFields: {
            isParticipating: { $gt: [{ $size: '$participation' }, 0] },
            progress: {
              $cond: {
                if: { $gt: [{ $size: '$participation' }, 0] },
                then: { $arrayElemAt: ['$participation.progress', 0] },
                else: 0
              }
            }
          }
        }
      ])
      .toArray();

    res.json(challenges);
  } catch (error) {
    throw error;
  }
});

// Get challenge by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const challengeId = new ObjectId(req.params.id);

    const challenge = await db.collection('challenges')
      .aggregate([
        { $match: { _id: challengeId } },
        {
          $lookup: {
            from: 'challenge_participants',
            let: { challengeId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$challengeId', '$$challengeId'] },
                      { $eq: ['$userId', userId] }
                    ]
                  }
                }
              }
            ],
            as: 'participation'
          }
        },
        {
          $lookup: {
            from: 'challenge_submissions',
            let: { challengeId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$challengeId', '$$challengeId'] } } },
              { $sort: { createdAt: -1 } },
              { $limit: 10 },
              {
                $lookup: {
                  from: 'users',
                  localField: 'userId',
                  foreignField: '_id',
                  as: 'user'
                }
              },
              { $unwind: '$user' }
            ],
            as: 'recentSubmissions'
          }
        },
        {
          $addFields: {
            isParticipating: { $gt: [{ $size: '$participation' }, 0] },
            progress: {
              $cond: {
                if: { $gt: [{ $size: '$participation' }, 0] },
                then: { $arrayElemAt: ['$participation.progress', 0] },
                else: 0
              }
            }
          }
        }
      ])
      .next();

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    res.json(challenge);
  } catch (error) {
    throw error;
  }
});

// Join challenge
router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const challengeId = new ObjectId(req.params.id);

    const challenge = await db.collection('challenges').findOne({
      _id: challengeId,
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gt: new Date() }
    });

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found or not active' });
    }

    const existingParticipation = await db.collection('challenge_participants')
      .findOne({ challengeId, userId });

    if (existingParticipation) {
      return res.status(400).json({ message: 'Already participating in this challenge' });
    }

    const participation = {
      challengeId,
      userId,
      progress: 0,
      submissions: [],
      joinedAt: new Date()
    };

    await db.collection('challenge_participants').insertOne(participation);

    res.status(201).json({
      message: 'Successfully joined the challenge',
      participation
    });
  } catch (error) {
    throw error;
  }
});

// Submit challenge entry
router.post('/:id/submit', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const challengeId = new ObjectId(req.params.id);
    const submission = submissionSchema.parse(req.body);

    const challenge = await db.collection('challenges').findOne({
      _id: challengeId,
      isActive: true,
      endDate: { $gt: new Date() }
    });

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found or ended' });
    }

    const participation = await db.collection('challenge_participants')
      .findOne({ challengeId, userId });

    if (!participation) {
      return res.status(400).json({ message: 'Not participating in this challenge' });
    }

    const submissionDoc = {
      challengeId,
      userId,
      recipeId: new ObjectId(submission.recipeId),
      notes: submission.notes,
      images: submission.images,
      status: 'PENDING',
      createdAt: new Date()
    };

    const result = await db.collection('challenge_submissions').insertOne(submissionDoc);

    // Update participation progress
    await db.collection('challenge_participants').updateOne(
      { challengeId, userId },
      {
        $inc: { progress: 1 },
        $push: { submissions: result.insertedId }
      }
    );

    res.status(201).json({
      message: 'Submission received successfully',
      submission: {
        _id: result.insertedId,
        ...submissionDoc
      }
    });
  } catch (error) {
    throw error;
  }
});

// Get user's challenge progress
router.get('/progress', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);

    const progress = await db.collection('challenge_participants')
      .aggregate([
        { $match: { userId } },
        {
          $lookup: {
            from: 'challenges',
            localField: 'challengeId',
            foreignField: '_id',
            as: 'challenge'
          }
        },
        { $unwind: '$challenge' },
        {
          $lookup: {
            from: 'challenge_submissions',
            localField: 'submissions',
            foreignField: '_id',
            as: 'submissionDetails'
          }
        }
      ])
      .toArray();

    res.json(progress);
  } catch (error) {
    throw error;
  }
});

// Get challenge leaderboard
router.get('/:id/leaderboard', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const challengeId = new ObjectId(req.params.id);
    const { page = 1, limit = 10 } = req.query;

    const leaderboard = await db.collection('challenge_participants')
      .aggregate([
        { $match: { challengeId } },
        { $sort: { progress: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            'user.password': 0,
            'user.email': 0
          }
        }
      ])
      .toArray();

    const total = await db.collection('challenge_participants')
      .countDocuments({ challengeId });

    res.json({
      leaderboard,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    throw error;
  }
});

// Admin: Create challenge
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const validatedData = challengeSchema.parse(req.body);

    const challenge = {
      ...validatedData,
      createdBy: new ObjectId(req.user.id),
      createdAt: new Date(),
      participantCount: 0
    };

    const result = await db.collection('challenges').insertOne(challenge);

    res.status(201).json({
      _id: result.insertedId,
      ...challenge
    });
  } catch (error) {
    throw error;
  }
});

// Admin: Update challenge
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const challengeId = new ObjectId(req.params.id);
    const validatedData = challengeSchema.parse(req.body);

    const result = await db.collection('challenges').findOneAndUpdate(
      { _id: challengeId },
      {
        $set: {
          ...validatedData,
          updatedBy: new ObjectId(req.user.id),
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

// Admin: Delete challenge
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const challengeId = new ObjectId(req.params.id);

    const result = await db.collection('challenges').deleteOne({ _id: challengeId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    // Clean up related data
    await Promise.all([
      db.collection('challenge_participants').deleteMany({ challengeId }),
      db.collection('challenge_submissions').deleteMany({ challengeId })
    ]);

    res.json({ message: 'Challenge deleted successfully' });
  } catch (error) {
    throw error;
  }
});

export default router; 