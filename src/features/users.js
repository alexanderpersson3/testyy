const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const auth = require('../middleware/auth');
const { body, query } = require('express-validator');
const { validateRequest } = require('../middleware/validate-request');
const userManager = require('../services/user-manager');
const rateLimiter = require('../middleware/rate-limit');
const { z } = require('zod');
const elasticClient = require('../services/elastic-client');

// Validation middleware
const validateProfileUpdate = [
  body('displayName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Display name must be between 2 and 50 characters'),
  body('bio')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  body('profilePicUrl').optional().isURL().withMessage('Invalid profile picture URL'),
];

const validatePreferences = [
  body('dietaryRestrictions').optional().isArray(),
  body('measurementUnits').optional().isIn(['metric', 'imperial']),
  body('language').optional().isString().isLength({ min: 2, max: 5 }),
  body('notifications').optional().isObject(),
  body('theme').optional().isIn(['light', 'dark']),
  body('privacySettings').optional().isObject(),
];

// Validation schemas
const postalCodeSchema = z.object({
  postalCode: z.string().min(1).max(10),
});

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional().nullable(),
  socialLinks: z
    .object({
      instagram: z.string().optional(),
      twitter: z.string().optional(),
      facebook: z.string().optional(),
    })
    .optional(),
  preferences: z
    .object({
      emailNotifications: z.boolean().optional(),
      pushNotifications: z.boolean().optional(),
      privateProfile: z.boolean().optional(),
    })
    .optional(),
});

// User profile schema
const profileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional().nullable(),
  location: z.string().max(100).optional(),
  avatar: z.string().url().optional(),
  preferences: z
    .object({
      cuisine: z.array(z.string()).optional(),
      dietaryRestrictions: z.array(z.string()).optional(),
      cookingLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
      servingSize: z.number().min(1).max(20).optional(),
      measurementSystem: z.enum(['METRIC', 'IMPERIAL']).optional(),
    })
    .optional(),
});

// Get user profile
router.get('/:userId', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.params.userId);

    const user = await db
      .collection('users')
      .aggregate([
        { $match: { _id: userId } },
        {
          $lookup: {
            from: 'recipes',
            localField: '_id',
            foreignField: 'userId',
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
          $lookup: {
            from: 'followers',
            localField: '_id',
            foreignField: 'followerId',
            as: 'following',
          },
        },
        {
          $project: {
            username: 1,
            displayName: 1,
            bio: 1,
            website: 1,
            location: 1,
            avatar: 1,
            createdAt: 1,
            preferences: 1,
            stats: {
              recipeCount: { $size: '$recipes' },
              followerCount: { $size: '$followers' },
              followingCount: { $size: '$following' },
              totalLikes: {
                $reduce: {
                  input: '$recipes',
                  initialValue: 0,
                  in: { $add: ['$$value', { $ifNull: ['$$this.likeCount', 0] }] },
                },
              },
            },
          },
        },
      ])
      .next();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if requesting user follows this user
    let isFollowing = false;
    if (req.user) {
      isFollowing =
        (await db.collection('followers').findOne({
          followerId: new ObjectId(req.user.id),
          followedId: userId,
        })) !== null;
    }

    res.json({
      ...user,
      isFollowing,
    });
  } catch (error) {
    throw error;
  }
});

// Update user profile
router.put('/profile', auth.authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const validatedData = profileSchema.parse(req.body);

    const updateResult = await db.collection('users').findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          ...validatedData,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    // Update in Elasticsearch
    await elasticClient.update({
      index: 'users',
      id: userId.toString(),
      body: {
        doc: {
          ...validatedData,
          updatedAt: new Date(),
        },
      },
    });

    res.json(updateResult.value);
  } catch (error) {
    throw error;
  }
});

// Update user preferences
router.put('/preferences', auth, validatePreferences, validateRequest, async (req, res) => {
  try {
    const result = await userManager.updatePreferences(req.user.id, req.body);
    res.json({
      success: true,
      message: 'Preferences updated successfully',
    });
  } catch (err) {
    console.error('Error updating preferences:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error updating preferences',
    });
  }
});

// Follow user
router.post('/:userId/follow', auth.authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const followerId = new ObjectId(req.user.id);
    const followedId = new ObjectId(req.params.userId);

    if (followerId.equals(followedId)) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const targetUser = await db.collection('users').findOne({ _id: followedId });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existingFollow = await db.collection('followers').findOne({
      followerId,
      followedId,
    });

    if (existingFollow) {
      // Unfollow
      await db.collection('followers').deleteOne({ _id: existingFollow._id });
      res.json({ following: false });
    } else {
      // Follow
      await db.collection('followers').insertOne({
        followerId,
        followedId,
        createdAt: new Date(),
      });

      // Create notification
      await db.collection('notifications').insertOne({
        userId: followedId,
        type: 'NEW_FOLLOWER',
        actorId: followerId,
        read: false,
        createdAt: new Date(),
      });

      res.json({ following: true });
    }
  } catch (error) {
    throw error;
  }
});

// Unfollow user
router.delete('/:userId/follow', auth.authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const followerId = new ObjectId(req.user._id);
    const followedId = new ObjectId(req.params.userId);

    const result = await db.collection('followers').deleteOne({
      followerId,
      followedId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Follow relationship not found' });
    }

    res.json({ message: 'Successfully unfollowed user' });
  } catch (error) {
    throw error;
  }
});

// Get user's followers
router.get('/:userId/followers', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.params.userId);
    const { page = 1, limit = 20 } = req.query;

    const followers = await db
      .collection('followers')
      .aggregate([
        { $match: { followedId: userId } },
        { $sort: { createdAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'users',
            localField: 'followerId',
            foreignField: '_id',
            as: 'follower',
          },
        },
        { $unwind: '$follower' },
        {
          $project: {
            _id: '$follower._id',
            username: '$follower.username',
            displayName: '$follower.displayName',
            avatar: '$follower.avatar',
            followedAt: '$createdAt',
          },
        },
      ])
      .toArray();

    const total = await db.collection('followers').countDocuments({ followedId: userId });

    res.json({
      followers,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Get user's following
router.get('/:userId/following', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.params.userId);
    const { page = 1, limit = 20 } = req.query;

    const following = await db
      .collection('followers')
      .aggregate([
        { $match: { followerId: userId } },
        { $sort: { createdAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'users',
            localField: 'followedId',
            foreignField: '_id',
            as: 'followed',
          },
        },
        { $unwind: '$followed' },
        {
          $project: {
            _id: '$followed._id',
            username: '$followed.username',
            displayName: '$followed.displayName',
            avatar: '$followed.avatar',
            followedAt: '$createdAt',
          },
        },
      ])
      .toArray();

    const total = await db.collection('followers').countDocuments({ followerId: userId });

    res.json({
      following,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Get user's recipes
router.get('/:userId/recipes', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.params.userId);
    const { page = 1, limit = 10, sort = 'date' } = req.query;

    const query = { userId };
    // Only show public recipes unless viewing own profile
    if (!req.user || req.user.id !== req.params.userId) {
      query.isPrivate = { $ne: true };
    }

    let sortQuery = { createdAt: -1 };
    if (sort === 'rating') sortQuery = { averageRating: -1 };
    if (sort === 'popularity') sortQuery = { likeCount: -1 };

    const recipes = await db
      .collection('recipes')
      .aggregate([
        { $match: query },
        { $sort: sortQuery },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
          $project: {
            title: 1,
            description: 1,
            image: 1,
            cookingTime: 1,
            difficulty: 1,
            averageRating: 1,
            likeCount: 1,
            commentCount: 1,
            createdAt: 1,
          },
        },
      ])
      .toArray();

    const total = await db.collection('recipes').countDocuments(query);

    res.json({
      recipes,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Get user's liked recipes
router.get('/:userId/likes', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.params.userId);
    const { page = 1, limit = 10 } = req.query;

    const likedRecipes = await db
      .collection('likes')
      .aggregate([
        { $match: { userId } },
        { $sort: { createdAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'recipes',
            localField: 'recipeId',
            foreignField: '_id',
            as: 'recipe',
          },
        },
        { $unwind: '$recipe' },
        {
          $lookup: {
            from: 'users',
            localField: 'recipe.userId',
            foreignField: '_id',
            as: 'author',
          },
        },
        { $unwind: '$author' },
        {
          $project: {
            _id: '$recipe._id',
            title: '$recipe.title',
            description: '$recipe.description',
            image: '$recipe.image',
            cookingTime: '$recipe.cookingTime',
            difficulty: '$recipe.difficulty',
            averageRating: '$recipe.averageRating',
            likedAt: '$createdAt',
            author: {
              _id: '$author._id',
              username: '$author.username',
              displayName: '$author.displayName',
              avatar: '$author.avatar',
            },
          },
        },
      ])
      .toArray();

    const total = await db.collection('likes').countDocuments({ userId });

    res.json({
      recipes: likedRecipes,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Get user's activity feed
router.get('/:userId/activity', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.params.userId);
    const { page = 1, limit = 20 } = req.query;

    const activities = await db
      .collection('activities')
      .aggregate([
        { $match: { userId } },
        { $sort: { createdAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'recipes',
            localField: 'recipeId',
            foreignField: '_id',
            as: 'recipe',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'targetUserId',
            foreignField: '_id',
            as: 'targetUser',
          },
        },
        {
          $project: {
            type: 1,
            createdAt: 1,
            recipe: { $arrayElemAt: ['$recipe', 0] },
            targetUser: { $arrayElemAt: ['$targetUser', 0] },
          },
        },
      ])
      .toArray();

    const total = await db.collection('activities').countDocuments({ userId });

    res.json({
      activities,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Get user's achievements
router.get('/:userId/achievements', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.params.userId);

    const achievements = await db
      .collection('achievements')
      .find({ userId })
      .sort({ unlockedAt: -1 })
      .toArray();

    res.json({ achievements });
  } catch (error) {
    throw error;
  }
});

// Update notification settings
router.put('/settings/notifications', auth.authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const settings = z
      .object({
        email: z.object({
          newFollower: z.boolean(),
          recipeLiked: z.boolean(),
          recipeCommented: z.boolean(),
          weeklyDigest: z.boolean(),
          priceAlerts: z.boolean(),
        }),
        push: z.object({
          newFollower: z.boolean(),
          recipeLiked: z.boolean(),
          recipeCommented: z.boolean(),
          priceAlerts: z.boolean(),
        }),
      })
      .parse(req.body);

    await db.collection('users').updateOne(
      { _id: userId },
      {
        $set: {
          notificationSettings: settings,
          updatedAt: new Date(),
        },
      }
    );

    res.json({ message: 'Notification settings updated successfully' });
  } catch (error) {
    throw error;
  }
});

// Search users
router.get(
  '/search',
  auth,
  rateLimiter.search(),
  query('q').isString().trim().notEmpty(),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('offset').optional().isInt({ min: 0 }),
  validateRequest,
  async (req, res) => {
    try {
      const { q, limit = 10, offset = 0 } = req.query;
      const users = await userManager.searchUsers(q, parseInt(limit), parseInt(offset));
      res.json({
        success: true,
        data: users,
      });
    } catch (err) {
      console.error('Error searching users:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error searching users',
      });
    }
  }
);

// Update postal code
router.post(
  '/location',
  auth,
  rateLimiter.api(),
  validateRequest({ body: postalCodeSchema }),
  async (req, res) => {
    try {
      const location = await userManager.updateLocation(req.user.id, req.body.postalCode);
      res.json({
        success: true,
        data: location,
      });
    } catch (err) {
      console.error('Error updating user location:', err);
      res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  }
);

module.exports = router;
