import { ObjectId } from 'mongodb';;;;
import { connectToDatabase } from '../db.js';;
import { WebSocketService } from '../websocket.service.js';;
import { EmailService } from '../email.service.js';;
import { PushNotificationService } from '../push-notification.service.js';;
import logger from '../utils/logger.js';
import { Notification, NotificationType, NotificationChannel, NotificationPreferences, NotificationStatus,  } from '../types/express.js';;

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  data?: Record<string, any>;
}

export class NotificationService {
  private static instance: NotificationService;
  private wsService: WebSocketService;
  private emailService: EmailService;
  private pushService: PushNotificationService;

  private constructor() {
    this.wsService = WebSocketService.getInstance();
    this.emailService = new EmailService();
    this.pushService = PushNotificationService.getInstance();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Create a new notification
   */
  async create(
    userId: ObjectId,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>,
    channels: NotificationChannel[] = [NotificationChannel.IN_APP]
  ): Promise<Notification> {
    try {
      const db = await connectToDatabase();

      const now = new Date();
      const notification: Omit<Notification, '_id'> = {
        userId,
        type,
        title,
        message,
        data,
        read: false,
        createdAt: now,
        channels,
        status: {},
      };

      const result = await db.collection<Notification>('notifications').insertOne(notification);
      const createdNotification = { ...notification, _id: result.insertedId };

      // Send through specified channels
      await Promise.allSettled(channels.map(channel => this.send(createdNotification, channel)));

      return createdNotification;
    } catch (error) {
      logger.error('Failed to create notification:', error);
      throw error;
    }
  }

  /**
   * Create batch notifications for multiple users
   */
  async createBatch(
    userIds: ObjectId[],
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>,
    channels: NotificationChannel[] = [NotificationChannel.IN_APP]
  ): Promise<number> {
    try {
      const db = await connectToDatabase();
      const now = new Date();

      const notifications = userIds.map(userId => ({
        userId,
        type,
        title,
        message,
        data,
        read: false,
        createdAt: now,
        channels,
        status: {},
      }));

      const result = await db.collection<Notification>('notifications').insertMany(notifications);
      
      // Send notifications through specified channels in batches
      const batchSize = 50;
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize).map((notification: any, index: any) => ({
          ...notification,
          _id: result.insertedIds[i + index],
        }));
        
        await Promise.allSettled(
          channels.flatMap(channel =>
            batch.map(notification => this.send(notification, channel))
          )
        );
      }

      return result.insertedCount;
    } catch (error) {
      logger.error('Failed to create batch notifications:', error);
      throw error;
    }
  }

  /**
   * Send notification through specified channel
   */
  private async send(notification: Notification, channel: NotificationChannel): Promise<void> {
    try {
      switch (channel) {
        case NotificationChannel.IN_APP:
          await this.sendInApp(notification);
          break;
        case NotificationChannel.EMAIL:
          await this.sendEmail(notification);
          break;
        case NotificationChannel.PUSH:
          await this.sendPush(notification);
          break;
        case NotificationChannel.SMS:
          await this.sendSMS(notification);
          break;
        default:
          logger.warn('Unsupported notification channel:', channel);
      }
    } catch (error) {
      logger.error(`Failed to send notification through ${channel}:`, error);
      await this.updateStatus(notification._id!, channel, 'failed');
      throw error;
    }
  }

  /**
   * Send in-app notification
   */
  private async sendInApp(notification: Notification): Promise<void> {
    if (!notification._id) return;

    await this.wsService.emitToUser(notification.userId, 'notification', {
      id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data || {},
    });

    await this.updateStatus(notification._id, NotificationChannel.IN_APP, 'delivered');
  }

  /**
   * Send email notification
   */
  private async sendEmail(notification: Notification): Promise<void> {
    if (!notification._id) return;

    const db = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: notification.userId });

    if (!user?.email) {
      throw new Error('User email not found');
    }

    const emailOptions: EmailOptions = {
      to: user.email,
      subject: notification.title,
      text: notification.message,
      data: notification.data,
    };

    await this.emailService.sendEmail(emailOptions);

    await this.updateStatus(notification._id, NotificationChannel.EMAIL, 'sent');
  }

  /**
   * Send push notification
   */
  private async sendPush(notification: Notification): Promise<void> {
    if (!notification._id) return;

    const status = await this.pushService.sendToUser(notification.userId, {
      title: notification.title,
      body: notification.message,
      data: notification.data,
      badge: 1,
      sound: 'default',
      priority: 'high',
    });

    await this.updateStatus(notification._id, NotificationChannel.PUSH, status);
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(notification: Notification): Promise<void> {
    if (!notification._id) return;
    // Implement SMS notification logic here
    await this.updateStatus(notification._id, NotificationChannel.SMS, 'sent');
  }

  /**
   * Update notification status
   */
  private async updateStatus(
    notificationId: ObjectId,
    channel: NotificationChannel,
    status: NotificationStatus
  ): Promise<void> {
    try {
      const db = await connectToDatabase();

      await db.collection<Notification>('notifications').updateOne(
        { _id: notificationId },
        {
          $set: {
            [`status.${channel}`]: status,
            updatedAt: new Date(),
          },
        }
      );
    } catch (error) {
      logger.error('Failed to update notification status:', error);
      throw error;
    }
  }

  /**
   * Get user's notifications with advanced filtering
   */
  async getNotifications(
    userId: ObjectId,
    options: {
      unreadOnly?: boolean;
      types?: NotificationType[];
      channels?: NotificationChannel[];
      limit?: number;
      before?: Date;
      after?: Date;
      status?: NotificationStatus;
    } = {}
  ): Promise<Notification[]> {
    try {
      const db = await connectToDatabase();

      const query: Record<string, any> = { userId };
      
      if (options.unreadOnly) {
        query.read = false;
      }
      
      if (options.types?.length) {
        query.type = { $in: options.types };
      }
      
      if (options.channels?.length) {
        query.channels = { $in: options.channels };
      }
      
      if (options.status && options.channels?.length) {
        const statusQuery = options.channels.reduce<Record<string, NotificationStatus>>((acc: any, channel: any) => {
          acc[`status.${channel}`] = options.status!;
          return acc;
        }, {});
        Object.assign(query, statusQuery);
      }
      
      if (options.before || options.after) {
        query.createdAt = {};
        if (options.before) query.createdAt.$lt = options.before;
        if (options.after) query.createdAt.$gt = options.after;
      }

      return db
        .collection<Notification>('notifications')
        .find(query)
        .sort({ createdAt: -1 })
        .limit(options.limit || 20)
        .toArray();
    } catch (error) {
      logger.error('Failed to get notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: ObjectId, userId: ObjectId): Promise<void> {
    try {
      const db = await connectToDatabase();

      const result = await db.collection<Notification>('notifications').updateOne(
        { _id: notificationId, userId },
        {
          $set: {
            read: true,
            [`status.${NotificationChannel.IN_APP}`]: 'read',
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('Notification not found or unauthorized');
      }
    } catch (error) {
      logger.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: ObjectId): Promise<number> {
    try {
      const db = await connectToDatabase();

      const result = await db.collection<Notification>('notifications').updateMany(
        { userId, read: false },
        {
          $set: {
            read: true,
            [`status.${NotificationChannel.IN_APP}`]: 'read',
            updatedAt: new Date(),
          },
        }
      );

      return result.modifiedCount;
    } catch (error) {
      logger.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Get notification preferences
   */
  async getPreferences(userId: ObjectId): Promise<NotificationPreferences | null> {
    try {
      const db = await connectToDatabase();
      return db.collection<NotificationPreferences>('notification_preferences').findOne({ userId });
    } catch (error) {
      logger.error('Failed to get notification preferences:', error);
      throw error;
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    userId: ObjectId,
    preferences: Partial<Omit<NotificationPreferences, '_id' | 'userId'>>
  ): Promise<NotificationPreferences> {
    try {
      const db = await connectToDatabase();
      const now = new Date();

      const result = await db.collection<NotificationPreferences>('notification_preferences').findOneAndUpdate(
        { userId },
        {
          $set: {
            ...preferences,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
        }
      );

      return result.value!;
    } catch (error) {
      logger.error('Failed to update notification preferences:', error);
      throw error;
    }
  }

  /**
   * Dismiss notification (mark as dismissed without deleting)
   */
  async dismissNotification(notificationId: ObjectId, userId: ObjectId): Promise<boolean> {
    try {
      const db = await connectToDatabase();

      const result = await db
        .collection<Notification>('notifications')
        .updateOne(
          { _id: notificationId, userId },
          {
            $set: {
              dismissed: true,
              dismissedAt: new Date(),
              updatedAt: new Date(),
            },
          }
        );

      return result.matchedCount > 0;
    } catch (error) {
      logger.error('Failed to dismiss notification:', error);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: ObjectId, userId: ObjectId): Promise<boolean> {
    try {
      const db = await connectToDatabase();

      const result = await db
        .collection<Notification>('notifications')
        .deleteOne({ _id: notificationId, userId });

      return result.deletedCount > 0;
    } catch (error) {
      logger.error('Failed to delete notification:', error);
      throw error;
    }
  }

  /**
   * Delete old notifications
   */
  async deleteOldNotifications(olderThan: Date): Promise<number> {
    try {
      const db = await connectToDatabase();

      const result = await db
        .collection<Notification>('notifications')
        .deleteMany({
          createdAt: { $lt: olderThan },
          read: true,
        });

      return result.deletedCount;
    } catch (error) {
      logger.error('Failed to delete old notifications:', error);
      throw error;
    }
  }
}
