import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';
import { uploadImage, deleteImage } from '../utils/image-upload.js';

class ProfileManager {
  /**
   * Update user profile
   * @param {string} userId User ID
   * @param {Object} updates Profile updates
   * @returns {Promise<Object>} Updated profile
   */
  async updateProfile(userId, updates) {
    try {
      const db = getDb();
      const allowedUpdates = [
        'displayName',
        'username',
        'bio',
        'location',
        'favoriteCuisine',
        'profileVisibility',
        'socialLinks',
      ];

      // Filter out non-allowed updates
      const filteredUpdates = Object.keys(updates)
        .filter(key => allowedUpdates.includes(key))
        .reduce((obj, key) => {
          obj[key] = updates[key];
          return obj;
        }, {});

      if (filteredUpdates.username) {
        // Check username uniqueness
        const existingUser = await db.collection('users').findOne({
          username: filteredUpdates.username,
          _id: { $ne: new ObjectId(userId) },
        });

        if (existingUser) {
          throw new Error('Username already taken');
        }
      }

      const result = await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        {
          $set: {
            ...filteredUpdates,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new Error('User not found');
      }

      return result.value;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  /**
   * Update profile picture
   * @param {string} userId User ID
   * @param {Object} imageFile Image file
   * @returns {Promise<Object>} Updated profile
   */
  async updateProfilePicture(userId, imageFile) {
    try {
      const db = getDb();

      // Get current user to check if they have an existing profile picture
      const user = await db.collection('users').findOne({
        _id: new ObjectId(userId),
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Delete old profile picture if it exists
      if (user.profilePicture) {
        await deleteImage(user.profilePicture);
      }

      // Upload new profile picture
      const imageUrl = await uploadImage(imageFile, 'profile-pictures');

      // Update user profile
      const result = await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        {
          $set: {
            profilePicture: imageUrl,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      return result.value;
    } catch (error) {
      console.error('Error updating profile picture:', error);
      throw error;
    }
  }

  /**
   * Update profile visibility settings
   * @param {string} userId User ID
   * @param {Object} settings Visibility settings
   * @returns {Promise<Object>} Updated settings
   */
  async updateVisibilitySettings(userId, settings) {
    try {
      const db = getDb();
      const allowedSettings = [
        'isPublic',
        'showSavedRecipes',
        'showLists',
        'showFollowers',
        'showFollowing',
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
            visibility: filteredSettings,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new Error('User not found');
      }

      return result.value.visibility;
    } catch (error) {
      console.error('Error updating visibility settings:', error);
      throw error;
    }
  }

  /**
   * Get user profile
   * @param {string} userId User ID
   * @returns {Promise<Object>} User profile
   */
  async getProfile(userId) {
    try {
      const db = getDb();

      const profile = await db
        .collection('users')
        .aggregate([
          {
            $match: { _id: new ObjectId(userId) },
          },
          {
            $project: {
              _id: 1,
              displayName: 1,
              username: 1,
              bio: 1,
              location: 1,
              favoriteCuisine: 1,
              profilePicture: 1,
              visibility: 1,
              socialLinks: 1,
              createdAt: 1,
              stats: {
                savedRecipes: { $size: { $ifNull: ['$savedRecipes', []] } },
                lists: { $size: { $ifNull: ['$lists', []] } },
              },
            },
          },
        ])
        .next();

      if (!profile) {
        throw new Error('User not found');
      }

      return profile;
    } catch (error) {
      console.error('Error getting profile:', error);
      throw error;
    }
  }

  /**
   * Get public profile
   * @param {string} username Username
   * @returns {Promise<Object>} Public profile
   */
  async getPublicProfile(username) {
    try {
      const db = getDb();

      const profile = await db
        .collection('users')
        .aggregate([
          {
            $match: {
              username,
              'visibility.isPublic': true,
            },
          },
          {
            $project: {
              _id: 1,
              displayName: 1,
              username: 1,
              bio: 1,
              location: 1,
              favoriteCuisine: 1,
              profilePicture: 1,
              visibility: 1,
              stats: {
                savedRecipes: {
                  $cond: [
                    '$visibility.showSavedRecipes',
                    { $size: { $ifNull: ['$savedRecipes', []] } },
                    '$$REMOVE',
                  ],
                },
                lists: {
                  $cond: [
                    '$visibility.showLists',
                    { $size: { $ifNull: ['$lists', []] } },
                    '$$REMOVE',
                  ],
                },
              },
            },
          },
        ])
        .next();

      if (!profile) {
        throw new Error('Profile not found or is private');
      }

      return profile;
    } catch (error) {
      console.error('Error getting public profile:', error);
      throw error;
    }
  }

  /**
   * Generate profile share link
   * @param {string} userId User ID
   * @returns {Promise<string>} Share link
   */
  async generateShareLink(userId) {
    try {
      const db = getDb();

      const user = await db.collection('users').findOne({
        _id: new ObjectId(userId),
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (!user.visibility?.isPublic) {
        throw new Error('Profile must be public to generate share link');
      }

      // Generate a share link using the username
      return `${process.env.APP_URL}/profile/${user.username}`;
    } catch (error) {
      console.error('Error generating share link:', error);
      throw error;
    }
  }
}

export default new ProfileManager();
