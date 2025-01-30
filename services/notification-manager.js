import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';
import Redis from 'ioredis';

class NotificationManager {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.CACHE_TTL = 60 * 60; // 1 hour in seconds
    this.NOTIFICATIONS_CACHE_PREFIX = 'user:notifications:';

    // Notification types
    this.NOTIFICATION_TYPES = {
      FOLLOW: 'FOLLOW',
      LIKE: 'LIKE',
      COMMENT: 'COMMENT',
      NEW_RECIPE: 'NEW_RECIPE',
      MENTION: 'MENTION',
      CHALLENGE_INVITE: 'CHALLENGE_INVITE',
      CHALLENGE_COMPLETED: 'CHALLENGE_COMPLETED'
    };
  }

  /**
   * Create a notification
   * @param {Object} notification Notification data
   * @returns {Promise<Object>} Created notification
   */
  async createNotification({
    userId,
    type,
    senderUserId,
    recipeId = null,
    commentId = null,
    challengeId = null,
    extraData = {}
  }) {
    try {
      const db = getDb();
      const now = new Date();

      // Validate notification type
      if (!Object.values(this.NOTIFICATION_TYPES).includes(type)) {
        throw new Error(`Invalid notification type: ${type}`);
      }

      // Create notification
      const notification = {
        userId: new ObjectId(userId),
        type,
        senderUserId: new ObjectId(senderUserId),
        recipeId: recipeId ? new ObjectId(recipeId) : null,
        commentId: commentId ? new ObjectId(commentId) : null,
        challengeId: challengeId ? new ObjectId(challengeId) : null,
        read: false,
        createdAt: now,
        extraData
      };

      const result = await db.collection('notifications').insertOne(notification);
      notification._id = result.insertedId;

      // Invalidate cache
      await this.invalidateUserCache(userId);

      // Return created notification
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for user
   * @param {string} userId User ID
   * @param {Object} options Query options
   * @returns {Promise<Object>} Notifications and total count
   */
  async getUserNotifications(userId, {
    page = 1,
    limit = 20,
    unreadOnly = false
  } = {}) {
    try {
      const db = getDb();
      
      // Base query
      const query = {
        userId: new ObjectId(userId)
      };

      // Apply unread filter
      if (unreadOnly) {
        query.read = false;
      }

      // Calculate skip value
      const skip = (page - 1) * limit;

      // Get notifications with user details
      const [notifications, totalCount] = await Promise.all([
        db.collection('notifications').aggregate([
          { $match: query },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: 'senderUserId',
              foreignField: '_id',
              as: 'sender'
            }
          },
          { $unwind: '$sender' },
          {
            $lookup: {
              from: 'recipes',
              localField: 'recipeId',
              foreignField: '_id',
              as: 'recipe'
            }
          },
          {
            $unwind: {
              path: '$recipe',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $project: {
              type: 1,
              read: 1,
              createdAt: 1,
              extraData: 1,
              'sender.username': 1,
              'sender.avatar': 1,
              'recipe.title': 1,
              'recipe.slug': 1
            }
          }
        ]).toArray(),
        db.collection('notifications').countDocuments(query)
      ]);

      return {
        notifications,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        unreadCount: unreadOnly ? totalCount : await this.getUnreadCount(userId)
      };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   * @param {string} userId User ID
   * @returns {Promise<number>} Unread count
   */
  async getUnreadCount(userId) {
    try {
      const db = getDb();
      return await db.collection('notifications').countDocuments({
        userId: new ObjectId(userId),
        read: false
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }

  /**
   * Mark notifications as read
   * @param {string} userId User ID
   * @param {string[]} notificationIds Notification IDs to mark as read
   * @returns {Promise<Object>} Update result
   */
  async markAsRead(userId, notificationIds = []) {
    try {
      const db = getDb();
      const query = {
        userId: new ObjectId(userId)
      };

      // If specific notifications provided, only mark those as read
      if (notificationIds.length > 0) {
        query._id = {
          $in: notificationIds.map(id => new ObjectId(id))
        };
      }

      const result = await db.collection('notifications').updateMany(
        query,
        {
          $set: {
            read: true,
            updatedAt: new Date()
          }
        }
      );

      // Invalidate cache
      await this.invalidateUserCache(userId);

      return result;
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      throw error;
    }
  }

  /**
   * Create notifications for followers
   * @param {string} userId User ID
   * @param {string} type Notification type
   * @param {Object} data Additional notification data
   * @returns {Promise<void>}
   */
  async createFollowerNotifications(userId, type, data) {
    try {
      const db = getDb();

      // Get user's followers
      const followers = await db.collection('followers')
        .find({ followingId: new ObjectId(userId) })
        .toArray();

      // Create notifications in batches
      const notifications = followers.map(follower => ({
        userId: follower.followerId,
        type,
        senderUserId: new ObjectId(userId),
        ...data,
        read: false,
        createdAt: new Date()
      }));

      if (notifications.length > 0) {
        await db.collection('notifications').insertMany(notifications);

        // Invalidate cache for all followers
        await Promise.all(
          followers.map(follower => 
            this.invalidateUserCache(follower.followerId.toString())
          )
        );
      }
    } catch (error) {
      console.error('Error creating follower notifications:', error);
      throw error;
    }
  }

  /**
   * Delete old notifications
   * @param {number} days Number of days to keep
   * @returns {Promise<Object>} Delete result
   */
  async deleteOldNotifications(days = 90) {
    try {
      const db = getDb();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      return await db.collection('notifications').deleteMany({
        createdAt: { $lt: cutoffDate }
      });
    } catch (error) {
      console.error('Error deleting old notifications:', error);
      throw error;
    }
  }

  /**
   * Invalidate user cache
   * @param {string} userId User ID
   * @returns {Promise<void>}
   */
  async invalidateUserCache(userId) {
    try {
      await this.redis.del(`${this.NOTIFICATIONS_CACHE_PREFIX}${userId}`);
    } catch (error) {
      console.error('Error invalidating user cache:', error);
    }
  }
}

export default new NotificationManager(); 