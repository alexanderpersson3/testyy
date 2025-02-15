import { connectToDatabase } from '../db.js';;
import logger from '../utils/logger.js';
import { NotificationStatus } from '../types/express.js';;

interface PushToken {
  _id?: ObjectId;
  userId: ObjectId;
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId: string;
  createdAt: Date;
  updatedAt: Date;
  lastUsed: Date;
}

interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, any>;
  image?: string;
  badge?: number;
  sound?: string;
  priority?: 'default' | 'high';
  ttl?: number;
}

export class PushNotificationService {
  private static instance: PushNotificationService;

  private constructor() {
    // Initialize Firebase Admin SDK or other push service here
  }

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Register a push token for a user
   */
  async registerToken(
    userId: ObjectId,
    token: string,
    platform: PushToken['platform'],
    deviceId: string
  ): Promise<void> {
    try {
      const db = await connectToDatabase();
      const now = new Date();

      await db.collection<PushToken>('push_tokens').updateOne(
        { userId, deviceId },
        {
          $set: {
            token,
            platform,
            updatedAt: now,
            lastUsed: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true }
      );
    } catch (error) {
      logger.error('Failed to register push token:', error);
      throw error;
    }
  }

  /**
   * Send a push notification to a user
   */
  async sendToUser(userId: ObjectId, notification: PushNotification): Promise<NotificationStatus> {
    try {
      const db = await connectToDatabase();
      const tokens = await db
        .collection<PushToken>('push_tokens')
        .find({ userId })
        .toArray();

      if (!tokens.length) {
        return 'failed';
      }

      const results = await Promise.allSettled(
        tokens.map(token => this.sendToToken(token.token, token.platform, notification))
      );

      // Update last used timestamp for successful sends
      const successfulTokens = tokens.filter((_: any, index: any) => results[index].status === 'fulfilled');
      if (successfulTokens.length) {
        await db.collection<PushToken>('push_tokens').updateMany(
          {
            _id: { $in: successfulTokens.map(token => token._id!) },
          },
          {
            $set: { lastUsed: new Date() },
          }
        );
      }

      // Remove invalid tokens
      const failedResults = results.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );
      const invalidTokens = failedResults.filter(result => 
        result.reason?.includes('InvalidToken') || 
        result.reason?.includes('NotRegistered')
      );
      if (invalidTokens.length) {
        await db.collection<PushToken>('push_tokens').deleteMany({
          _id: { $in: invalidTokens.map((_: any, index: any) => tokens[index]._id!) },
        });
      }

      return successfulTokens.length > 0 ? 'delivered' : 'failed';
    } catch (error) {
      logger.error('Failed to send push notification:', error);
      return 'failed';
    }
  }

  /**
   * Send notification to a specific token
   */
  private async sendToToken(
    token: string,
    platform: PushToken['platform'],
    notification: PushNotification
  ): Promise<void> {
    // Implement platform-specific push notification logic here
    // For example, using Firebase Admin SDK:
    try {
      switch (platform) {
        case 'ios':
          // Implement iOS-specific push notification
          break;
        case 'android':
          // Implement Android-specific push notification
          break;
        case 'web':
          // Implement web push notification
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      logger.error(`Failed to send push notification to ${platform} device:`, error);
      throw error;
    }
  }

  /**
   * Unregister a push token
   */
  async unregisterToken(userId: ObjectId, deviceId: string): Promise<void> {
    try {
      const db = await connectToDatabase();
      await db.collection<PushToken>('push_tokens').deleteOne({ userId, deviceId });
    } catch (error) {
      logger.error('Failed to unregister push token:', error);
      throw error;
    }
  }

  /**
   * Clean up old/unused tokens
   */
  async cleanupTokens(olderThan: Date): Promise<number> {
    try {
      const db = await connectToDatabase();
      const result = await db
        .collection<PushToken>('push_tokens')
        .deleteMany({ lastUsed: { $lt: olderThan } });
      return result.deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old push tokens:', error);
      throw error;
    }
  }
} 