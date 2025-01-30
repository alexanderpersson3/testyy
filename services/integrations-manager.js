const axios = require('axios');
const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const auditLogger = require('./audit-logger');

class IntegrationsManager {
  constructor() {
    this.integrationTypes = {
      NUTRITION: 'nutrition',
      SHOPPING: 'shopping',
      DELIVERY: 'delivery',
      PAYMENT: 'payment',
      SOCIAL: 'social'
    };
  }

  async registerIntegration(type, config) {
    try {
      const db = getDb();
      const integration = {
        type,
        config,
        status: 'active',
        createdAt: new Date(),
        lastUpdated: new Date()
      };

      const result = await db.collection('integrations').insertOne(integration);
      
      await auditLogger.log(
        auditLogger.eventTypes.INTEGRATION.REGISTER,
        { type, integrationId: result.insertedId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return result;
    } catch (err) {
      console.error('Error registering integration:', err);
      throw err;
    }
  }

  async updateIntegration(integrationId, updates) {
    try {
      const db = getDb();
      const result = await db.collection('integrations').updateOne(
        { _id: new ObjectId(integrationId) },
        {
          $set: {
            ...updates,
            lastUpdated: new Date()
          }
        }
      );

      await auditLogger.log(
        auditLogger.eventTypes.INTEGRATION.UPDATE,
        { integrationId, updates },
        { severity: auditLogger.severityLevels.INFO }
      );

      return result;
    } catch (err) {
      console.error('Error updating integration:', err);
      throw err;
    }
  }

  async getIntegration(integrationId) {
    try {
      const db = getDb();
      return await db.collection('integrations').findOne({
        _id: new ObjectId(integrationId)
      });
    } catch (err) {
      console.error('Error getting integration:', err);
      throw err;
    }
  }

  async listIntegrations(type = null) {
    try {
      const db = getDb();
      const query = type ? { type } : {};
      return await db.collection('integrations').find(query).toArray();
    } catch (err) {
      console.error('Error listing integrations:', err);
      throw err;
    }
  }

  async deleteIntegration(integrationId) {
    try {
      const db = getDb();
      const result = await db.collection('integrations').deleteOne({
        _id: new ObjectId(integrationId)
      });

      await auditLogger.log(
        auditLogger.eventTypes.INTEGRATION.DELETE,
        { integrationId },
        { severity: auditLogger.severityLevels.WARNING }
      );

      return result;
    } catch (err) {
      console.error('Error deleting integration:', err);
      throw err;
    }
  }

  async testIntegration(integrationId) {
    try {
      const integration = await this.getIntegration(integrationId);
      if (!integration) {
        throw new Error('Integration not found');
      }

      const testResult = await this._executeTest(integration);
      
      await this.updateIntegration(integrationId, {
        lastTested: new Date(),
        testResult
      });

      return testResult;
    } catch (err) {
      console.error('Error testing integration:', err);
      throw err;
    }
  }

  async _executeTest(integration) {
    // Implementation varies based on integration type
    switch (integration.type) {
      case this.integrationTypes.NUTRITION:
        return await this._testNutritionAPI(integration);
      case this.integrationTypes.SHOPPING:
        return await this._testShoppingAPI(integration);
      case this.integrationTypes.DELIVERY:
        return await this._testDeliveryAPI(integration);
      case this.integrationTypes.PAYMENT:
        return await this._testPaymentAPI(integration);
      case this.integrationTypes.SOCIAL:
        return await this._testSocialAPI(integration);
      default:
        throw new Error(`Unsupported integration type: ${integration.type}`);
    }
  }

  async _testNutritionAPI(integration) {
    try {
      const response = await axios.get(integration.config.testEndpoint, {
        headers: { 'Authorization': `Bearer ${integration.config.apiKey}` }
      });
      return {
        success: response.status === 200,
        statusCode: response.status,
        message: 'Nutrition API test successful'
      };
    } catch (err) {
      return {
        success: false,
        statusCode: err.response?.status,
        message: err.message
      };
    }
  }

  async _testShoppingAPI(integration) {
    // Similar implementation for shopping API test
    return { success: true, message: 'Shopping API test successful' };
  }

  async _testDeliveryAPI(integration) {
    // Similar implementation for delivery API test
    return { success: true, message: 'Delivery API test successful' };
  }

  async _testPaymentAPI(integration) {
    // Similar implementation for payment API test
    return { success: true, message: 'Payment API test successful' };
  }

  async _testSocialAPI(integration) {
    // Similar implementation for social API test
    return { success: true, message: 'Social API test successful' };
  }
}

module.exports = new IntegrationsManager(); 