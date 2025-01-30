const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const auditLogger = require('./audit-logger');
const bcrypt = require('bcryptjs');

class UserManager {
  constructor() {
    this.defaultPreferences = {
      dietaryRestrictions: [],
      measurementUnits: 'metric',
      language: 'en',
      notifications: {
        newFollower: true,
        recipeComments: true,
        mealPlanReminders: true,
        priceAlerts: true
      },
      theme: 'light',
      privacySettings: {
        profileVisibility: 'public',
        mealPlanVisibility: 'private',
        showRecipeHistory: true
      }
    };
  }

  async createUser(userData) {
    try {
      const db = getDb();
      
      // Check if email already exists
      const existingUser = await db.collection('users').findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('Email already registered');
      }

      // Hash password if provided (not for social auth)
      let hashedPassword = null;
      if (userData.password) {
        hashedPassword = await bcrypt.hash(userData.password, 10);
      }

      const user = {
        email: userData.email,
        password: hashedPassword,
        displayName: userData.displayName || userData.email.split('@')[0],
        profilePicUrl: userData.profilePicUrl || null,
        bio: userData.bio || '',
        location: {
          postalCode: userData.postalCode || null,
          coordinates: null, // Will be populated when postal code is provided
          formattedAddress: null
        },
        subscriptionTier: 'FREE',
        preferences: this.defaultPreferences,
        authProvider: userData.authProvider || 'email',
        authProviderId: userData.authProviderId || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('users').insertOne(user);
      
      await auditLogger.log(
        auditLogger.eventTypes.USER.REGISTER,
        { userId: result.insertedId },
        { severity: auditLogger.severityLevels.INFO }
      );

      delete user.password;
      return { ...user, id: result.insertedId };
    } catch (err) {
      console.error('Error creating user:', err);
      throw err;
    }
  }

  async updateProfile(userId, updates) {
    try {
      const db = getDb();
      const allowedUpdates = ['displayName', 'bio', 'profilePicUrl'];
      const filteredUpdates = {};

      // Only allow specific fields to be updated
      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      filteredUpdates.updatedAt = new Date();

      const result = await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: filteredUpdates }
      );

      if (result.matchedCount === 0) {
        throw new Error('User not found');
      }

      await auditLogger.log(
        auditLogger.eventTypes.USER.UPDATE,
        { userId, updates: filteredUpdates },
        { severity: auditLogger.severityLevels.INFO }
      );

      return result;
    } catch (err) {
      console.error('Error updating user profile:', err);
      throw err;
    }
  }

  async updatePreferences(userId, preferences) {
    try {
      const db = getDb();
      const result = await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            preferences: { ...this.defaultPreferences, ...preferences },
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('User not found');
      }

      await auditLogger.log(
        auditLogger.eventTypes.USER.UPDATE,
        { userId, preferences },
        { severity: auditLogger.severityLevels.INFO }
      );

      return result;
    } catch (err) {
      console.error('Error updating user preferences:', err);
      throw err;
    }
  }

  async followUser(followerId, followedId) {
    try {
      const db = getDb();
      
      // Prevent self-following
      if (followerId === followedId) {
        throw new Error('Cannot follow yourself');
      }

      // Check if already following
      const existingFollow = await db.collection('followers').findOne({
        followerId: new ObjectId(followerId),
        followedId: new ObjectId(followedId)
      });

      if (existingFollow) {
        throw new Error('Already following this user');
      }

      const result = await db.collection('followers').insertOne({
        followerId: new ObjectId(followerId),
        followedId: new ObjectId(followedId),
        createdAt: new Date()
      });

      await auditLogger.log(
        auditLogger.eventTypes.USER.FOLLOW,
        { followerId, followedId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return result;
    } catch (err) {
      console.error('Error following user:', err);
      throw err;
    }
  }

  async unfollowUser(followerId, followedId) {
    try {
      const db = getDb();
      const result = await db.collection('followers').deleteOne({
        followerId: new ObjectId(followerId),
        followedId: new ObjectId(followedId)
      });

      if (result.deletedCount === 0) {
        throw new Error('Follow relationship not found');
      }

      await auditLogger.log(
        auditLogger.eventTypes.USER.UNFOLLOW,
        { followerId, followedId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return result;
    } catch (err) {
      console.error('Error unfollowing user:', err);
      throw err;
    }
  }

  async getFollowers(userId) {
    try {
      const db = getDb();
      return await db.collection('followers')
        .aggregate([
          { $match: { followedId: new ObjectId(userId) } },
          {
            $lookup: {
              from: 'users',
              localField: 'followerId',
              foreignField: '_id',
              as: 'follower'
            }
          },
          { $unwind: '$follower' },
          {
            $project: {
              _id: 0,
              userId: '$follower._id',
              displayName: '$follower.displayName',
              profilePicUrl: '$follower.profilePicUrl',
              createdAt: 1
            }
          }
        ])
        .toArray();
    } catch (err) {
      console.error('Error getting followers:', err);
      throw err;
    }
  }

  async getFollowing(userId) {
    try {
      const db = getDb();
      return await db.collection('followers')
        .aggregate([
          { $match: { followerId: new ObjectId(userId) } },
          {
            $lookup: {
              from: 'users',
              localField: 'followedId',
              foreignField: '_id',
              as: 'followed'
            }
          },
          { $unwind: '$followed' },
          {
            $project: {
              _id: 0,
              userId: '$followed._id',
              displayName: '$followed.displayName',
              profilePicUrl: '$followed.profilePicUrl',
              createdAt: 1
            }
          }
        ])
        .toArray();
    } catch (err) {
      console.error('Error getting following:', err);
      throw err;
    }
  }

  async getUserProfile(userId) {
    try {
      const db = getDb();
      const user = await db.collection('users').findOne(
        { _id: new ObjectId(userId) },
        {
          projection: {
            password: 0,
            authProviderId: 0
          }
        }
      );

      if (!user) {
        throw new Error('User not found');
      }

      // Get follower and following counts
      const [followerCount, followingCount] = await Promise.all([
        db.collection('followers').countDocuments({ followedId: new ObjectId(userId) }),
        db.collection('followers').countDocuments({ followerId: new ObjectId(userId) })
      ]);

      return {
        ...user,
        followerCount,
        followingCount
      };
    } catch (err) {
      console.error('Error getting user profile:', err);
      throw err;
    }
  }

  async searchUsers(query, limit = 10, offset = 0) {
    try {
      const db = getDb();
      return await db.collection('users')
        .find(
          {
            $or: [
              { displayName: { $regex: query, $options: 'i' } },
              { email: { $regex: query, $options: 'i' } }
            ]
          },
          {
            projection: {
              password: 0,
              authProviderId: 0,
              preferences: 0
            }
          }
        )
        .skip(offset)
        .limit(limit)
        .toArray();
    } catch (err) {
      console.error('Error searching users:', err);
      throw err;
    }
  }

  async updateLocation(userId, postalCode) {
    try {
      const db = getDb();
      
      // Geocode the postal code using Google Maps service
      const googleMapsService = (await import('./google-maps.js')).default;
      const geocodeResult = await googleMapsService.geocode(postalCode);
      
      if (!geocodeResult) {
        throw new Error('Invalid postal code');
      }

      const locationUpdate = {
        'location.postalCode': postalCode,
        'location.coordinates': {
          lat: geocodeResult.lat,
          lng: geocodeResult.lng
        },
        'location.formattedAddress': geocodeResult.formattedAddress,
        updatedAt: new Date()
      };

      const result = await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: locationUpdate }
      );

      if (result.matchedCount === 0) {
        throw new Error('User not found');
      }

      await auditLogger.log(
        auditLogger.eventTypes.USER.UPDATE,
        { userId, location: locationUpdate },
        { severity: auditLogger.severityLevels.INFO }
      );

      return {
        postalCode,
        coordinates: locationUpdate['location.coordinates'],
        formattedAddress: locationUpdate['location.formattedAddress']
      };
    } catch (err) {
      console.error('Error updating user location:', err);
      throw err;
    }
  }
}

module.exports = new UserManager(); 