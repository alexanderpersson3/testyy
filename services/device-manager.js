const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const auditLogger = require('./audit-logger');
const sessionManager = require('./session-manager');
const UAParser = require('ua-parser-js');

class DeviceManager {
  constructor() {
    this.DEVICE_TYPES = {
      MOBILE: 'mobile',
      TABLET: 'tablet',
      DESKTOP: 'desktop',
      OTHER: 'other'
    };
  }

  parseUserAgent(userAgent) {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    
    return {
      deviceType: this._getDeviceType(result),
      browser: {
        name: result.browser.name || 'Unknown',
        version: result.browser.version || 'Unknown'
      },
      os: {
        name: result.os.name || 'Unknown',
        version: result.os.version || 'Unknown'
      },
      device: {
        vendor: result.device.vendor || 'Unknown',
        model: result.device.model || 'Unknown'
      }
    };
  }

  _getDeviceType(parsedUA) {
    if (parsedUA.device.type === 'mobile') return this.DEVICE_TYPES.MOBILE;
    if (parsedUA.device.type === 'tablet') return this.DEVICE_TYPES.TABLET;
    if (!parsedUA.device.type) return this.DEVICE_TYPES.DESKTOP;
    return this.DEVICE_TYPES.OTHER;
  }

  async recordDeviceAccess(userId, sessionId, userAgent, ipAddress) {
    try {
      const db = getDb();
      const deviceInfo = this.parseUserAgent(userAgent);
      
      const deviceAccess = {
        userId: new ObjectId(userId),
        sessionId: new ObjectId(sessionId),
        deviceInfo,
        ipAddress,
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };

      await db.collection('device_access').updateOne(
        {
          userId: new ObjectId(userId),
          sessionId: new ObjectId(sessionId)
        },
        {
          $set: {
            ...deviceAccess,
            lastSeen: new Date()
          }
        },
        { upsert: true }
      );

      await auditLogger.log(
        auditLogger.eventTypes.USER.DEVICE_ACCESS,
        { userId, sessionId, deviceInfo },
        { severity: auditLogger.severityLevels.INFO }
      );

      return deviceAccess;
    } catch (err) {
      console.error('Error recording device access:', err);
      throw err;
    }
  }

  async getDeviceHistory(userId, options = {}) {
    try {
      const db = getDb();
      const { page = 1, limit = 20, includeInactive = false } = options;
      
      const query = {
        userId: new ObjectId(userId)
      };

      if (!includeInactive) {
        query.isActive = true;
      }

      const devices = await db.collection('device_access')
        .find(query)
        .sort({ lastSeen: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      const total = await db.collection('device_access').countDocuments(query);

      return {
        devices,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (err) {
      console.error('Error getting device history:', err);
      throw err;
    }
  }

  async revokeDeviceAccess(userId, sessionId) {
    try {
      const db = getDb();
      
      // Start transaction
      const session = db.client.startSession();
      try {
        await session.withTransaction(async () => {
          // Update device access record
          await db.collection('device_access').updateOne(
            {
              userId: new ObjectId(userId),
              sessionId: new ObjectId(sessionId),
              isActive: true
            },
            {
              $set: {
                isActive: false,
                revokedAt: new Date()
              }
            },
            { session }
          );

          // Invalidate the session
          await sessionManager.invalidateSession(sessionId, userId);
        });
      } finally {
        await session.endSession();
      }

      await auditLogger.log(
        auditLogger.eventTypes.USER.DEVICE_REVOKE,
        { userId, sessionId },
        { severity: auditLogger.severityLevels.WARNING }
      );

      return true;
    } catch (err) {
      console.error('Error revoking device access:', err);
      throw err;
    }
  }

  async revokeAllDevices(userId, currentSessionId) {
    try {
      const db = getDb();
      
      // Start transaction
      const session = db.client.startSession();
      try {
        await session.withTransaction(async () => {
          // Update all device access records except current session
          await db.collection('device_access').updateMany(
            {
              userId: new ObjectId(userId),
              sessionId: { $ne: new ObjectId(currentSessionId) },
              isActive: true
            },
            {
              $set: {
                isActive: false,
                revokedAt: new Date()
              }
            },
            { session }
          );

          // Invalidate all sessions except current
          await sessionManager.invalidateAllSessions(userId, currentSessionId);
        });
      } finally {
        await session.endSession();
      }

      await auditLogger.log(
        auditLogger.eventTypes.USER.DEVICE_REVOKE_ALL,
        { userId, excludedSessionId: currentSessionId },
        { severity: auditLogger.severityLevels.WARNING }
      );

      return true;
    } catch (err) {
      console.error('Error revoking all devices:', err);
      throw err;
    }
  }
}

module.exports = new DeviceManager(); 