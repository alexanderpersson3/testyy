const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const auditLogger = require('./audit-logger');

class SessionManager {
  constructor() {
    this.ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
    this.REFRESH_TOKEN_EXPIRY = '7d'; // 7 days
    this.REFRESH_TOKEN_LENGTH = 64;
  }

  async createSession(userId, deviceInfo = {}) {
    try {
      const db = getDb();

      // Generate refresh token
      const refreshToken = crypto.randomBytes(this.REFRESH_TOKEN_LENGTH / 2).toString('hex');
      const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Create session record
      const session = {
        userId: new ObjectId(userId),
        refreshToken,
        expiresAt: refreshTokenExpiry,
        deviceInfo: {
          userAgent: deviceInfo.userAgent,
          ip: deviceInfo.ip,
          deviceType: deviceInfo.deviceType || 'unknown',
        },
        isActive: true,
        createdAt: new Date(),
        lastUsedAt: new Date(),
      };

      await db.collection('sessions').insertOne(session);

      // Generate access token
      const accessToken = jwt.sign(
        { userId, sessionId: session._id.toString() },
        process.env.JWT_SECRET,
        { expiresIn: this.ACCESS_TOKEN_EXPIRY }
      );

      await auditLogger.log(
        auditLogger.eventTypes.USER.LOGIN,
        { userId, sessionId: session._id },
        {
          severity: auditLogger.severityLevels.INFO,
          ipAddress: deviceInfo.ip,
        }
      );

      return {
        accessToken,
        refreshToken,
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
      };
    } catch (err) {
      console.error('Error creating session:', err);
      throw err;
    }
  }

  async refreshSession(refreshToken, deviceInfo = {}) {
    try {
      const db = getDb();

      // Find and validate refresh token
      const session = await db.collection('sessions').findOne({
        refreshToken,
        isActive: true,
        expiresAt: { $gt: new Date() },
      });

      if (!session) {
        throw new Error('Invalid or expired refresh token');
      }

      // Generate new access token
      const accessToken = jwt.sign(
        { userId: session.userId.toString(), sessionId: session._id.toString() },
        process.env.JWT_SECRET,
        { expiresIn: this.ACCESS_TOKEN_EXPIRY }
      );

      // Update session last used time
      await db.collection('sessions').updateOne(
        { _id: session._id },
        {
          $set: {
            lastUsedAt: new Date(),
            'deviceInfo.ip': deviceInfo.ip,
          },
        }
      );

      await auditLogger.log(
        auditLogger.eventTypes.SECURITY.TOKEN_REFRESH,
        { userId: session.userId, sessionId: session._id },
        {
          severity: auditLogger.severityLevels.INFO,
          ipAddress: deviceInfo.ip,
        }
      );

      return {
        accessToken,
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
      };
    } catch (err) {
      console.error('Error refreshing session:', err);
      throw err;
    }
  }

  async invalidateSession(sessionId, userId) {
    try {
      const db = getDb();

      const result = await db.collection('sessions').updateOne(
        {
          _id: new ObjectId(sessionId),
          userId: new ObjectId(userId),
        },
        {
          $set: {
            isActive: false,
            invalidatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('Session not found or unauthorized');
      }

      await auditLogger.log(
        auditLogger.eventTypes.USER.SESSION_INVALIDATE,
        { userId, sessionId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error invalidating session:', err);
      throw err;
    }
  }

  async invalidateAllSessions(userId, currentSessionId = null) {
    try {
      const db = getDb();

      const query = {
        userId: new ObjectId(userId),
        isActive: true,
      };

      // Optionally exclude current session
      if (currentSessionId) {
        query._id = { $ne: new ObjectId(currentSessionId) };
      }

      const result = await db.collection('sessions').updateMany(query, {
        $set: {
          isActive: false,
          invalidatedAt: new Date(),
        },
      });

      await auditLogger.log(
        auditLogger.eventTypes.USER.SESSION_INVALIDATE_ALL,
        { userId, excludedSessionId: currentSessionId },
        { severity: auditLogger.severityLevels.WARNING }
      );

      return result.modifiedCount;
    } catch (err) {
      console.error('Error invalidating all sessions:', err);
      throw err;
    }
  }

  async getActiveSessions(userId) {
    try {
      const db = getDb();

      const sessions = await db
        .collection('sessions')
        .find({
          userId: new ObjectId(userId),
          isActive: true,
          expiresAt: { $gt: new Date() },
        })
        .project({
          refreshToken: 0, // Exclude refresh token from results
        })
        .sort({ lastUsedAt: -1 })
        .toArray();

      return sessions;
    } catch (err) {
      console.error('Error getting active sessions:', err);
      throw err;
    }
  }

  async cleanupExpiredSessions() {
    try {
      const db = getDb();
      await db.collection('sessions').deleteMany({
        $or: [{ expiresAt: { $lt: new Date() } }, { isActive: false }],
      });
    } catch (err) {
      console.error('Error cleaning up expired sessions:', err);
      throw err;
    }
  }
}

module.exports = new SessionManager();
