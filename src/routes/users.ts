import express, { Response } from 'express';
import { check, validationResult } from 'express-validator';
import { Collection, Db, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

import { auth } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest, UserDocument } from '../types/auth.js';

const router = express.Router();

// Get user profile
router.get('/:id/profile', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const db = await connectToDatabase();
  const userId = new ObjectId(req.params.id);

  const user = await db.collection('users').findOne(
    { _id: userId },
    { projection: { password: 0 } }
  );

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Get user's recipes count
  const recipesCount = await db.collection('recipes').countDocuments({
    authorId: userId
  });

  // Get followers count
  const followersCount = await db.collection('user_followers').countDocuments({
    followedId: userId
  });

  // Get following count
  const followingCount = await db.collection('user_followers').countDocuments({
    followerId: userId
  });

  res.json({
    ...user,
    stats: {
      recipes: recipesCount,
      followers: followersCount,
      following: followingCount
    }
  });
}));

// Update user profile
router.patch('/profile',
  auth,
  [
    check('name').optional().trim(),
    check('bio').optional().trim(),
    check('instagramLink').optional().trim().isURL(),
    check('facebookLink').optional().trim().isURL(),
    check('website').optional().trim().isURL(),
    check('highlights').optional().isArray()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);

    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };

    await db.collection('users').updateOne(
      { _id: userId },
      { $set: updateData }
    );

    res.json({ success: true });
  })
);

// Follow a user
router.post('/:id/follow',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const followedId = new ObjectId(req.params.id);
    const followerId = new ObjectId(req.user!.id);

    // Check if user exists
    const userExists = await db.collection('users').findOne({ _id: followedId });
    if (!userExists) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already following
    const existingFollow = await db.collection('user_followers').findOne({
      followerId,
      followedId
    });

    if (existingFollow) {
      return res.status(400).json({ message: 'Already following this user' });
    }

    await db.collection('user_followers').insertOne({
      followerId,
      followedId,
      createdAt: new Date()
    });

    res.json({ success: true });
  })
);

// Unfollow a user
router.delete('/:id/follow',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const followedId = new ObjectId(req.params.id);
    const followerId = new ObjectId(req.user!.id);

    await db.collection('user_followers').deleteOne({
      followerId,
      followedId
    });

    res.json({ success: true });
  })
);

// Get user's followers
router.get('/:id/followers', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const db = await connectToDatabase();
  const userId = new ObjectId(req.params.id);

  const followers = await db.collection('user_followers')
    .aggregate([
      { $match: { followedId: userId } },
      {
        $lookup: {
          from: 'users',
          localField: 'followerId',
          foreignField: '_id',
          as: 'follower'
        }
      },
      { $unwind: '$follower' },
      {
        $project: {
          _id: 0,
          userId: '$follower._id',
          name: '$follower.name',
          email: '$follower.email',
          createdAt: 1
        }
      }
    ])
    .toArray();

  res.json({ followers });
}));

// Get user's following
router.get('/:id/following', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const db = await connectToDatabase();
  const userId = new ObjectId(req.params.id);

  const following = await db.collection('user_followers')
    .aggregate([
      { $match: { followerId: userId } },
      {
        $lookup: {
          from: 'users',
          localField: 'followedId',
          foreignField: '_id',
          as: 'followed'
        }
      },
      { $unwind: '$followed' },
      {
        $project: {
          _id: 0,
          userId: '$followed._id',
          name: '$followed.name',
          email: '$followed.email',
          createdAt: 1
        }
      }
    ])
    .toArray();

  res.json({ following });
}));

// Get popular users
router.get('/popular', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const db = await connectToDatabase();

  const popularUsers = await db.collection('users')
    .aggregate([
      {
        $lookup: {
          from: 'user_followers',
          localField: '_id',
          foreignField: 'followedId',
          as: 'followers'
        }
      },
      {
        $lookup: {
          from: 'recipes',
          localField: '_id',
          foreignField: 'authorId',
          as: 'recipes'
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          bio: 1,
          followersCount: { $size: '$followers' },
          recipesCount: { $size: '$recipes' }
        }
      },
      { $sort: { followersCount: -1 } },
      { $limit: 10 }
    ])
    .toArray();

  res.json({ users: popularUsers });
}));

// Delete user account
router.delete('/account',
  auth,
  [check('password').exists()],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const user = await db.collection<UserDocument>('users').findOne({
      _id: new ObjectId(req.user?.id)
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(req.body.password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    // Delete user's data
    await Promise.all([
      // Delete user account
      db.collection('users').deleteOne({ _id: new ObjectId(req.user?.id) }),
      // Delete user's refresh tokens
      db.collection('refreshTokens').deleteMany({ userId: new ObjectId(req.user?.id) }),
      // Delete user's recipes
      db.collection('recipes').deleteMany({ authorId: new ObjectId(req.user?.id) })
    ]);

    res.json({ success: true });
  })
);

export default router; 