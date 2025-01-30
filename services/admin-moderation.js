const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const auditLogger = require('./audit-logger');
const sessionManager = require('./session-manager');

class AdminModerationManager {
  constructor() {
    this.BAN_TYPES = {
      TEMPORARY: 'temporary',
      PERMANENT: 'permanent'
    };

    this.BAN_REASONS = {
      TOS_VIOLATION: 'tos_violation',
      HARASSMENT: 'harassment',
      SPAM: 'spam',
      INAPPROPRIATE_CONTENT: 'inappropriate_content',
      SECURITY_VIOLATION: 'security_violation',
      OTHER: 'other'
    };

    this.CONTENT_REMOVAL_REASONS = {
      COPYRIGHT: 'copyright',
      INAPPROPRIATE: 'inappropriate',
      MISINFORMATION: 'misinformation',
      SPAM: 'spam',
      TOS_VIOLATION: 'tos_violation',
      OTHER: 'other'
    };
  }

  async banUser(userId, adminId, type, reason, details = '', duration = null) {
    try {
      if (!Object.values(this.BAN_TYPES).includes(type)) {
        throw new Error('Invalid ban type');
      }

      if (!Object.values(this.BAN_REASONS).includes(reason)) {
        throw new Error('Invalid ban reason');
      }

      const db = getDb();
      
      // Check if user exists and is not already banned
      const user = await db.collection('users').findOne({
        _id: new ObjectId(userId),
        isBanned: { $ne: true }
      });

      if (!user) {
        throw new Error('User not found or already banned');
      }

      const banData = {
        userId: new ObjectId(userId),
        adminId: new ObjectId(adminId),
        type,
        reason,
        details,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (type === this.BAN_TYPES.TEMPORARY && duration) {
        banData.expiresAt = new Date(Date.now() + duration);
      }

      // Start transaction
      const session = db.client.startSession();
      try {
        await session.withTransaction(async () => {
          // Create ban record
          await db.collection('user_bans').insertOne(banData, { session });

          // Update user status
          await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            {
              $set: {
                isBanned: true,
                banExpiresAt: banData.expiresAt || null,
                updatedAt: new Date()
              }
            },
            { session }
          );
        });
      } finally {
        await session.endSession();
      }

      // Invalidate all user sessions
      await sessionManager.invalidateAllSessions(userId);

      await auditLogger.log(
        auditLogger.eventTypes.ADMIN.USER_BAN,
        { userId, adminId, type, reason },
        { severity: auditLogger.severityLevels.WARNING }
      );

      return true;
    } catch (err) {
      console.error('Error banning user:', err);
      throw err;
    }
  }

  async unbanUser(userId, adminId, reason = '') {
    try {
      const db = getDb();
      
      // Check if user exists and is banned
      const user = await db.collection('users').findOne({
        _id: new ObjectId(userId),
        isBanned: true
      });

      if (!user) {
        throw new Error('User not found or not banned');
      }

      // Start transaction
      const session = db.client.startSession();
      try {
        await session.withTransaction(async () => {
          // Update latest ban record
          await db.collection('user_bans').updateOne(
            { userId: new ObjectId(userId) },
            {
              $set: {
                unbannedAt: new Date(),
                unbannedBy: new ObjectId(adminId),
                unbanReason: reason,
                updatedAt: new Date()
              }
            },
            { session }
          );

          // Update user status
          await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            {
              $set: {
                isBanned: false,
                banExpiresAt: null,
                updatedAt: new Date()
              }
            },
            { session }
          );
        });
      } finally {
        await session.endSession();
      }

      await auditLogger.log(
        auditLogger.eventTypes.ADMIN.USER_UNBAN,
        { userId, adminId, reason },
        { severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error unbanning user:', err);
      throw err;
    }
  }

  async removeContent(contentType, contentId, adminId, reason, details = '') {
    try {
      if (!Object.values(this.CONTENT_REMOVAL_REASONS).includes(reason)) {
        throw new Error('Invalid removal reason');
      }

      const db = getDb();
      
      // Check if content exists
      const content = await db.collection(contentType + 's').findOne({
        _id: new ObjectId(contentId),
        isRemoved: { $ne: true }
      });

      if (!content) {
        throw new Error('Content not found or already removed');
      }

      const removalData = {
        contentType,
        contentId: new ObjectId(contentId),
        adminId: new ObjectId(adminId),
        reason,
        details,
        createdAt: new Date()
      };

      // Start transaction
      const session = db.client.startSession();
      try {
        await session.withTransaction(async () => {
          // Create removal record
          await db.collection('content_removals').insertOne(removalData, { session });

          // Update content status
          await db.collection(contentType + 's').updateOne(
            { _id: new ObjectId(contentId) },
            {
              $set: {
                isRemoved: true,
                removedAt: new Date(),
                removedBy: new ObjectId(adminId),
                updatedAt: new Date()
              }
            },
            { session }
          );
        });
      } finally {
        await session.endSession();
      }

      await auditLogger.log(
        auditLogger.eventTypes.ADMIN.CONTENT_REMOVE,
        { contentType, contentId, adminId, reason },
        { severity: auditLogger.severityLevels.WARNING }
      );

      return true;
    } catch (err) {
      console.error('Error removing content:', err);
      throw err;
    }
  }

  async restoreContent(contentType, contentId, adminId, reason = '') {
    try {
      const db = getDb();
      
      // Check if content exists and is removed
      const content = await db.collection(contentType + 's').findOne({
        _id: new ObjectId(contentId),
        isRemoved: true
      });

      if (!content) {
        throw new Error('Content not found or not removed');
      }

      // Start transaction
      const session = db.client.startSession();
      try {
        await session.withTransaction(async () => {
          // Update latest removal record
          await db.collection('content_removals').updateOne(
            { contentId: new ObjectId(contentId) },
            {
              $set: {
                restoredAt: new Date(),
                restoredBy: new ObjectId(adminId),
                restoreReason: reason,
                updatedAt: new Date()
              }
            },
            { session }
          );

          // Update content status
          await db.collection(contentType + 's').updateOne(
            { _id: new ObjectId(contentId) },
            {
              $set: {
                isRemoved: false,
                removedAt: null,
                removedBy: null,
                updatedAt: new Date()
              }
            },
            { session }
          );
        });
      } finally {
        await session.endSession();
      }

      await auditLogger.log(
        auditLogger.eventTypes.ADMIN.CONTENT_RESTORE,
        { contentType, contentId, adminId, reason },
        { severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error restoring content:', err);
      throw err;
    }
  }

  async getBannedUsers(filters = {}, page = 1, limit = 20) {
    try {
      const db = getDb();
      
      const query = { isBanned: true };
      if (filters.type) {
        query['banType'] = filters.type;
      }

      const users = await db.collection('users')
        .aggregate([
          {
            $match: query
          },
          {
            $lookup: {
              from: 'user_bans',
              localField: '_id',
              foreignField: 'userId',
              as: 'banInfo'
            }
          },
          {
            $unwind: '$banInfo'
          },
          {
            $sort: { 'banInfo.createdAt': -1 }
          },
          {
            $skip: (page - 1) * limit
          },
          {
            $limit: limit
          },
          {
            $project: {
              _id: 1,
              username: 1,
              displayName: 1,
              email: 1,
              banType: '$banInfo.type',
              banReason: '$banInfo.reason',
              bannedAt: '$banInfo.createdAt',
              expiresAt: '$banInfo.expiresAt'
            }
          }
        ])
        .toArray();

      const total = await db.collection('users').countDocuments(query);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (err) {
      console.error('Error getting banned users:', err);
      throw err;
    }
  }

  async getRemovedContent(filters = {}, page = 1, limit = 20) {
    try {
      const db = getDb();
      
      const query = {};
      if (filters.contentType) {
        query.contentType = filters.contentType;
      }
      if (filters.reason) {
        query.reason = filters.reason;
      }

      const removals = await db.collection('content_removals')
        .aggregate([
          {
            $match: query
          },
          {
            $lookup: {
              from: 'users',
              localField: 'adminId',
              foreignField: '_id',
              as: 'admin'
            }
          },
          {
            $unwind: '$admin'
          },
          {
            $sort: { createdAt: -1 }
          },
          {
            $skip: (page - 1) * limit
          },
          {
            $limit: limit
          },
          {
            $project: {
              contentType: 1,
              contentId: 1,
              reason: 1,
              details: 1,
              createdAt: 1,
              admin: {
                _id: 1,
                username: 1,
                displayName: 1
              }
            }
          }
        ])
        .toArray();

      const total = await db.collection('content_removals').countDocuments(query);

      return {
        removals,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (err) {
      console.error('Error getting removed content:', err);
      throw err;
    }
  }
}

module.exports = new AdminModerationManager(); 