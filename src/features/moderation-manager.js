const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const auditLogger = require('./audit-logger');

class ModerationManager {
  constructor() {
    this.REPORT_TYPES = {
      SPAM: 'spam',
      INAPPROPRIATE: 'inappropriate',
      HARASSMENT: 'harassment',
      MISINFORMATION: 'misinformation',
      COPYRIGHT: 'copyright',
      OTHER: 'other',
    };

    this.REPORT_STATUS = {
      PENDING: 'pending',
      REVIEWED: 'reviewed',
      RESOLVED: 'resolved',
      DISMISSED: 'dismissed',
    };

    this.CONTENT_TYPES = {
      RECIPE: 'recipe',
      REVIEW: 'review',
      COMMENT: 'comment',
      USER: 'user',
      INGREDIENT: 'ingredient',
    };
  }

  async blockUser(blockerId, blockedId) {
    try {
      if (blockerId === blockedId) {
        throw new Error('Cannot block yourself');
      }

      const db = getDb();

      // Check if users exist
      const [blocker, blocked] = await Promise.all([
        db.collection('users').findOne({ _id: new ObjectId(blockerId) }),
        db.collection('users').findOne({ _id: new ObjectId(blockedId) }),
      ]);

      if (!blocker || !blocked) {
        throw new Error('User not found');
      }

      // Add block
      await db.collection('user_blocks').updateOne(
        {
          blockerId: new ObjectId(blockerId),
          blockedId: new ObjectId(blockedId),
        },
        {
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      await auditLogger.log(
        auditLogger.eventTypes.USER.BLOCK,
        { blockerId, blockedId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error blocking user:', err);
      throw err;
    }
  }

  async unblockUser(blockerId, blockedId) {
    try {
      const db = getDb();

      const result = await db.collection('user_blocks').deleteOne({
        blockerId: new ObjectId(blockerId),
        blockedId: new ObjectId(blockedId),
      });

      if (result.deletedCount === 0) {
        throw new Error('Block not found');
      }

      await auditLogger.log(
        auditLogger.eventTypes.USER.UNBLOCK,
        { blockerId, blockedId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error unblocking user:', err);
      throw err;
    }
  }

  async getBlockedUsers(userId) {
    try {
      const db = getDb();

      const blocks = await db
        .collection('user_blocks')
        .aggregate([
          {
            $match: { blockerId: new ObjectId(userId) },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'blockedId',
              foreignField: '_id',
              as: 'blockedUser',
            },
          },
          {
            $unwind: '$blockedUser',
          },
          {
            $project: {
              _id: '$blockedUser._id',
              username: '$blockedUser.username',
              displayName: '$blockedUser.displayName',
              blockedAt: '$createdAt',
            },
          },
        ])
        .toArray();

      return blocks;
    } catch (err) {
      console.error('Error getting blocked users:', err);
      throw err;
    }
  }

  async muteUser(muterId, mutedId, duration = null) {
    try {
      if (muterId === mutedId) {
        throw new Error('Cannot mute yourself');
      }

      const db = getDb();

      // Check if users exist
      const [muter, muted] = await Promise.all([
        db.collection('users').findOne({ _id: new ObjectId(muterId) }),
        db.collection('users').findOne({ _id: new ObjectId(mutedId) }),
      ]);

      if (!muter || !muted) {
        throw new Error('User not found');
      }

      const muteData = {
        muterId: new ObjectId(muterId),
        mutedId: new ObjectId(mutedId),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (duration) {
        muteData.expiresAt = new Date(Date.now() + duration);
      }

      // Add mute
      await db.collection('user_mutes').updateOne(
        {
          muterId: new ObjectId(muterId),
          mutedId: new ObjectId(mutedId),
        },
        {
          $set: muteData,
        },
        { upsert: true }
      );

      await auditLogger.log(
        auditLogger.eventTypes.USER.MUTE,
        { muterId, mutedId, duration },
        { severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error muting user:', err);
      throw err;
    }
  }

  async unmuteUser(muterId, mutedId) {
    try {
      const db = getDb();

      const result = await db.collection('user_mutes').deleteOne({
        muterId: new ObjectId(muterId),
        mutedId: new ObjectId(mutedId),
      });

      if (result.deletedCount === 0) {
        throw new Error('Mute not found');
      }

      await auditLogger.log(
        auditLogger.eventTypes.USER.UNMUTE,
        { muterId, mutedId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error unmuting user:', err);
      throw err;
    }
  }

  async getMutedUsers(userId) {
    try {
      const db = getDb();

      const mutes = await db
        .collection('user_mutes')
        .aggregate([
          {
            $match: {
              muterId: new ObjectId(userId),
              $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: { $exists: false } }],
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'mutedId',
              foreignField: '_id',
              as: 'mutedUser',
            },
          },
          {
            $unwind: '$mutedUser',
          },
          {
            $project: {
              _id: '$mutedUser._id',
              username: '$mutedUser.username',
              displayName: '$mutedUser.displayName',
              mutedAt: '$createdAt',
              expiresAt: 1,
            },
          },
        ])
        .toArray();

      return mutes;
    } catch (err) {
      console.error('Error getting muted users:', err);
      throw err;
    }
  }

  async reportContent(userId, contentType, contentId, reason, details = '') {
    try {
      if (!Object.values(this.CONTENT_TYPES).includes(contentType)) {
        throw new Error('Invalid content type');
      }

      if (!Object.values(this.REPORT_TYPES).includes(reason)) {
        throw new Error('Invalid report reason');
      }

      const db = getDb();

      // Check if content exists
      const content = await db.collection(contentType + 's').findOne({
        _id: new ObjectId(contentId),
      });

      if (!content) {
        throw new Error('Content not found');
      }

      // Create report
      const report = {
        userId: new ObjectId(userId),
        contentType,
        contentId: new ObjectId(contentId),
        reason,
        details,
        status: this.REPORT_STATUS.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection('reports').insertOne(report);

      await auditLogger.log(
        auditLogger.eventTypes.USER.REPORT,
        { userId, contentType, contentId, reason },
        { severity: auditLogger.severityLevels.WARNING }
      );

      return true;
    } catch (err) {
      console.error('Error reporting content:', err);
      throw err;
    }
  }

  async getReports(filters = {}, page = 1, limit = 20) {
    try {
      const db = getDb();

      const query = {};
      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.contentType) {
        query.contentType = filters.contentType;
      }
      if (filters.reason) {
        query.reason = filters.reason;
      }

      const reports = await db
        .collection('reports')
        .aggregate([
          {
            $match: query,
          },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'reporter',
            },
          },
          {
            $unwind: '$reporter',
          },
          {
            $sort: { createdAt: -1 },
          },
          {
            $skip: (page - 1) * limit,
          },
          {
            $limit: limit,
          },
          {
            $project: {
              contentType: 1,
              contentId: 1,
              reason: 1,
              details: 1,
              status: 1,
              createdAt: 1,
              reporter: {
                _id: 1,
                username: 1,
                displayName: 1,
              },
            },
          },
        ])
        .toArray();

      const total = await db.collection('reports').countDocuments(query);

      return {
        reports,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (err) {
      console.error('Error getting reports:', err);
      throw err;
    }
  }
}

module.exports = new ModerationManager();
