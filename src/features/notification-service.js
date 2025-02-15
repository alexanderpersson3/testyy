const { getDb } = require('../db');
const { ObjectId } = require('mongodb');

class NotificationService {
  constructor() {
    this.NOTIFICATION_TYPES = {
      RECIPE_COMMENT: 'recipe_comment',
      RECIPE_LIKE: 'recipe_like',
      NEW_FOLLOWER: 'new_follower',
      SYSTEM_ANNOUNCEMENT: 'system_announcement',
      RECIPE_FEATURED: 'recipe_featured',
      COMMENT_REPLY: 'comment_reply',
      COLLECTION_SHARED: 'collection_shared',
      PRICE_ALERT: 'price_alert',
    };
  }

  async createNotification(userId, type, data, metadata = {}) {
    const db = getDb();
    const notification = {
      user_id: new ObjectId(userId),
      type,
      data,
      metadata,
      is_read: false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await db.collection('notifications').insertOne(notification);
    return result.insertedId;
  }

  async getNotifications(userId, page = 1, limit = 20, filter = {}) {
    const db = getDb();
    const skip = (page - 1) * limit;

    const query = {
      user_id: new ObjectId(userId),
      ...filter,
    };

    const pipeline = [
      { $match: query },
      { $sort: { created_at: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'data.actor_id',
          foreignField: '_id',
          as: 'actor',
        },
      },
      {
        $unwind: {
          path: '$actor',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          type: 1,
          data: 1,
          metadata: 1,
          is_read: 1,
          created_at: 1,
          'actor.username': 1,
          'actor.name': 1,
          'actor.avatar_url': 1,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    const notifications = await db.collection('notifications').aggregate(pipeline).toArray();

    const totalCount = await db.collection('notifications').countDocuments(query);

    return {
      notifications,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
      },
    };
  }

  async markAsRead(userId, notificationIds) {
    const db = getDb();
    const objectIds = notificationIds.map(id => new ObjectId(id));

    await db.collection('notifications').updateMany(
      {
        _id: { $in: objectIds },
        user_id: new ObjectId(userId),
      },
      {
        $set: {
          is_read: true,
          updated_at: new Date(),
        },
      }
    );
  }

  async markAllAsRead(userId) {
    const db = getDb();
    await db.collection('notifications').updateMany(
      { user_id: new ObjectId(userId) },
      {
        $set: {
          is_read: true,
          updated_at: new Date(),
        },
      }
    );
  }

  async deleteNotification(userId, notificationId) {
    const db = getDb();
    await db.collection('notifications').deleteOne({
      _id: new ObjectId(notificationId),
      user_id: new ObjectId(userId),
    });
  }

  async getUnreadCount(userId) {
    const db = getDb();
    return await db.collection('notifications').countDocuments({
      user_id: new ObjectId(userId),
      is_read: false,
    });
  }

  async updateNotificationPreferences(userId, preferences) {
    const db = getDb();
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          notification_preferences: preferences,
          updated_at: new Date(),
        },
      }
    );
  }

  async getNotificationPreferences(userId) {
    const db = getDb();
    const user = await db
      .collection('users')
      .findOne({ _id: new ObjectId(userId) }, { projection: { notification_preferences: 1 } });
    return user?.notification_preferences || this.getDefaultPreferences();
  }

  getDefaultPreferences() {
    return {
      email: {
        recipe_comment: true,
        recipe_like: false,
        new_follower: true,
        system_announcement: true,
        recipe_featured: true,
        comment_reply: true,
        collection_shared: true,
        price_alert: true,
      },
      push: {
        recipe_comment: true,
        recipe_like: true,
        new_follower: true,
        system_announcement: true,
        recipe_featured: true,
        comment_reply: true,
        collection_shared: true,
        price_alert: true,
      },
    };
  }
}

module.exports = new NotificationService();
