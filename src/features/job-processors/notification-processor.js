const jobQueue = require('../job-queue');
const { getDb } = require('../../db');
const { ObjectId } = require('mongodb');
const WebSocket = require('ws');

class NotificationProcessor {
  constructor() {
    // Initialize processor
    jobQueue.processQueue('notification', this.processJob.bind(this));

    // Notification types
    this.NOTIFICATION_TYPES = {
      RECIPE_LIKED: 'recipe_liked',
      RECIPE_COMMENTED: 'recipe_commented',
      RECIPE_SHARED: 'recipe_shared',
      NEW_FOLLOWER: 'new_follower',
      PRICE_ALERT: 'price_alert',
      RECIPE_FEATURED: 'recipe_featured',
      COMMENT_REPLY: 'comment_reply',
      ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
    };

    // Initialize WebSocket server for real-time notifications
    this.wss = new WebSocket.Server({
      port: process.env.WS_PORT || 8080,
      path: '/notifications',
    });

    // Store active connections
    this.connections = new Map();

    // Set up WebSocket connection handling
    this.setupWebSocketServer();
  }

  /**
   * Set up WebSocket server
   */
  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      const userId = this.getUserIdFromRequest(req);
      if (!userId) {
        ws.close(1008, 'Authentication required');
        return;
      }

      // Store connection
      if (!this.connections.has(userId)) {
        this.connections.set(userId, new Set());
      }
      this.connections.get(userId).add(ws);

      // Handle connection close
      ws.on('close', () => {
        const userConnections = this.connections.get(userId);
        if (userConnections) {
          userConnections.delete(ws);
          if (userConnections.size === 0) {
            this.connections.delete(userId);
          }
        }
      });

      // Handle connection error
      ws.on('error', error => {
        console.error(`WebSocket error for user ${userId}:`, error);
        ws.close(1011, 'Internal server error');
      });
    });
  }

  /**
   * Get user ID from WebSocket request
   */
  getUserIdFromRequest(req) {
    try {
      const token = req.url.split('token=')[1];
      if (!token) return null;

      // TODO: Implement proper token verification
      // For now, assume token is user ID
      return token;
    } catch (error) {
      console.error('Error getting user ID from request:', error);
      return null;
    }
  }

  /**
   * Process notification job
   */
  async processJob(job) {
    const { type, data } = job.data;

    try {
      switch (type) {
        case this.NOTIFICATION_TYPES.RECIPE_LIKED:
          return await this.processRecipeLiked(data);
        case this.NOTIFICATION_TYPES.RECIPE_COMMENTED:
          return await this.processRecipeCommented(data);
        case this.NOTIFICATION_TYPES.RECIPE_SHARED:
          return await this.processRecipeShared(data);
        case this.NOTIFICATION_TYPES.NEW_FOLLOWER:
          return await this.processNewFollower(data);
        case this.NOTIFICATION_TYPES.PRICE_ALERT:
          return await this.processPriceAlert(data);
        case this.NOTIFICATION_TYPES.RECIPE_FEATURED:
          return await this.processRecipeFeatured(data);
        case this.NOTIFICATION_TYPES.COMMENT_REPLY:
          return await this.processCommentReply(data);
        case this.NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED:
          return await this.processAchievementUnlocked(data);
        default:
          throw new Error(`Unknown notification type: ${type}`);
      }
    } catch (error) {
      console.error(`Error processing notification job ${job.id}:`, error);
      await this.logNotificationError(type, data, error);
      throw error;
    }
  }

  /**
   * Process recipe liked notification
   */
  async processRecipeLiked(data) {
    const notification = {
      type: this.NOTIFICATION_TYPES.RECIPE_LIKED,
      recipientId: new ObjectId(data.recipeOwnerId),
      senderId: new ObjectId(data.likerId),
      recipeId: new ObjectId(data.recipeId),
      read: false,
      createdAt: new Date(),
      metadata: {
        recipeName: data.recipeName,
        likerName: data.likerName,
      },
    };

    await this.saveNotification(notification);
    await this.sendRealTimeNotification(notification.recipientId.toString(), {
      type: notification.type,
      message: `${data.likerName} liked your recipe "${data.recipeName}"`,
      data: notification,
    });
  }

  /**
   * Process recipe commented notification
   */
  async processRecipeCommented(data) {
    const notification = {
      type: this.NOTIFICATION_TYPES.RECIPE_COMMENTED,
      recipientId: new ObjectId(data.recipeOwnerId),
      senderId: new ObjectId(data.commenterId),
      recipeId: new ObjectId(data.recipeId),
      commentId: new ObjectId(data.commentId),
      read: false,
      createdAt: new Date(),
      metadata: {
        recipeName: data.recipeName,
        commenterName: data.commenterName,
        comment: data.comment,
      },
    };

    await this.saveNotification(notification);
    await this.sendRealTimeNotification(notification.recipientId.toString(), {
      type: notification.type,
      message: `${data.commenterName} commented on your recipe "${data.recipeName}"`,
      data: notification,
    });
  }

  /**
   * Process recipe shared notification
   */
  async processRecipeShared(data) {
    const notification = {
      type: this.NOTIFICATION_TYPES.RECIPE_SHARED,
      recipientId: new ObjectId(data.recipeOwnerId),
      senderId: new ObjectId(data.sharerId),
      recipeId: new ObjectId(data.recipeId),
      read: false,
      createdAt: new Date(),
      metadata: {
        recipeName: data.recipeName,
        sharerName: data.sharerName,
        sharedWith: data.sharedWith,
      },
    };

    await this.saveNotification(notification);
    await this.sendRealTimeNotification(notification.recipientId.toString(), {
      type: notification.type,
      message: `${data.sharerName} shared your recipe "${data.recipeName}"`,
      data: notification,
    });
  }

  /**
   * Process new follower notification
   */
  async processNewFollower(data) {
    const notification = {
      type: this.NOTIFICATION_TYPES.NEW_FOLLOWER,
      recipientId: new ObjectId(data.followedId),
      senderId: new ObjectId(data.followerId),
      read: false,
      createdAt: new Date(),
      metadata: {
        followerName: data.followerName,
        followerAvatar: data.followerAvatar,
      },
    };

    await this.saveNotification(notification);
    await this.sendRealTimeNotification(notification.recipientId.toString(), {
      type: notification.type,
      message: `${data.followerName} started following you`,
      data: notification,
    });
  }

  /**
   * Process price alert notification
   */
  async processPriceAlert(data) {
    const notification = {
      type: this.NOTIFICATION_TYPES.PRICE_ALERT,
      recipientId: new ObjectId(data.userId),
      read: false,
      createdAt: new Date(),
      metadata: {
        ingredientName: data.ingredientName,
        oldPrice: data.oldPrice,
        newPrice: data.newPrice,
        store: data.store,
        percentageChange: data.percentageChange,
      },
    };

    await this.saveNotification(notification);
    await this.sendRealTimeNotification(notification.recipientId.toString(), {
      type: notification.type,
      message: `Price alert for ${data.ingredientName}: ${data.percentageChange}% change at ${data.store}`,
      data: notification,
    });
  }

  /**
   * Process recipe featured notification
   */
  async processRecipeFeatured(data) {
    const notification = {
      type: this.NOTIFICATION_TYPES.RECIPE_FEATURED,
      recipientId: new ObjectId(data.recipeOwnerId),
      recipeId: new ObjectId(data.recipeId),
      read: false,
      createdAt: new Date(),
      metadata: {
        recipeName: data.recipeName,
        category: data.category,
      },
    };

    await this.saveNotification(notification);
    await this.sendRealTimeNotification(notification.recipientId.toString(), {
      type: notification.type,
      message: `Your recipe "${data.recipeName}" was featured in ${data.category}!`,
      data: notification,
    });
  }

  /**
   * Process comment reply notification
   */
  async processCommentReply(data) {
    const notification = {
      type: this.NOTIFICATION_TYPES.COMMENT_REPLY,
      recipientId: new ObjectId(data.parentCommentUserId),
      senderId: new ObjectId(data.replyUserId),
      recipeId: new ObjectId(data.recipeId),
      commentId: new ObjectId(data.commentId),
      read: false,
      createdAt: new Date(),
      metadata: {
        recipeName: data.recipeName,
        replierName: data.replierName,
        reply: data.reply,
      },
    };

    await this.saveNotification(notification);
    await this.sendRealTimeNotification(notification.recipientId.toString(), {
      type: notification.type,
      message: `${data.replierName} replied to your comment on "${data.recipeName}"`,
      data: notification,
    });
  }

  /**
   * Process achievement unlocked notification
   */
  async processAchievementUnlocked(data) {
    const notification = {
      type: this.NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED,
      recipientId: new ObjectId(data.userId),
      read: false,
      createdAt: new Date(),
      metadata: {
        achievementName: data.achievementName,
        description: data.description,
        reward: data.reward,
      },
    };

    await this.saveNotification(notification);
    await this.sendRealTimeNotification(notification.recipientId.toString(), {
      type: notification.type,
      message: `Achievement unlocked: ${data.achievementName}!`,
      data: notification,
    });
  }

  /**
   * Save notification to database
   */
  async saveNotification(notification) {
    try {
      const db = getDb();
      await db.collection('notifications').insertOne(notification);
    } catch (error) {
      console.error('Error saving notification:', error);
      throw error;
    }
  }

  /**
   * Send real-time notification via WebSocket
   */
  async sendRealTimeNotification(userId, notification) {
    try {
      const userConnections = this.connections.get(userId);
      if (userConnections) {
        const message = JSON.stringify(notification);
        userConnections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
          }
        });
      }
    } catch (error) {
      console.error('Error sending real-time notification:', error);
    }
  }

  /**
   * Log notification error
   */
  async logNotificationError(type, data, error) {
    try {
      const db = getDb();
      await db.collection('notification_logs').insertOne({
        type,
        recipientId: data.recipientId ? new ObjectId(data.recipientId) : null,
        senderId: data.senderId ? new ObjectId(data.senderId) : null,
        metadata: data,
        error: {
          message: error.message,
          stack: error.stack,
        },
        timestamp: new Date(),
      });
    } catch (logError) {
      console.error('Error logging notification error:', logError);
    }
  }
}

// Export singleton instance
module.exports = new NotificationProcessor();
