import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';

class SettingsManager {
  /**
   * Update measurement settings
   * @param {string} userId User ID
   * @param {Object} settings Measurement settings
   * @returns {Promise<Object>} Updated settings
   */
  async updateMeasurementSettings(userId, settings) {
    try {
      const db = getDb();
      const allowedSettings = [
        'system', // 'metric' or 'imperial'
        'autoConvert',
        'temperature' // 'celsius' or 'fahrenheit'
      ];

      // Filter out non-allowed settings
      const filteredSettings = Object.keys(settings)
        .filter(key => allowedSettings.includes(key))
        .reduce((obj, key) => {
          obj[key] = settings[key];
          return obj;
        }, {});

      const result = await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        {
          $set: {
            'settings.measurement': filteredSettings,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new Error('User not found');
      }

      return result.value.settings.measurement;
    } catch (error) {
      console.error('Error updating measurement settings:', error);
      throw error;
    }
  }

  /**
   * Update notification settings
   * @param {string} userId User ID
   * @param {Object} settings Notification settings
   * @returns {Promise<Object>} Updated settings
   */
  async updateNotificationSettings(userId, settings) {
    try {
      const db = getDb();
      const allowedSettings = {
        push: [
          'comments',
          'followers',
          'messages',
          'mealPlanReminders',
          'weeklyDigest'
        ],
        email: [
          'newsletter',
          'marketing',
          'updates',
          'transactional'
        ]
      };

      // Filter out non-allowed settings
      const filteredSettings = {
        push: Object.keys(settings.push || {})
          .filter(key => allowedSettings.push.includes(key))
          .reduce((obj, key) => {
            obj[key] = settings.push[key];
            return obj;
          }, {}),
        email: Object.keys(settings.email || {})
          .filter(key => allowedSettings.email.includes(key))
          .reduce((obj, key) => {
            obj[key] = settings.email[key];
            return obj;
          }, {})
      };

      const result = await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        {
          $set: {
            'settings.notifications': filteredSettings,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new Error('User not found');
      }

      return result.value.settings.notifications;
    } catch (error) {
      console.error('Error updating notification settings:', error);
      throw error;
    }
  }

  /**
   * Update appearance settings
   * @param {string} userId User ID
   * @param {Object} settings Appearance settings
   * @returns {Promise<Object>} Updated settings
   */
  async updateAppearanceSettings(userId, settings) {
    try {
      const db = getDb();
      const allowedSettings = [
        'theme', // 'light', 'dark', or 'system'
        'language',
        'fontSize'
      ];

      // Filter out non-allowed settings
      const filteredSettings = Object.keys(settings)
        .filter(key => allowedSettings.includes(key))
        .reduce((obj, key) => {
          obj[key] = settings[key];
          return obj;
        }, {});

      const result = await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        {
          $set: {
            'settings.appearance': filteredSettings,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new Error('User not found');
      }

      return result.value.settings.appearance;
    } catch (error) {
      console.error('Error updating appearance settings:', error);
      throw error;
    }
  }

  /**
   * Update privacy settings
   * @param {string} userId User ID
   * @param {Object} settings Privacy settings
   * @returns {Promise<Object>} Updated settings
   */
  async updatePrivacySettings(userId, settings) {
    try {
      const db = getDb();
      const allowedSettings = [
        'dataCollection',
        'analytics',
        'thirdPartySharing',
        'cookiePreferences'
      ];

      // Filter out non-allowed settings
      const filteredSettings = Object.keys(settings)
        .filter(key => allowedSettings.includes(key))
        .reduce((obj, key) => {
          obj[key] = settings[key];
          return obj;
        }, {});

      const result = await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        {
          $set: {
            'settings.privacy': filteredSettings,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new Error('User not found');
      }

      return result.value.settings.privacy;
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      throw error;
    }
  }

  /**
   * Get all user settings
   * @param {string} userId User ID
   * @returns {Promise<Object>} User settings
   */
  async getSettings(userId) {
    try {
      const db = getDb();

      const user = await db.collection('users').findOne(
        { _id: new ObjectId(userId) },
        {
          projection: {
            settings: 1
          }
        }
      );

      if (!user) {
        throw new Error('User not found');
      }

      return user.settings || {};
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  }

  /**
   * Clear app cache
   * @param {string} userId User ID
   * @returns {Promise<void>}
   */
  async clearCache(userId) {
    try {
      const db = getDb();

      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            'settings.lastCacheClear': new Date(),
            updatedAt: new Date()
          }
        }
      );
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }

  /**
   * Delete user account
   * @param {string} userId User ID
   * @returns {Promise<void>}
   */
  async deleteAccount(userId) {
    try {
      const db = getDb();

      // Start a session for the deletion process
      const session = db.client.startSession();

      try {
        await session.withTransaction(async () => {
          // Delete user's recipes from lists
          await db.collection('listRecipes').deleteMany(
            { userId: new ObjectId(userId) },
            { session }
          );

          // Delete user's lists
          await db.collection('recipeLists').deleteMany(
            { userId: new ObjectId(userId) },
            { session }
          );

          // Delete user's saved recipes
          await db.collection('savedRecipes').deleteMany(
            { userId: new ObjectId(userId) },
            { session }
          );

          // Delete user's reviews
          await db.collection('reviews').deleteMany(
            { userId: new ObjectId(userId) },
            { session }
          );

          // Delete user account
          await db.collection('users').deleteOne(
            { _id: new ObjectId(userId) },
            { session }
          );
        });
      } finally {
        await session.endSession();
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }
}

export default new SettingsManager(); 