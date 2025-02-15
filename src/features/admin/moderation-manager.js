import { getDb } from '../../config/db.js';
import { ObjectId } from 'mongodb';

class ModerationManager {
  /**
   * Ban a user
   * @param {string} userId User ID
   * @param {string} reason Ban reason
   * @param {string} adminId Admin ID
   * @returns {Promise<Object>} Updated user
   */
  async banUser(userId, reason, adminId) {
    try {
      const db = getDb();
      const now = new Date();

      // Update user status
      const result = await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        {
          $set: {
            status: 'banned',
            bannedAt: now,
            bannedBy: new ObjectId(adminId),
            banReason: reason,
          },
        },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new Error('User not found');
      }

      // Log the action
      await this.logModeration({
        type: 'user_ban',
        userId: new ObjectId(userId),
        adminId: new ObjectId(adminId),
        reason,
        timestamp: now,
      });

      return result.value;
    } catch (error) {
      console.error('Error banning user:', error);
      throw error;
    }
  }

  /**
   * Unban a user
   * @param {string} userId User ID
   * @param {string} adminId Admin ID
   * @returns {Promise<Object>} Updated user
   */
  async unbanUser(userId, adminId) {
    try {
      const db = getDb();
      const now = new Date();

      // Update user status
      const result = await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        {
          $set: {
            status: 'active',
            unbannedAt: now,
            unbannedBy: new ObjectId(adminId),
          },
          $unset: {
            bannedAt: '',
            bannedBy: '',
            banReason: '',
          },
        },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new Error('User not found');
      }

      // Log the action
      await this.logModeration({
        type: 'user_unban',
        userId: new ObjectId(userId),
        adminId: new ObjectId(adminId),
        timestamp: now,
      });

      return result.value;
    } catch (error) {
      console.error('Error unbanning user:', error);
      throw error;
    }
  }

  /**
   * Remove a comment
   * @param {string} commentId Comment ID
   * @param {string} reason Removal reason
   * @param {string} adminId Admin ID
   * @returns {Promise<Object>} Removed comment
   */
  async removeComment(commentId, reason, adminId) {
    try {
      const db = getDb();
      const now = new Date();

      // Update comment status
      const result = await db.collection('comments').findOneAndUpdate(
        { _id: new ObjectId(commentId) },
        {
          $set: {
            status: 'removed',
            removedAt: now,
            removedBy: new ObjectId(adminId),
            removalReason: reason,
          },
        },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new Error('Comment not found');
      }

      // Log the action
      await this.logModeration({
        type: 'comment_removal',
        commentId: new ObjectId(commentId),
        adminId: new ObjectId(adminId),
        reason,
        timestamp: now,
      });

      return result.value;
    } catch (error) {
      console.error('Error removing comment:', error);
      throw error;
    }
  }

  /**
   * Get moderation logs
   * @param {Object} options Query options
   * @returns {Promise<Array>} Moderation logs
   */
  async getModerationLogs({
    type = null,
    userId = null,
    adminId = null,
    startDate = null,
    endDate = null,
    limit = 50,
    offset = 0,
  } = {}) {
    try {
      const db = getDb();

      // Build query
      const query = {};
      if (type) query.type = type;
      if (userId) query.userId = new ObjectId(userId);
      if (adminId) query.adminId = new ObjectId(adminId);
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      // Get logs with pagination
      const logs = await db
        .collection('moderation_logs')
        .find(query)
        .sort({ timestamp: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      // Get total count
      const total = await db.collection('moderation_logs').countDocuments(query);

      return {
        logs,
        total,
        offset,
        limit,
      };
    } catch (error) {
      console.error('Error getting moderation logs:', error);
      throw error;
    }
  }

  /**
   * Log a moderation action
   * @param {Object} log Log data
   * @returns {Promise<Object>} Created log
   */
  async logModeration(log) {
    try {
      const db = getDb();
      const result = await db.collection('moderation_logs').insertOne(log);
      return { ...log, _id: result.insertedId };
    } catch (error) {
      console.error('Error logging moderation action:', error);
      throw error;
    }
  }
}

export default new ModerationManager();
