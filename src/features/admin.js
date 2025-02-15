import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
const { authenticateToken } = require('../middleware/auth');
import requireAdmin from '../middleware/is-admin.js';
import * as adminService from '../services/admin-service.js';
import { getDb } from '../db.js';
import { ObjectId } from 'mongodb';
import elasticClient from '../services/elastic-client.js';

const router = express.Router();

// Validation schemas
const statsTimeframeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const updateUserRoleSchema = z.object({
  role: z.enum(['user', 'moderator', 'admin']),
});

const suspendUserSchema = z.object({
  reason: z.string().min(1),
  duration: z.number().int().positive().optional(), // Duration in hours
});

const createReportSchema = z
  .object({
    type: z.enum(['recipe', 'comment', 'user', 'collection']),
    target_id: z.string(),
    reason: z.string(),
  })
  .strict();

const updateReportSchema = z
  .object({
    status: z.enum(['pending', 'in_review', 'resolved', 'dismissed']),
    resolution: z.string().optional(),
  })
  .strict();

const deleteContentSchema = z
  .object({
    type: z.enum(['recipe', 'comment', 'collection']),
    reason: z.string(),
  })
  .strict();

// Get user statistics
router.get('/stats/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await adminService.getUserStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('Error getting user stats:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get content statistics
router.get('/stats/content', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await adminService.getContentStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('Error getting content stats:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update user role
router.put(
  '/users/:userId/role',
  authenticateToken,
  requireAdmin,
  validateRequest({ body: updateUserRoleSchema }),
  async (req, res) => {
    try {
      await adminService.updateUserRole(req.params.userId, req.body.role);
      res.json({ success: true, message: 'User role updated successfully' });
    } catch (err) {
      console.error('Error updating user role:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Suspend user
router.post(
  '/users/:userId/suspend',
  authenticateToken,
  requireAdmin,
  validateRequest({ body: suspendUserSchema }),
  async (req, res) => {
    try {
      await adminService.suspendUser(req.params.userId, req.body.reason, req.body.duration);
      res.json({ success: true, message: 'User suspended successfully' });
    } catch (err) {
      console.error('Error suspending user:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Unsuspend user
router.post('/users/:userId/unsuspend', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await adminService.unsuspendUser(req.params.userId);
    res.json({ success: true, message: 'User unsuspended successfully' });
  } catch (err) {
    console.error('Error unsuspending user:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get system metrics
router.get(
  '/metrics',
  authenticateToken,
  requireAdmin,
  validateRequest({ query: statsTimeframeSchema }),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const metrics = await adminService.getSystemMetrics(startDate, endDate);
      res.json({ success: true, data: metrics });
    } catch (err) {
      console.error('Error getting system metrics:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Get audit logs
router.get('/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, filter = {} } = req.query;
    const logs = await adminService.getAuditLog(filter, parseInt(page), parseInt(limit));
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('Error getting audit logs:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post(
  '/reports',
  authenticateToken,
  validateRequest(createReportSchema, 'body'),
  async (req, res) => {
    try {
      const reportId = await adminService.createReport(
        req.body.type,
        req.body.target_id,
        req.user.id,
        req.body.reason
      );
      res.status(201).json({ id: reportId });
    } catch (err) {
      console.error('Create report error:', err);
      res.status(500).json({ error: 'Failed to create report' });
    }
  }
);

router.get('/reports', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const results = await adminService.getReports(filter, parseInt(page), parseInt(limit));
    res.json(results);
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ error: 'Failed to get reports' });
  }
});

router.put(
  '/reports/:reportId',
  authenticateToken,
  requireAdmin,
  validateRequest(updateReportSchema, 'body'),
  async (req, res) => {
    try {
      const success = await adminService.updateReportStatus(
        req.params.reportId,
        req.body.status,
        req.user.id,
        req.body.resolution
      );
      if (!success) {
        return res.status(404).json({ error: 'Report not found' });
      }
      await adminService.logAdminAction(req.user.id, 'update_report_status', {
        report_id: req.params.reportId,
        status: req.body.status,
        resolution: req.body.resolution,
      });
      res.json({ success: true });
    } catch (err) {
      console.error('Update report status error:', err);
      res.status(500).json({ error: 'Failed to update report status' });
    }
  }
);

router.delete(
  '/:type/:contentId',
  authenticateToken,
  requireAdmin,
  validateRequest(deleteContentSchema, 'body'),
  async (req, res) => {
    try {
      const success = await adminService.deleteContent(
        req.params.type,
        req.params.contentId,
        req.user.id,
        req.body.reason
      );
      if (!success) {
        return res.status(404).json({ error: 'Content not found' });
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Delete content error:', err);
      res.status(500).json({ error: 'Failed to delete content' });
    }
  }
);

// Get system stats
router.get('/stats', async (req, res) => {
  try {
    const db = getDb();
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get counts
    const [
      totalUsers,
      totalRecipes,
      totalIngredients,
      newUsers,
      newRecipes,
      totalLikes,
      totalComments,
      totalShares,
    ] = await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('recipes').countDocuments(),
      db.collection('ingredients').countDocuments(),
      db.collection('users').countDocuments({ createdAt: { $gte: lastWeek } }),
      db.collection('recipes').countDocuments({ createdAt: { $gte: lastWeek } }),
      db.collection('likes').countDocuments(),
      db.collection('comments').countDocuments(),
      db.collection('shares').countDocuments(),
    ]);

    // Get user growth
    const userGrowth = await db
      .collection('users')
      .aggregate([
        {
          $match: {
            createdAt: { $gte: lastMonth },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
        },
      ])
      .toArray();

    // Get most active users
    const activeUsers = await db
      .collection('users')
      .aggregate([
        {
          $lookup: {
            from: 'recipes',
            localField: '_id',
            foreignField: 'userId',
            as: 'recipes',
          },
        },
        {
          $lookup: {
            from: 'comments',
            localField: '_id',
            foreignField: 'userId',
            as: 'comments',
          },
        },
        {
          $lookup: {
            from: 'likes',
            localField: '_id',
            foreignField: 'userId',
            as: 'likes',
          },
        },
        {
          $project: {
            username: 1,
            email: 1,
            recipeCount: { $size: '$recipes' },
            commentCount: { $size: '$comments' },
            likeCount: { $size: '$likes' },
            totalActivity: {
              $add: [{ $size: '$recipes' }, { $size: '$comments' }, { $size: '$likes' }],
            },
          },
        },
        {
          $sort: { totalActivity: -1 },
        },
        {
          $limit: 10,
        },
      ])
      .toArray();

    // Get popular recipes
    const popularRecipes = await db
      .collection('recipes')
      .aggregate([
        {
          $lookup: {
            from: 'likes',
            localField: '_id',
            foreignField: 'recipeId',
            as: 'likes',
          },
        },
        {
          $lookup: {
            from: 'comments',
            localField: '_id',
            foreignField: 'recipeId',
            as: 'comments',
          },
        },
        {
          $project: {
            title: 1,
            likeCount: { $size: '$likes' },
            commentCount: { $size: '$comments' },
            totalEngagement: {
              $add: [{ $size: '$likes' }, { $size: '$comments' }],
            },
          },
        },
        {
          $sort: { totalEngagement: -1 },
        },
        {
          $limit: 10,
        },
      ])
      .toArray();

    res.json({
      counts: {
        users: totalUsers,
        recipes: totalRecipes,
        ingredients: totalIngredients,
        newUsers,
        newRecipes,
        likes: totalLikes,
        comments: totalComments,
        shares: totalShares,
      },
      userGrowth,
      activeUsers,
      popularRecipes,
    });
  } catch (error) {
    throw error;
  }
});

// Get all users with filtering and sorting
router.get('/users', async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 20, search, role, status, sort = 'date' } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (role) query.role = role;
    if (status) query.status = status;

    let sortQuery = { createdAt: -1 };
    if (sort === 'username') sortQuery = { username: 1 };
    if (sort === 'lastLogin') sortQuery = { lastLoginAt: -1 };

    const users = await db
      .collection('users')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'recipes',
            localField: '_id',
            foreignField: 'userId',
            as: 'recipes',
          },
        },
        {
          $lookup: {
            from: 'followers',
            localField: '_id',
            foreignField: 'followedId',
            as: 'followers',
          },
        },
        {
          $project: {
            username: 1,
            email: 1,
            displayName: 1,
            role: 1,
            status: 1,
            isVerified: 1,
            createdAt: 1,
            lastLoginAt: 1,
            recipeCount: { $size: '$recipes' },
            followerCount: { $size: '$followers' },
          },
        },
        { $sort: sortQuery },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
      ])
      .toArray();

    const total = await db.collection('users').countDocuments(query);

    res.json({
      users,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.params.id);
    const validatedData = z
      .object({
        role: z.enum(['USER', 'MODERATOR', 'ADMIN']).optional(),
        status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
        isVerified: z.boolean().optional(),
      })
      .parse(req.body);

    const updateResult = await db.collection('users').findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          ...validatedData,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!updateResult.value) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user in Elasticsearch
    await elasticClient.update({
      index: 'users',
      id: userId.toString(),
      body: {
        doc: {
          ...validatedData,
          updatedAt: new Date(),
        },
      },
    });

    res.json(updateResult.value);
  } catch (error) {
    throw error;
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.params.id);

    // Delete user and all related data
    await Promise.all([
      db.collection('users').deleteOne({ _id: userId }),
      db.collection('recipes').deleteMany({ userId }),
      db.collection('likes').deleteMany({ userId }),
      db.collection('comments').deleteMany({ userId }),
      db
        .collection('followers')
        .deleteMany({ $or: [{ followerId: userId }, { followedId: userId }] }),
      db.collection('notifications').deleteMany({ userId }),
      db.collection('activities').deleteMany({ userId }),
      elasticClient.delete({
        index: 'users',
        id: userId.toString(),
      }),
    ]);

    res.json({ message: 'User and related data deleted successfully' });
  } catch (error) {
    throw error;
  }
});

// Get reported content
router.get('/reports', async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 20, status = 'PENDING', type } = req.query;

    const query = { status };
    if (type) query.type = type;

    const reports = await db
      .collection('reports')
      .aggregate([
        { $match: query },
        { $sort: { createdAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'users',
            localField: 'reporterId',
            foreignField: '_id',
            as: 'reporter',
          },
        },
        { $unwind: '$reporter' },
        {
          $lookup: {
            from: 'users',
            localField: 'reportedUserId',
            foreignField: '_id',
            as: 'reportedUser',
          },
        },
        { $unwind: { path: '$reportedUser', preserveNullAndEmptyArrays: true } },
      ])
      .toArray();

    const total = await db.collection('reports').countDocuments(query);

    res.json({
      reports,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Handle report
router.put('/reports/:id', async (req, res) => {
  try {
    const db = getDb();
    const reportId = new ObjectId(req.params.id);
    const { status, action } = z
      .object({
        status: z.enum(['RESOLVED', 'REJECTED']),
        action: z.enum(['NONE', 'DELETE', 'WARN', 'SUSPEND', 'BAN']).optional(),
      })
      .parse(req.body);

    const report = await db.collection('reports').findOne({ _id: reportId });
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Handle the report based on action
    if (action && action !== 'NONE') {
      switch (report.type) {
        case 'RECIPE':
          if (action === 'DELETE') {
            await db.collection('recipes').deleteOne({ _id: report.contentId });
            await elasticClient.delete({
              index: 'recipes',
              id: report.contentId.toString(),
            });
          }
          break;

        case 'COMMENT':
          if (action === 'DELETE') {
            await db.collection('comments').deleteOne({ _id: report.contentId });
          }
          break;

        case 'USER':
          const userUpdate = {};
          if (action === 'WARN') {
            userUpdate.warnings = { $inc: 1 };
          } else if (action === 'SUSPEND') {
            userUpdate.$set = {
              status: 'SUSPENDED',
              suspendedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            };
          } else if (action === 'BAN') {
            userUpdate.$set = { status: 'BANNED' };
          }

          if (Object.keys(userUpdate).length) {
            await db.collection('users').updateOne({ _id: report.reportedUserId }, userUpdate);
          }
          break;
      }
    }

    // Update report status
    await db.collection('reports').updateOne(
      { _id: reportId },
      {
        $set: {
          status,
          resolvedAt: new Date(),
          resolvedBy: req.user.id,
          action,
        },
      }
    );

    res.json({ message: 'Report handled successfully' });
  } catch (error) {
    throw error;
  }
});

// Get system logs
router.get('/logs', async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 50, type, startDate, endDate } = req.query;

    const query = {};
    if (type) query.type = type;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const logs = await db
      .collection('system_logs')
      .find(query)
      .sort({ timestamp: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection('system_logs').countDocuments(query);

    res.json({
      logs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Get system settings
router.get('/settings', async (req, res) => {
  try {
    const db = getDb();
    const settings = await db.collection('system_settings').findOne({});
    res.json(settings || {});
  } catch (error) {
    throw error;
  }
});

// Update system settings
router.put('/settings', async (req, res) => {
  try {
    const db = getDb();
    const validatedData = z
      .object({
        maintenance: z.boolean().optional(),
        signupsEnabled: z.boolean().optional(),
        maxUploadSize: z.number().optional(),
        defaultUserQuota: z.number().optional(),
        emailVerificationRequired: z.boolean().optional(),
        autoModeration: z
          .object({
            enabled: z.boolean(),
            profanityFilter: z.boolean(),
            spamFilter: z.boolean(),
            imageModeration: z.boolean(),
          })
          .optional(),
        notifications: z
          .object({
            email: z.boolean(),
            push: z.boolean(),
            digest: z.boolean(),
          })
          .optional(),
        search: z
          .object({
            minScore: z.number(),
            maxResults: z.number(),
            fuzzyMatching: z.boolean(),
          })
          .optional(),
      })
      .parse(req.body);

    await db.collection('system_settings').updateOne(
      {},
      {
        $set: {
          ...validatedData,
          updatedAt: new Date(),
          updatedBy: req.user.id,
        },
      },
      { upsert: true }
    );

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    throw error;
  }
});

// Reindex Elasticsearch
router.post('/reindex', async (req, res) => {
  try {
    const db = getDb();
    const { indices = ['recipes', 'users', 'ingredients'] } = req.body;

    for (const index of indices) {
      // Delete existing index
      try {
        await elasticClient.indices.delete({ index });
      } catch (error) {
        // Ignore if index doesn't exist
      }

      // Create new index with mapping
      await elasticClient.indices.create({
        index,
        body: {
          mappings: {
            properties: {
              // Add appropriate mappings based on index
            },
          },
        },
      });

      // Reindex data
      const collection = await db.collection(index).find().toArray();
      if (collection.length > 0) {
        const body = collection.flatMap(doc => [
          { index: { _index: index, _id: doc._id.toString() } },
          {
            ...doc,
            _id: doc._id.toString(),
          },
        ]);

        await elasticClient.bulk({ body });
      }
    }

    res.json({ message: 'Reindexing completed successfully' });
  } catch (error) {
    throw error;
  }
});

export default router;
