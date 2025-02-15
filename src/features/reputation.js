const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const auth = require('../middleware/auth');
const { getDb } = require('../db');

// Constants for reputation points
const REPUTATION_POINTS = {
  RECIPE_CREATED: 10,
  RECIPE_LIKED: 2,
  COMMENT_RECEIVED: 1,
  RECIPE_REMIXED: 5,
  FOLLOWER_GAINED: 3,
};

// Get user's reputation
router.get('/users/:userId/reputation', async (req, res) => {
  try {
    const db = getDb();
    const { userId } = req.params;

    const user = await db.collection('users').findOne({
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
      // Count published recipes
      db.collection('recipes').countDocuments({
        userId: new ObjectId(userId),
        status: 'published',
      }),
      // Count likes received
      db.collection('likes').countDocuments({
        recipeId: {
          $in: await getRecipeIds(userId),
        },
      }),
      // Count comments received
      db.collection('comments').countDocuments({
        recipeId: {
          $in: await getRecipeIds(userId),
        },
      }),
      // Count recipe remixes
      db.collection('recipes').countDocuments({
        originalRecipeId: {
          $in: await getRecipeIds(userId),
        },
        isVersion: true,
      }),
      // Count followers
      db.collection('followers').countDocuments({
        followingId: new ObjectId(userId),
      }),
    ]);

    // Calculate total reputation
    const reputation = {
      total: 0,
      breakdown: {
        recipes: recipeCount * REPUTATION_POINTS.RECIPE_CREATED,
        likes: likeCount * REPUTATION_POINTS.RECIPE_LIKED,
        comments: commentCount * REPUTATION_POINTS.COMMENT_RECEIVED,
        remixes: remixCount * REPUTATION_POINTS.RECIPE_REMIXED,
        followers: followerCount * REPUTATION_POINTS.FOLLOWER_GAINED,
      },
    };

    reputation.total = Object.values(reputation.breakdown).reduce((a, b) => a + b, 0);

    // Get user's rank
    const rank = await calculateUserRank(reputation.total);

    res.json({
      success: true,
      data: {
        ...reputation,
        rank,
        userId,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching reputation',
    });
  }
});

// Get reputation leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const users = await db
      .collection('users')
      .aggregate([
        // Join with recipes
        {
          $lookup: {
            from: 'recipes',
            localField: '_id',
            foreignField: 'userId',
            as: 'recipes',
          },
        },
        // Calculate reputation components
        {
          $addFields: {
            recipePoints: {
              $multiply: [{ $size: '$recipes' }, REPUTATION_POINTS.RECIPE_CREATED],
            },
          },
        },
        // Join with followers
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
        // Calculate total reputation
        {
          $addFields: {
            totalReputation: {
              $add: ['$recipePoints', '$followerPoints'],
            },
          },
        },
        // Sort by total reputation
        { $sort: { totalReputation: -1 } },
        // Paginate
        { $skip: skip },
        { $limit: parseInt(limit) },
        // Project final fields
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
      .toArray();

    const total = await db.collection('users').countDocuments();

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page: parseInt(page),
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching leaderboard',
    });
  }
});

// Helper function to get user's recipe IDs
async function getRecipeIds(userId) {
  const db = getDb();
  const recipes = await db
    .collection('recipes')
    .find({ userId: new ObjectId(userId) }, { projection: { _id: 1 } })
    .toArray();
  return recipes.map(recipe => recipe._id);
}

// Helper function to calculate user rank
async function calculateUserRank(reputation) {
  if (reputation < 50) return 'Novice Chef';
  if (reputation < 200) return 'Home Cook';
  if (reputation < 500) return 'Kitchen Master';
  if (reputation < 1000) return 'Culinary Expert';
  if (reputation < 2000) return 'Recipe Guru';
  return 'Master Chef';
}

module.exports = router;
