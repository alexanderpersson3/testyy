import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { auth } from '../middleware/auth';
import { db } from '../db';
import { asyncHandler } from '../utils/asyncHandler';

const router = express.Router();

// Constants for reputation points
const REPUTATION_POINTS = {
  RECIPE_CREATED: 10,
  RECIPE_LIKED: 2,
  COMMENT_RECEIVED: 1,
  RECIPE_REMIXED: 5,
  FOLLOWER_GAINED: 3,
};

interface ReputationBreakdown {
    recipes: number;
    likes: number;
    comments: number;
    remixes: number;
    followers: number;
}
  
interface ReputationData {
    total: number;
    breakdown: ReputationBreakdown;
    rank: string;
    userId: string;
}

interface LeaderboardUser {
    _id: ObjectId;
    name: string;
    totalReputation: number;
    recipeCount: number;
    followerCount: number;
}
  
interface LeaderboardResponse {
    users: LeaderboardUser[];
    pagination: {
      total: number;
      page: number;
      totalPages: number;
    };
}

// Get user's reputation
router.get('/users/:userId/reputation', asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    const user = await (await db.getDb()).collection('users').findOne({
      _id: new ObjectId(userId),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Calculate reputation components
    const [recipeCount, likeCount, commentCount, remixCount, followerCount] = await Promise.all([
      (await db.getDb()).collection('recipes').countDocuments({
        userId: new ObjectId(userId),
        status: 'published',
      }),
      (await db.getDb()).collection('likes').countDocuments({
        recipeId: {
          $in: await getRecipeIds(userId),
        },
      }),
      (await db.getDb()).collection('comments').countDocuments({
        recipeId: {
          $in: await getRecipeIds(userId),
        },
      }),
      (await db.getDb()).collection('recipes').countDocuments({
        originalRecipeId: {
          $in: await getRecipeIds(userId),
        },
        isVersion: true,
      }),
      (await db.getDb()).collection('followers').countDocuments({
        followingId: new ObjectId(userId),
      }),
    ]);

    // Calculate total reputation
    const reputation: ReputationData = {
      total: 0,
      breakdown: {
        recipes: recipeCount * REPUTATION_POINTS.RECIPE_CREATED,
        likes: likeCount * REPUTATION_POINTS.RECIPE_LIKED,
        comments: commentCount * REPUTATION_POINTS.COMMENT_RECEIVED,
        remixes: remixCount * REPUTATION_POINTS.RECIPE_REMIXED,
        followers: followerCount * REPUTATION_POINTS.FOLLOWER_GAINED,
      },
      rank: '',
      userId: userId
    };

    reputation.total = Object.values(reputation.breakdown).reduce((a, b) => a + b, 0);

    // Get user's rank
    reputation.rank = await calculateUserRank(reputation.total);

    res.json({
      success: true,
      data: reputation,
    });
}));

// Get reputation leaderboard
router.get('/leaderboard', asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const users: LeaderboardUser[] = await (await db.getDb()).collection('users')
      .aggregate([
        {
          $lookup: {
            from: 'recipes',
            localField: '_id',
            foreignField: 'userId',
            as: 'recipes',
          },
        },
        {
          $addFields: {
            recipePoints: {
              $multiply: [{ $size: '$recipes' }, REPUTATION_POINTS.RECIPE_CREATED],
            },
          },
        },
        {
          $lookup: {
            from: 'followers',
            localField: '_id',
            foreignField: 'followingId',
            as: 'followers',
          },
        },
        {
          $addFields: {
            followerPoints: {
              $multiply: [{ $size: '$followers' }, REPUTATION_POINTS.FOLLOWER_GAINED],
            },
          },
        },
        {
          $addFields: {
            totalReputation: {
              $add: ['$recipePoints', '$followerPoints'],
            },
          },
        },
        { $sort: { totalReputation: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit as string) },
        {
          $project: {
            _id: 1,
            name: 1,
            totalReputation: 1,
            recipeCount: { $size: '$recipes' },
            followerCount: { $size: '$followers' },
          },
        },
      ])
      .toArray() as LeaderboardUser[];

    const total = await (await db.getDb()).collection('users').countDocuments();

    const response: LeaderboardResponse = {
      users,
      pagination: {
        total,
        page: parseInt(page as string),
        totalPages: Math.ceil(total / Number(limit)),
      },
    }

    res.json({
      success: true,
      data: response
    });
}));

// Helper function to get user's recipe IDs
async function getRecipeIds(userId: string): Promise<ObjectId[]> {
  const recipes = await (await db.getDb())
    .collection('recipes')
    .find({ userId: new ObjectId(userId) }, { projection: { _id: 1 } })
    .toArray();
  return recipes.map(recipe => recipe._id);
}

// Helper function to calculate user rank
async function calculateUserRank(reputation: number): Promise<string> {
  if (reputation < 50) return 'Novice Chef';
  if (reputation < 200) return 'Home Cook';
  if (reputation < 500) return 'Kitchen Master';
  if (reputation < 1000) return 'Culinary Expert';
  if (reputation < 2000) return 'Recipe Guru';
  return 'Master Chef';
}

export default router;