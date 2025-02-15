const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const auditLogger = require('./audit-logger');

class AdManager {
  constructor() {
    this.AD_TYPES = {
      BANNER: 'banner',
      INTERSTITIAL: 'interstitial',
      NATIVE: 'native',
    };

    this.AD_STATUS = {
      ACTIVE: 'active',
      INACTIVE: 'inactive',
      SCHEDULED: 'scheduled',
      EXPIRED: 'expired',
    };

    this.TARGETING_TYPES = {
      REGION: 'region',
      LANGUAGE: 'language',
      CUISINE: 'cuisine',
      DIET: 'diet',
    };
  }

  async shouldShowAds(userId) {
    try {
      const db = getDb();
      const user = await db
        .collection('users')
        .findOne(
          { _id: new ObjectId(userId) },
          { projection: { subscription_tier: 1, ad_preferences: 1 } }
        );

      return user?.subscription_tier === 'FREE';
    } catch (err) {
      console.error('Error checking ad eligibility:', err);
      return false;
    }
  }

  async getAds(userId, type, count = 1) {
    try {
      const shouldShow = await this.shouldShowAds(userId);
      if (!shouldShow) {
        return [];
      }

      const db = getDb();
      const user = await db
        .collection('users')
        .findOne(
          { _id: new ObjectId(userId) },
          { projection: { preferences: 1, region: 1, language: 1 } }
        );

      const query = {
        type,
        status: this.AD_STATUS.ACTIVE,
        start_date: { $lte: new Date() },
        end_date: { $gt: new Date() },
      };

      // Add targeting criteria if user has preferences
      if (user?.preferences) {
        query['targeting.region'] = user.region;
        query['targeting.language'] = user.language;
      }

      const ads = await db
        .collection('ads')
        .aggregate([{ $match: query }, { $sample: { size: count } }])
        .toArray();

      // Track impressions
      if (ads.length > 0) {
        await this.trackImpressions(
          userId,
          ads.map(ad => ad._id)
        );
      }

      return ads;
    } catch (err) {
      console.error('Error getting ads:', err);
      return [];
    }
  }

  async createAd(adData) {
    try {
      const db = getDb();
      const ad = {
        ...adData,
        status: this.AD_STATUS.ACTIVE,
        created_at: new Date(),
        updated_at: new Date(),
        impressions: 0,
        clicks: 0,
      };

      const result = await db.collection('ads').insertOne(ad);

      await auditLogger.log(
        'ad.create',
        { adId: result.insertedId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return result;
    } catch (err) {
      console.error('Error creating ad:', err);
      throw err;
    }
  }

  async updateAd(adId, updates) {
    try {
      const db = getDb();
      const result = await db.collection('ads').updateOne(
        { _id: new ObjectId(adId) },
        {
          $set: {
            ...updates,
            updated_at: new Date(),
          },
        }
      );

      await auditLogger.log(
        'ad.update',
        { adId, updates },
        { severity: auditLogger.severityLevels.INFO }
      );

      return result;
    } catch (err) {
      console.error('Error updating ad:', err);
      throw err;
    }
  }

  async trackImpressions(userId, adIds) {
    try {
      const db = getDb();
      const impressions = adIds.map(adId => ({
        ad_id: new ObjectId(adId),
        user_id: new ObjectId(userId),
        timestamp: new Date(),
      }));

      await db.collection('ad_impressions').insertMany(impressions);

      // Update impression counts
      await db
        .collection('ads')
        .updateMany(
          { _id: { $in: adIds.map(id => new ObjectId(id)) } },
          { $inc: { impressions: 1 } }
        );

      await auditLogger.log(
        'ad.impression',
        { userId, adIds },
        { severity: auditLogger.severityLevels.INFO }
      );
    } catch (err) {
      console.error('Error tracking impressions:', err);
    }
  }

  async trackClick(userId, adId) {
    try {
      const db = getDb();
      const click = {
        ad_id: new ObjectId(adId),
        user_id: new ObjectId(userId),
        timestamp: new Date(),
      };

      await db.collection('ad_clicks').insertOne(click);

      // Update click count
      await db.collection('ads').updateOne({ _id: new ObjectId(adId) }, { $inc: { clicks: 1 } });

      await auditLogger.log(
        'ad.click',
        { userId, adId },
        { severity: auditLogger.severityLevels.INFO }
      );
    } catch (err) {
      console.error('Error tracking click:', err);
      throw err;
    }
  }

  async getAdStats(adId) {
    try {
      const db = getDb();
      const stats = await db
        .collection('ads')
        .findOne({ _id: new ObjectId(adId) }, { projection: { impressions: 1, clicks: 1 } });

      return {
        ...stats,
        ctr: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0,
      };
    } catch (err) {
      console.error('Error getting ad stats:', err);
      throw err;
    }
  }
}

module.exports = new AdManager();
