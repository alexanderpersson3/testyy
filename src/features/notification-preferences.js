const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const auditLogger = require('./audit-logger');

class NotificationPreferencesManager {
  constructor() {
    this.NOTIFICATION_TYPES = {
      EMAIL: {
        RECIPE_COMMENTS: 'email.recipe.comments',
        RECIPE_LIKES: 'email.recipe.likes',
        RECIPE_REVIEWS: 'email.recipe.reviews',
        FOLLOWER_UPDATES: 'email.follower.updates',
        PRICE_ALERTS: 'email.price.alerts',
        SECURITY_ALERTS: 'email.security.alerts',
        NEWSLETTER: 'email.newsletter',
        MARKETING: 'email.marketing',
      },
      IN_APP: {
        RECIPE_COMMENTS: 'in_app.recipe.comments',
        RECIPE_LIKES: 'in_app.recipe.likes',
        RECIPE_REVIEWS: 'in_app.recipe.reviews',
        FOLLOWER_UPDATES: 'in_app.follower.updates',
        PRICE_ALERTS: 'in_app.price.alerts',
        SECURITY_ALERTS: 'in_app.security.alerts',
        FEATURED_CONTENT: 'in_app.featured.content',
      },
    };

    // Default preferences for new users
    this.DEFAULT_PREFERENCES = {
      email: {
        recipe_comments: true,
        recipe_likes: true,
        recipe_reviews: true,
        follower_updates: true,
        price_alerts: true,
        security_alerts: true, // Security alerts are always on by default
        newsletter: true,
        marketing: false, // Marketing emails off by default
      },
      in_app: {
        recipe_comments: true,
        recipe_likes: true,
        recipe_reviews: true,
        follower_updates: true,
        price_alerts: true,
        security_alerts: true,
        featured_content: true,
      },
      digest_frequency: 'daily', // Options: 'never', 'daily', 'weekly'
      quiet_hours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
        timezone: 'UTC',
      },
    };
  }

  async getPreferences(userId) {
    try {
      const db = getDb();

      let preferences = await db.collection('notification_preferences').findOne({
        userId: new ObjectId(userId),
      });

      if (!preferences) {
        // Create default preferences if none exist
        preferences = {
          userId: new ObjectId(userId),
          ...this.DEFAULT_PREFERENCES,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await db.collection('notification_preferences').insertOne(preferences);

        await auditLogger.log(
          auditLogger.eventTypes.USER.PREFERENCES_CREATE,
          { userId },
          { severity: auditLogger.severityLevels.INFO }
        );
      }

      return preferences;
    } catch (err) {
      console.error('Error getting notification preferences:', err);
      throw err;
    }
  }

  async updatePreferences(userId, updates) {
    try {
      const db = getDb();

      // Ensure security alerts can't be disabled
      if (updates.email?.security_alerts === false || updates.in_app?.security_alerts === false) {
        throw new Error('Security alerts cannot be disabled');
      }

      // Validate digest frequency
      if (
        updates.digest_frequency &&
        !['never', 'daily', 'weekly'].includes(updates.digest_frequency)
      ) {
        throw new Error('Invalid digest frequency');
      }

      // Validate quiet hours
      if (updates.quiet_hours) {
        if (updates.quiet_hours.enabled) {
          if (!updates.quiet_hours.start || !updates.quiet_hours.end) {
            throw new Error('Quiet hours start and end times are required');
          }
          // Validate time format (HH:mm)
          const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
          if (
            !timeRegex.test(updates.quiet_hours.start) ||
            !timeRegex.test(updates.quiet_hours.end)
          ) {
            throw new Error('Invalid quiet hours time format');
          }
        }
      }

      const updateResult = await db.collection('notification_preferences').updateOne(
        { userId: new ObjectId(userId) },
        {
          $set: {
            ...updates,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      await auditLogger.log(
        auditLogger.eventTypes.USER.PREFERENCES_UPDATE,
        { userId, updates },
        { severity: auditLogger.severityLevels.INFO }
      );

      return updateResult.modifiedCount > 0 || updateResult.upsertedCount > 0;
    } catch (err) {
      console.error('Error updating notification preferences:', err);
      throw err;
    }
  }

  async shouldNotify(userId, notificationType) {
    try {
      const preferences = await this.getPreferences(userId);

      // Always allow security alerts
      if (
        notificationType === this.NOTIFICATION_TYPES.EMAIL.SECURITY_ALERTS ||
        notificationType === this.NOTIFICATION_TYPES.IN_APP.SECURITY_ALERTS
      ) {
        return true;
      }

      // Check quiet hours
      if (preferences.quiet_hours.enabled) {
        const now = new Date();
        const [startHour, startMinute] = preferences.quiet_hours.start.split(':').map(Number);
        const [endHour, endMinute] = preferences.quiet_hours.end.split(':').map(Number);

        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        const isQuietTime =
          (currentHour > startHour ||
            (currentHour === startHour && currentMinute >= startMinute)) &&
          (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute));

        if (isQuietTime) {
          return false;
        }
      }

      // Check specific notification type
      const [channel, ...pathParts] = notificationType.split('.');
      const setting = pathParts.join('_');

      return preferences[channel]?.[setting] ?? false;
    } catch (err) {
      console.error('Error checking notification preferences:', err);
      // Default to true for security-related notifications
      return notificationType.includes('security');
    }
  }
}

module.exports = new NotificationPreferencesManager();
