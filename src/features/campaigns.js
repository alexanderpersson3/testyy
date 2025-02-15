const express = require('express');
const router = express.Router();
const { validateRequest } = require('../middleware/validation');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { z } = require('zod');
const campaignService = require('../services/campaign-service');
const { getDb } = require('../db');
const { ObjectId } = require('mongodb');

// Validation schemas
const createCampaignSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(['banner', 'featured_recipe', 'promoted_user', 'newsletter', 'push_notification']),
    description: z.string().optional(),
    target_audience: z
      .object({
        age_range: z
          .object({
            min: z.number().optional(),
            max: z.number().optional(),
          })
          .optional(),
        interests: z.array(z.string()).optional(),
        dietary_preferences: z.array(z.string()).optional(),
        locations: z.array(z.string()).optional(),
      })
      .optional(),
    content: z.object({
      title: z.string(),
      body: z.string(),
      image_url: z.string().url().optional(),
      action_url: z.string().url().optional(),
    }),
    budget: z
      .object({
        total: z.number().positive(),
        daily: z.number().positive().optional(),
      })
      .optional(),
    schedule: z.object({
      start_date: z.string().datetime(),
      end_date: z.string().datetime(),
      time_zone: z.string().optional(),
    }),
  })
  .strict();

const updateCampaignSchema = createCampaignSchema.partial();

const listCampaignsSchema = z
  .object({
    page: z.number().int().positive().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    type: z.string().optional(),
    status: z.string().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
  })
  .strict();

const recordEventSchema = z
  .object({
    user_id: z.string().optional(),
    conversion_data: z
      .object({
        value: z.number().optional(),
        details: z.record(z.any()).optional(),
      })
      .optional(),
  })
  .strict();

// Routes
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest(createCampaignSchema, 'body'),
  async (req, res) => {
    try {
      const campaignId = await campaignService.createCampaign(req.body);
      res.status(201).json({ id: campaignId });
    } catch (err) {
      console.error('Create campaign error:', err);
      res.status(500).json({ error: 'Failed to create campaign' });
    }
  }
);

router.get(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest(listCampaignsSchema, 'query'),
  async (req, res) => {
    try {
      const { page = 1, limit = 20, ...filter } = req.query;
      const results = await campaignService.listCampaigns(filter, parseInt(page), parseInt(limit));
      res.json(results);
    } catch (err) {
      console.error('List campaigns error:', err);
      res.status(500).json({ error: 'Failed to list campaigns' });
    }
  }
);

router.get('/:campaignId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const campaign = await campaignService.getCampaign(req.params.campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (err) {
    console.error('Get campaign error:', err);
    res.status(500).json({ error: 'Failed to get campaign' });
  }
});

router.put(
  '/:campaignId',
  authenticateToken,
  requireAdmin,
  validateRequest(updateCampaignSchema, 'body'),
  async (req, res) => {
    try {
      const success = await campaignService.updateCampaign(req.params.campaignId, req.body);
      if (!success) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Update campaign error:', err);
      res.status(500).json({ error: 'Failed to update campaign' });
    }
  }
);

router.delete('/:campaignId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const success = await campaignService.deleteCampaign(req.params.campaignId);
    if (!success) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete campaign error:', err);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

router.post(
  '/:campaignId/status',
  authenticateToken,
  requireAdmin,
  validateRequest(z.object({ status: z.string() }), 'body'),
  async (req, res) => {
    try {
      const success = await campaignService.updateCampaignStatus(
        req.params.campaignId,
        req.body.status
      );
      if (!success) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Update campaign status error:', err);
      res.status(500).json({ error: 'Failed to update campaign status' });
    }
  }
);

router.post('/:campaignId/impression', async (req, res) => {
  try {
    await campaignService.recordImpression(req.params.campaignId);
    res.json({ success: true });
  } catch (err) {
    console.error('Record impression error:', err);
    res.status(500).json({ error: 'Failed to record impression' });
  }
});

router.post('/:campaignId/click', validateRequest(recordEventSchema, 'body'), async (req, res) => {
  try {
    await campaignService.recordClick(req.params.campaignId, req.body.user_id);
    res.json({ success: true });
  } catch (err) {
    console.error('Record click error:', err);
    res.status(500).json({ error: 'Failed to record click' });
  }
});

router.post(
  '/:campaignId/conversion',
  authenticateToken,
  validateRequest(recordEventSchema, 'body'),
  async (req, res) => {
    try {
      await campaignService.recordConversion(
        req.params.campaignId,
        req.user.id,
        req.body.conversion_data || {}
      );
      res.json({ success: true });
    } catch (err) {
      console.error('Record conversion error:', err);
      res.status(500).json({ error: 'Failed to record conversion' });
    }
  }
);

router.get(
  '/:campaignId/metrics',
  authenticateToken,
  requireAdmin,
  validateRequest(
    z.object({
      start_date: z.string().datetime(),
      end_date: z.string().datetime(),
    }),
    'query'
  ),
  async (req, res) => {
    try {
      const metrics = await campaignService.getCampaignMetrics(
        req.params.campaignId,
        req.query.start_date,
        req.query.end_date
      );
      res.json(metrics);
    } catch (err) {
      console.error('Get campaign metrics error:', err);
      res.status(500).json({ error: 'Failed to get campaign metrics' });
    }
  }
);

router.get('/active/:type?', async (req, res) => {
  try {
    const campaigns = await campaignService.getActiveCampaigns(req.params.type);
    res.json(campaigns);
  } catch (err) {
    console.error('Get active campaigns error:', err);
    res.status(500).json({ error: 'Failed to get active campaigns' });
  }
});

// Get all campaigns
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const type = req.query.type;

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }
    if (type) {
      query.type = type;
    }

    const campaigns = await db
      .collection('campaigns')
      .find(query)
      .sort({ startDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const total = await db.collection('campaigns').countDocuments(query);

    res.json({
      campaigns,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    throw error;
  }
});

// Get active campaigns for users
router.get('/active', async (req, res) => {
  try {
    const db = getDb();
    const now = new Date();
    const userId = req.user ? new ObjectId(req.user._id) : null;

    const campaigns = await db
      .collection('campaigns')
      .aggregate([
        {
          $match: {
            status: 'ACTIVE',
            startDate: { $lte: now },
            endDate: { $gt: now },
          },
        },
        {
          $lookup: {
            from: 'campaign_participants',
            let: { campaignId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ['$campaignId', '$$campaignId'] }, { $eq: ['$userId', userId] }],
                  },
                },
              },
            ],
            as: 'participation',
          },
        },
        {
          $addFields: {
            isParticipating: {
              $gt: [{ $size: '$participation' }, 0],
            },
            progress: {
              $cond: {
                if: { $gt: [{ $size: '$participation' }, 0] },
                then: { $arrayElemAt: ['$participation.progress', 0] },
                else: 0,
              },
            },
          },
        },
      ])
      .toArray();

    res.json({ campaigns });
  } catch (error) {
    throw error;
  }
});

// Update campaign
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const campaignId = new ObjectId(req.params.id);
    const validatedData = createCampaignSchema.parse(req.body);

    const existingCampaign = await db.collection('campaigns').findOne({
      _id: campaignId,
    });

    if (!existingCampaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Convert string dates to Date objects
    const updates = {
      ...validatedData,
      startDate: new Date(validatedData.startDate),
      endDate: new Date(validatedData.endDate),
      updatedAt: new Date(),
    };

    const updateResult = await db
      .collection('campaigns')
      .findOneAndUpdate({ _id: campaignId }, { $set: updates }, { returnDocument: 'after' });

    // If campaign status changed to active, notify target users
    if (existingCampaign.status !== 'ACTIVE' && updates.status === 'ACTIVE') {
      const targetUsers = await getTargetUsers(db, updates.targetAudience);
      const notifications = targetUsers.map(userId => ({
        userId,
        type: 'NEW_CAMPAIGN',
        campaignId,
        read: false,
        createdAt: new Date(),
      }));

      if (notifications.length > 0) {
        await db.collection('notifications').insertMany(notifications);
      }
    }

    res.json(updateResult.value);
  } catch (error) {
    throw error;
  }
});

// Delete campaign
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const campaignId = new ObjectId(req.params.id);

    // Check if campaign exists
    const campaign = await db.collection('campaigns').findOne({ _id: campaignId });
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Delete campaign and related data
    await Promise.all([
      db.collection('campaigns').deleteOne({ _id: campaignId }),
      db.collection('campaign_participants').deleteMany({ campaignId }),
      db.collection('notifications').deleteMany({
        type: 'NEW_CAMPAIGN',
        campaignId,
      }),
    ]);

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    throw error;
  }
});

// Join campaign
router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const campaignId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user._id);

    // Check if campaign exists and is active
    const campaign = await db.collection('campaigns').findOne({
      _id: campaignId,
      status: 'ACTIVE',
      startDate: { $lte: new Date() },
      endDate: { $gt: new Date() },
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found or not active' });
    }

    // Check if already participating
    const existingParticipation = await db.collection('campaign_participants').findOne({
      campaignId,
      userId,
    });

    if (existingParticipation) {
      return res.status(400).json({ message: 'Already participating in campaign' });
    }

    // Create participation record
    const participation = {
      campaignId,
      userId,
      joinedAt: new Date(),
      progress: 0,
      completed: false,
      lastUpdated: new Date(),
    };

    await Promise.all([
      db.collection('campaign_participants').insertOne(participation),
      db.collection('campaigns').updateOne({ _id: campaignId }, { $inc: { participantCount: 1 } }),
    ]);

    res.json({
      message: 'Successfully joined campaign',
      participation,
    });
  } catch (error) {
    throw error;
  }
});

// Update campaign progress
router.put('/:id/progress', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const campaignId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user._id);
    const { progress } = req.body;

    if (typeof progress !== 'number' || progress < 0 || progress > 100) {
      return res.status(400).json({ message: 'Invalid progress value' });
    }

    const updateResult = await db.collection('campaign_participants').findOneAndUpdate(
      {
        campaignId,
        userId,
      },
      {
        $set: {
          progress,
          completed: progress === 100,
          lastUpdated: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!updateResult.value) {
      return res.status(404).json({ message: 'Campaign participation not found' });
    }

    // If completed, update campaign metrics
    if (progress === 100 && !updateResult.value.completed) {
      await db
        .collection('campaigns')
        .updateOne({ _id: campaignId }, { $inc: { 'metrics.completions': 1 } });

      // Create completion notification
      await db.collection('notifications').insertOne({
        userId,
        type: 'CAMPAIGN_COMPLETED',
        campaignId,
        read: false,
        createdAt: new Date(),
      });
    }

    res.json(updateResult.value);
  } catch (error) {
    throw error;
  }
});

// Get campaign analytics
router.get('/:id/analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const campaignId = new ObjectId(req.params.id);

    const campaign = await db.collection('campaigns').findOne({ _id: campaignId });
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    const [participants, completions, engagementStats] = await Promise.all([
      // Get participant demographics
      db
        .collection('campaign_participants')
        .aggregate([
          { $match: { campaignId } },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user',
            },
          },
          { $unwind: '$user' },
          {
            $group: {
              _id: null,
              totalParticipants: { $sum: 1 },
              regions: { $addToSet: '$user.region' },
              avgProgress: { $avg: '$progress' },
            },
          },
        ])
        .next(),

      // Get completion rate over time
      db
        .collection('campaign_participants')
        .aggregate([
          {
            $match: {
              campaignId,
              completed: true,
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$lastUpdated',
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray(),

      // Get engagement metrics
      db
        .collection('campaign_participants')
        .aggregate([
          { $match: { campaignId } },
          {
            $group: {
              _id: null,
              avgEngagementTime: { $avg: '$engagementTime' },
              totalActions: { $sum: '$actions' },
            },
          },
        ])
        .next(),
    ]);

    res.json({
      campaign,
      analytics: {
        participants: {
          total: participants?.totalParticipants || 0,
          regions: participants?.regions || [],
          avgProgress: participants?.avgProgress || 0,
        },
        completions,
        engagement: engagementStats || {
          avgEngagementTime: 0,
          totalActions: 0,
        },
      },
    });
  } catch (error) {
    throw error;
  }
});

// Helper function to get target users based on audience criteria
async function getTargetUsers(db, targetAudience) {
  if (!targetAudience) {
    return db
      .collection('users')
      .find()
      .project({ _id: 1 })
      .map(user => user._id)
      .toArray();
  }

  const query = {};

  if (targetAudience.regions?.length) {
    query.region = { $in: targetAudience.regions };
  }

  if (targetAudience.preferences?.length) {
    query['preferences.cuisine'] = { $in: targetAudience.preferences };
  }

  if (targetAudience.userTypes?.length) {
    query.userType = { $in: targetAudience.userTypes };
  }

  return db
    .collection('users')
    .find(query)
    .project({ _id: 1 })
    .map(user => user._id)
    .toArray();
}

module.exports = router;
