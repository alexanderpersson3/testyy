import { promises as fs } from 'fs';;
import { ObjectId } from 'mongodb';;;;
import { connectToDatabase } from '../db.js';;
import { WebSocketService } from '../websocket.service.js';;
import { EmailService } from '../email.service.js';;
import { NotificationService } from '../notification.service.js';;
import logger from '../utils/logger.js';
import { Notification, NotificationType, NotificationChannel, NotificationPreferences,  } from '../types/express.js';;

interface CreateNotificationInput {
  userId: ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: NotificationChannel[];
}

export class NotificationManagerService {
  private static instance: NotificationManagerService;
  private notificationService: NotificationService;
  private wsService: WebSocketService;
  private emailService: EmailService;

  private constructor() {
    this.notificationService = NotificationService.getInstance();
    this.wsService = WebSocketService.getInstance();
    this.emailService = new EmailService();
  }

  static getInstance(): NotificationManagerService {
    if (!NotificationManagerService.instance) {
      NotificationManagerService.instance = new NotificationManagerService();
    }
    return NotificationManagerService.instance;
  }

  /**
   * Send a notification
   */
  async sendNotification(input: CreateNotificationInput): Promise<void> {
    try {
      // Get user preferences
      const prefs = await this.notificationService.getPreferences(input.userId);

      // Use default channels if none specified and no preferences
      const defaultChannels = [NotificationChannel.IN_APP];
      const channels = input.channels || prefs?.channels?.[input.type] || defaultChannels;

      // Check quiet hours if enabled
      if (prefs?.schedule?.quietHours?.enabled) {
        const isQuietHours = this.isInQuietHours(
          prefs.schedule.quietHours.start,
          prefs.schedule.quietHours.end,
          prefs.schedule.quietHours.timezone
        );

        if (isQuietHours) {
          // Only send in-app notifications during quiet hours
          channels.length = 0;
          channels.push(NotificationChannel.IN_APP);
        }
      }

      // Create notification
      await this.notificationService.create(
        input.userId,
        input.type,
        input.title,
        input.message,
        input.data,
        channels
      );
    } catch (error) {
      logger.error('Failed to send notification:', error);
      throw error;
    }
  }

  /**
   * Send digest notifications
   */
  async sendDigests(): Promise<void> {
    const db = await connectToDatabase();

    try {
      // Get users with digest enabled
      const users = await db
        .collection<NotificationPreferences>('notification_preferences')
        .find({
          'schedule.digest': true,
        })
        .toArray();

      const now = new Date();
      const currentTime = now.getHours() * 100 + now.getMinutes();

      for (const user of users) {
        try {
          // Check if it's time to send digest
          const [hours, minutes] = user.schedule.digestTime.split(':').map(Number);
          const digestTime = hours * 100 + minutes;

          if (currentTime !== digestTime) {
            continue;
          }

          // Get unread notifications
          const notifications = await this.notificationService.getNotifications(user.userId, {
            unreadOnly: true,
          });

          if (notifications.length === 0) {
            continue;
          }

          // Group notifications by type
          const grouped = this.groupNotifications(notifications);

          // Generate digest content
          const digestContent = this.generateDigestContent(grouped);

          // Send digest
          await this.emailService.sendEmail({
            to: user.userId.toString(), // You'll need to get user's email
            subject: 'Your Notification Digest',
            text: digestContent,
          });

          // Mark notifications as read
          for (const notification of notifications) {
            if (notification._id) {
              await this.notificationService.markAsRead(notification._id, user.userId);
            }
          }
        } catch (error) {
          logger.error(`Failed to send digest for user ${user.userId}:`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to send digests:', error);
      throw error;
    }
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(start: string, end: string, timezone: string): boolean {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    });

    const currentTime = formatter.format(now);
    return currentTime >= start && currentTime <= end;
  }

  /**
   * Group notifications by type
   */
  private groupNotifications(
    notifications: Notification[]
  ): Record<NotificationType, Notification[]> {
    return notifications.reduce(
      (acc: any, notification: any) => {
        if (!acc[notification.type]) {
          acc[notification.type] = [];
        }
        acc[notification.type].push(notification);
        return acc;
      },
      {} as Record<NotificationType, Notification[]>
    );
  }

  /**
   * Generate digest content
   */
  private generateDigestContent(grouped: Record<NotificationType, Notification[]>): string {
    let content = 'Your Notification Digest\n\n';

    for (const [type, notifications] of Object.entries(grouped)) {
      content += `${this.formatNotificationType(type)} (${notifications.length})\n`;
      notifications.forEach(notification => {
        content += `- ${notification.message}\n`;
      });
      content += '\n';
    }

    return content;
  }

  /**
   * Format notification type for display
   */
  private formatNotificationType(type: string): string {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
