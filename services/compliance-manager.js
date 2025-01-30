const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const auditLogger = require('./audit-logger');

class ComplianceManager {
  constructor() {
    // Consent types
    this.CONSENT_TYPES = {
      TERMS_OF_SERVICE: 'terms_of_service',
      PRIVACY_POLICY: 'privacy_policy',
      MARKETING_EMAIL: 'marketing_email',
      DATA_PROCESSING: 'data_processing',
      COOKIES: 'cookies',
      THIRD_PARTY_SHARING: 'third_party_sharing'
    };

    // Data request types
    this.REQUEST_TYPES = {
      ACCESS: 'access',
      DELETION: 'deletion',
      RECTIFICATION: 'rectification',
      PORTABILITY: 'portability',
      RESTRICTION: 'restriction'
    };

    // Request statuses
    this.REQUEST_STATUS = {
      PENDING: 'pending',
      IN_PROGRESS: 'in_progress',
      COMPLETED: 'completed',
      REJECTED: 'rejected'
    };
  }

  async recordConsent(userId, consentType, granted, metadata = {}) {
    try {
      const db = getDb();
      
      if (!Object.values(this.CONSENT_TYPES).includes(consentType)) {
        throw new Error('Invalid consent type');
      }

      const consentRecord = {
        userId: new ObjectId(userId),
        type: consentType,
        granted,
        grantedAt: new Date(),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        version: metadata.version || '1.0',
        additionalData: metadata.additionalData
      };

      await db.collection('consent_records').insertOne(consentRecord);

      await auditLogger.log(
        auditLogger.eventTypes.USER.CONSENT_RECORD,
        { userId, consentType, granted },
        { severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error recording consent:', err);
      throw err;
    }
  }

  async getConsents(userId) {
    try {
      const db = getDb();
      
      const consents = await db.collection('consent_records')
        .find({ userId: new ObjectId(userId) })
        .sort({ grantedAt: -1 })
        .toArray();

      return consents;
    } catch (err) {
      console.error('Error getting consents:', err);
      throw err;
    }
  }

  async createDataRequest(userId, requestType, details = {}) {
    try {
      const db = getDb();
      
      if (!Object.values(this.REQUEST_TYPES).includes(requestType)) {
        throw new Error('Invalid request type');
      }

      const request = {
        userId: new ObjectId(userId),
        type: requestType,
        status: this.REQUEST_STATUS.PENDING,
        details,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('data_requests').insertOne(request);

      await auditLogger.log(
        auditLogger.eventTypes.USER.DATA_REQUEST_CREATE,
        { userId, requestType },
        { severity: auditLogger.severityLevels.INFO }
      );

      return request;
    } catch (err) {
      console.error('Error creating data request:', err);
      throw err;
    }
  }

  async updateDataRequest(requestId, status, notes = '') {
    try {
      const db = getDb();
      
      if (!Object.values(this.REQUEST_STATUS).includes(status)) {
        throw new Error('Invalid request status');
      }

      const updateResult = await db.collection('data_requests').updateOne(
        { _id: new ObjectId(requestId) },
        {
          $set: {
            status,
            notes,
            updatedAt: new Date()
          }
        }
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error('Data request not found');
      }

      const request = await db.collection('data_requests').findOne({
        _id: new ObjectId(requestId)
      });

      await auditLogger.log(
        auditLogger.eventTypes.USER.DATA_REQUEST_UPDATE,
        { requestId, status, userId: request.userId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return request;
    } catch (err) {
      console.error('Error updating data request:', err);
      throw err;
    }
  }

  async getDataRequests(userId, status = null) {
    try {
      const db = getDb();
      
      const query = { userId: new ObjectId(userId) };
      if (status) {
        if (!Object.values(this.REQUEST_STATUS).includes(status)) {
          throw new Error('Invalid request status');
        }
        query.status = status;
      }

      const requests = await db.collection('data_requests')
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      return requests;
    } catch (err) {
      console.error('Error getting data requests:', err);
      throw err;
    }
  }

  async checkConsent(userId, consentType) {
    try {
      const db = getDb();
      
      const latestConsent = await db.collection('consent_records')
        .findOne(
          {
            userId: new ObjectId(userId),
            type: consentType
          },
          {
            sort: { grantedAt: -1 }
          }
        );

      return latestConsent?.granted || false;
    } catch (err) {
      console.error('Error checking consent:', err);
      throw err;
    }
  }
}

module.exports = new ComplianceManager(); 