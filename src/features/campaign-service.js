const { getDb } = require('../db');
const { ObjectId } = require('mongodb');

class CampaignService {
  constructor() {
    this.CAMPAIGN_TYPES = {
      BANNER: 'banner',
      FEATURED_RECIPE: 'featured_recipe',
      PROMOTED_USER: 'promoted_user',
      NEWSLETTER: 'newsletter',
      PUSH_NOTIFICATION: 'push_notification',
    };

    this.CAMPAIGN_STATUS = {
      DRAFT: 'draft',
      SCHEDULED: 'scheduled',
      ACTIVE: 'active',
      PAUSED: 'paused',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled',
    };
  }

  async createCampaign(campaignData) {
    const db = getDb();
    const campaign = {
      ...campaignData,
      metrics: {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
      },
      status: this.CAMPAIGN_STATUS.DRAFT,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await db.collection('campaigns').insertOne(campaign);
    return result.insertedId;
  }

  async updateCampaign(campaignId, updates) {
    const db = getDb();
    const result = await db.collection('campaigns').updateOne(
      { _id: new ObjectId(campaignId) },
      {
        $set: {
          ...updates,
          updated_at: new Date(),
        },
      }
    );
    return result.modifiedCount > 0;
  }

  async getCampaign(campaignId) {
    const db = getDb();
    return await db.collection('campaigns').findOne({ _id: new ObjectId(campaignId) });
  }

  async listCampaigns(filter = {}, page = 1, limit = 20) {
    const db = getDb();
    const skip = (page - 1) * limit;

    const pipeline = [
      { $match: filter },
      { $sort: { created_at: -1 } },
      {
        $facet: {
          campaigns: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await db.collection('campaigns').aggregate(pipeline).toArray();

    return {
      campaigns: result.campaigns,
      pagination: {
        total: result.totalCount[0]?.count || 0,
        page,
        limit,
        pages: Math.ceil((result.totalCount[0]?.count || 0) / limit),
      },
    };
  }

  async deleteCampaign(campaignId) {
    const db = getDb();
    const result = await db.collection('campaigns').deleteOne({ _id: new ObjectId(campaignId) });
    return result.deletedCount > 0;
  }

  async updateCampaignStatus(campaignId, status) {
    const db = getDb();
    const result = await db.collection('campaigns').updateOne(
      { _id: new ObjectId(campaignId) },
      {
        $set: {
          status,
          updated_at: new Date(),
        },
      }
    );
    return result.modifiedCount > 0;
  }

  async recordImpression(campaignId) {
    const db = getDb();
    await db.collection('campaigns').updateOne(
      { _id: new ObjectId(campaignId) },
      {
        $inc: { 'metrics.impressions': 1 },
        $set: { updated_at: new Date() },
      }
    );

    await db.collection('campaign_events').insertOne({
      campaign_id: new ObjectId(campaignId),
      type: 'impression',
      timestamp: new Date(),
    });
  }

  async recordClick(campaignId, userId = null) {
    const db = getDb();
    await db.collection('campaigns').updateOne(
      { _id: new ObjectId(campaignId) },
      {
        $inc: { 'metrics.clicks': 1 },
        $set: { updated_at: new Date() },
      }
    );

    await db.collection('campaign_events').insertOne({
      campaign_id: new ObjectId(campaignId),
      user_id: userId ? new ObjectId(userId) : null,
      type: 'click',
      timestamp: new Date(),
    });
  }

  async recordConversion(campaignId, userId, conversionData) {
    const db = getDb();
    await db.collection('campaigns').updateOne(
      { _id: new ObjectId(campaignId) },
      {
        $inc: {
          'metrics.conversions': 1,
          'metrics.spend': conversionData.value || 0,
        },
        $set: { updated_at: new Date() },
      }
    );

    await db.collection('campaign_events').insertOne({
      campaign_id: new ObjectId(campaignId),
      user_id: new ObjectId(userId),
      type: 'conversion',
      data: conversionData,
      timestamp: new Date(),
    });
  }

  async getCampaignMetrics(campaignId, startDate, endDate) {
    const db = getDb();
    const pipeline = [
      {
        $match: {
          campaign_id: new ObjectId(campaignId),
          timestamp: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        },
      },
      {
        $group: {
          _id: {
            type: '$type',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          },
          count: { $sum: 1 },
          value: {
            $sum: {
              $cond: [{ $eq: ['$type', 'conversion'] }, { $ifNull: ['$data.value', 0] }, 0],
            },
          },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          metrics: {
            $push: {
              type: '$_id.type',
              count: '$count',
              value: '$value',
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ];

    return await db.collection('campaign_events').aggregate(pipeline).toArray();
  }

  async getActiveCampaigns(type = null) {
    const db = getDb();
    const query = {
      status: this.CAMPAIGN_STATUS.ACTIVE,
      start_date: { $lte: new Date() },
      end_date: { $gte: new Date() },
    };

    if (type) {
      query.type = type;
    }

    return await db.collection('campaigns').find(query).toArray();
  }
}

module.exports = new CampaignService();
