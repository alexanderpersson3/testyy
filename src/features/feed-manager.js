const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const auditLogger = require('./audit-logger');

class FeedManager {
  constructor() {
    this.activityTypes = {
      RECIPE_CREATE: 'recipe_create',
      RECIPE_UPDATE: 'recipe_update',
      RECIPE_LIKE: 'recipe_like',
      RECIPE_COMMENT: 'recipe_comment',
      USER_FOLLOW: 'user_follow',
      REVIEW_CREATE: 'review_create',
      FEATURED_RECIPE: 'featured_recipe',
    };

    this.feedCacheExpiry = 5 * 60 * 1000; // 5 minutes in milliseconds
  }

  async trackActivity(userId, type, data) {
    try {
      const db = getDb();
      const activity = {
        userId: new ObjectId(userId),
        type,
        data,
        createdAt: new Date(),
      };

      const result = await db.collection('activities').insertOne(activity);

      await auditLogger.log(
        auditLogger.eventTypes.FEED.ACTIVITY_CREATE,
        { userId, type, activityId: result.insertedId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return result;
    } catch (err) {
      console.error('Error tracking activity:', err);
      throw err;
    }
  }

  async getFeed(userId, options = {}) {
    try {
      const { limit = 20, offset = 0, includeFollowing = true, includeFeatured = true } = options;

      const db = getDb();

      // Get list of users being followed
      const following = includeFollowing ? await this._getFollowedUserIds(userId) : [];

      // Build aggregation pipeline
      const pipeline = [
        {
          $match: {
            $or: [
              { userId: { $in: following } },
              ...(includeFeatured ? [{ type: this.activityTypes.FEATURED_RECIPE }] : []),
            ],
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: offset },
        { $limit: limit },
        // Lookup user details
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        // Lookup recipe details if activity involves a recipe
        {
          $lookup: {
            from: 'recipes',
            localField: 'data.recipeId',
            foreignField: '_id',
            as: 'recipe',
          },
        },
        {
          $unwind: {
            path: '$recipe',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Project only necessary fields
        {
          $project: {
            _id: 1,
            type: 1,
            createdAt: 1,
            data: 1,
            user: {
              _id: 1,
              displayName: 1,
              profilePicUrl: 1,
            },
            recipe: {
              _id: 1,
              title: 1,
              description: 1,
              imageUrl: 1,
              likes: 1,
              commentCount: 1,
            },
          },
        },
      ];

      const activities = await db.collection('activities').aggregate(pipeline).toArray();

      // Add personalized recommendations if feed is too small
      if (activities.length < limit) {
        const recommendations = await this._getRecommendedContent(
          userId,
          limit - activities.length
        );
        activities.push(...recommendations);
      }

      return activities;
    } catch (err) {
      console.error('Error getting feed:', err);
      throw err;
    }
  }

  async _getFollowedUserIds(userId) {
    const db = getDb();
    const followers = await db
      .collection('followers')
      .find({ followerId: new ObjectId(userId) })
      .toArray();

    return [
      new ObjectId(userId), // Include user's own activities
      ...followers.map(f => f.followedId),
    ];
  }

  async _getRecommendedContent(userId, limit) {
    const db = getDb();

    // Get user's preferences and interests
    const user = await db
      .collection('users')
      .findOne({ _id: new ObjectId(userId) }, { projection: { preferences: 1 } });

    // Find popular recipes matching user's preferences
    const recommendedRecipes = await db
      .collection('recipes')
      .aggregate([
        {
          $match: {
            // Match recipes with user's dietary preferences
            ...(user.preferences.dietaryRestrictions?.length > 0
              ? {
                  'dietary.restrictions': {
                    $not: { $in: user.preferences.dietaryRestrictions },
                  },
                }
              : {}),
          },
        },
        {
          $addFields: {
            score: {
              $add: [{ $size: '$likes' }, { $multiply: [{ $size: '$comments' }, 2] }],
            },
          },
        },
        { $sort: { score: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
      ])
      .toArray();

    // Convert recipes to activity format
    return recommendedRecipes.map(recipe => ({
      type: this.activityTypes.FEATURED_RECIPE,
      createdAt: new Date(),
      data: {
        recipeId: recipe._id,
        reason: 'recommended',
      },
      user: {
        _id: recipe.user._id,
        displayName: recipe.user.displayName,
        profilePicUrl: recipe.user.profilePicUrl,
      },
      recipe: {
        _id: recipe._id,
        title: recipe.title,
        description: recipe.description,
        imageUrl: recipe.imageUrl,
        likes: recipe.likes,
        commentCount: recipe.comments?.length || 0,
      },
    }));
  }

  async getActivityById(activityId) {
    try {
      const db = getDb();
      return await db.collection('activities').findOne({
        _id: new ObjectId(activityId),
      });
    } catch (err) {
      console.error('Error getting activity:', err);
      throw err;
    }
  }

  async deleteActivity(activityId, userId) {
    try {
      const db = getDb();
      const activity = await this.getActivityById(activityId);

      if (!activity) {
        throw new Error('Activity not found');
      }

      if (activity.userId.toString() !== userId) {
        throw new Error('Unauthorized to delete this activity');
      }

      const result = await db.collection('activities').deleteOne({
        _id: new ObjectId(activityId),
      });

      await auditLogger.log(
        auditLogger.eventTypes.FEED.ACTIVITY_DELETE,
        { activityId, userId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return result;
    } catch (err) {
      console.error('Error deleting activity:', err);
      throw err;
    }
  }
}

module.exports = new FeedManager();
