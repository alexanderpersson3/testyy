import { Router } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
const { authenticateToken } = require('../middleware/auth');

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get user's notifications
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const { page = 1, limit = 20, unreadOnly = false, type } = req.query;

    const query = { userId };
    if (unreadOnly === 'true') query.read = false;
    if (type) query.type = type;

    const notifications = await db
      .collection('notifications')
      .aggregate([
        { $match: query },
        { $sort: { createdAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'users',
            localField: 'actorId',
            foreignField: '_id',
            as: 'actor',
          },
        },
        { $unwind: { path: '$actor', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'recipes',
            localField: 'recipeId',
            foreignField: '_id',
            as: 'recipe',
          },
        },
        { $unwind: { path: '$recipe', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            type: 1,
            read: 1,
            createdAt: 1,
            actor: {
              _id: '$actor._id',
              username: '$actor.username',
              displayName: '$actor.displayName',
              avatar: '$actor.avatar',
            },
            recipe: {
              _id: '$recipe._id',
              title: '$recipe.title',
              image: '$recipe.image',
            },
            comment: 1,
            rating: 1,
            priceAlert: 1,
          },
        },
      ])
      .toArray();

    const total = await db.collection('notifications').countDocuments(query);
    const unreadCount = await db.collection('notifications').countDocuments({
      userId,
      read: false,
    });

    res.json({
      notifications,
      total,
      unreadCount,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Mark notifications as read
router.put('/read', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const { ids } = z
      .object({
        ids: z.array(z.string()),
      })
      .parse(req.body);

    const result = await db.collection('notifications').updateMany(
      {
        _id: { $in: ids.map(id => new ObjectId(id)) },
        userId,
      },
      {
        $set: {
          read: true,
          readAt: new Date(),
        },
      }
    );

    res.json({
      modified: result.modifiedCount,
      message: 'Notifications marked as read',
    });
  } catch (error) {
    throw error;
  }
});

// Mark all notifications as read
router.put('/read/all', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);

    const result = await db.collection('notifications').updateMany(
      {
        userId,
        read: false,
      },
      {
        $set: {
          read: true,
          readAt: new Date(),
        },
      }
    );

    res.json({
      modified: result.modifiedCount,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    throw error;
  }
});

// Delete notification
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const notificationId = new ObjectId(req.params.id);

    const result = await db.collection('notifications').deleteOne({
      _id: notificationId,
      userId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    throw error;
  }
});

// Delete all notifications
router.delete('/', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);

    const result = await db.collection('notifications').deleteMany({ userId });

    res.json({
      deleted: result.deletedCount,
      message: 'All notifications deleted successfully',
    });
  } catch (error) {
    throw error;
  }
});

// Get notification preferences
router.get('/preferences', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);

    const user = await db
      .collection('users')
      .findOne({ _id: userId }, { projection: { notificationPreferences: 1 } });

    // Return default preferences if none set
    const defaultPreferences = {
      email: {
        newFollower: true,
        recipeLiked: true,
        recipeCommented: true,
        weeklyDigest: true,
        priceAlerts: true,
      },
      push: {
        newFollower: true,
        recipeLiked: true,
        recipeCommented: true,
        priceAlerts: true,
      },
    };

    res.json(user?.notificationPreferences || defaultPreferences);
  } catch (error) {
    throw error;
  }
});

// Update notification preferences
router.put('/preferences', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const preferences = z
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
          notificationPreferences: preferences,
          updatedAt: new Date(),
        },
      }
    );

    res.json({
      message: 'Notification preferences updated successfully',
      preferences,
    });
  } catch (error) {
    throw error;
  }
});

// Subscribe to push notifications
router.post('/push/subscribe', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const subscription = z
      .object({
        endpoint: z.string().url(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
      })
      .parse(req.body);

    await db.collection('push_subscriptions').updateOne(
      {
        userId,
        endpoint: subscription.endpoint,
      },
      {
        $set: {
          ...subscription,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    res.json({ message: 'Push subscription saved successfully' });
  } catch (error) {
    throw error;
  }
});

// Unsubscribe from push notifications
router.post('/push/unsubscribe', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const { endpoint } = z
      .object({
        endpoint: z.string().url(),
      })
      .parse(req.body);

    await db.collection('push_subscriptions').deleteOne({
      userId,
      endpoint,
    });

    res.json({ message: 'Push subscription removed successfully' });
  } catch (error) {
    throw error;
  }
});

export default router;
