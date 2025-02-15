const { getDb } = require('../db');
const { ObjectId } = require('mongodb');

class AdminService {
  constructor() {
    this.USER_ROLES = {
      USER: 'user',
      MODERATOR: 'moderator',
      ADMIN: 'admin',
    };

    this.REPORT_STATUS = {
      PENDING: 'pending',
      IN_REVIEW: 'in_review',
      RESOLVED: 'resolved',
      DISMISSED: 'dismissed',
    };

    this.REPORT_TYPES = {
      RECIPE: 'recipe',
      COMMENT: 'comment',
      USER: 'user',
      COLLECTION: 'collection',
    };
  }

  async getUserStats() {
    const db = getDb();
    const pipeline = [
      {
        $facet: {
          total: [{ $count: 'count' }],
          active: [
            {
              $match: { last_login: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
            },
            { $count: 'count' },
          ],
          premium: [{ $match: { subscription_tier: 'premium' } }, { $count: 'count' }],
          byRole: [{ $group: { _id: '$role', count: { $sum: 1 } } }],
        },
      },
    ];

    const [result] = await db.collection('users').aggregate(pipeline).toArray();
    return {
      total: result.total[0]?.count || 0,
      active: result.active[0]?.count || 0,
      premium: result.premium[0]?.count || 0,
      byRole: result.byRole,
    };
  }

  async getContentStats() {
    const db = getDb();
    const collections = ['recipes', 'comments', 'collections'];
    const stats = {};

    for (const collection of collections) {
      const pipeline = [
        {
          $facet: {
            total: [{ $count: 'count' }],
            today: [
              {
                $match: {
                  created_at: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                  },
                },
              },
              { $count: 'count' },
            ],
            reported: [{ $match: { reported: true } }, { $count: 'count' }],
          },
        },
      ];

      const [result] = await db.collection(collection).aggregate(pipeline).toArray();
      stats[collection] = {
        total: result.total[0]?.count || 0,
        today: result.today[0]?.count || 0,
        reported: result.reported[0]?.count || 0,
      };
    }

    return stats;
  }

  async updateUserRole(userId, role) {
    const db = getDb();
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          role,
          updated_at: new Date(),
        },
      }
    );
    return result.modifiedCount > 0;
  }

  async suspendUser(userId, reason, duration) {
    const db = getDb();
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          suspended: true,
          suspension_reason: reason,
          suspension_end: new Date(Date.now() + duration),
          updated_at: new Date(),
        },
      }
    );
    return result.modifiedCount > 0;
  }

  async unsuspendUser(userId) {
    const db = getDb();
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $unset: {
          suspended: '',
          suspension_reason: '',
          suspension_end: '',
        },
        $set: { updated_at: new Date() },
      }
    );
    return result.modifiedCount > 0;
  }

  async createReport(type, targetId, reporterId, reason) {
    const db = getDb();
    const report = {
      type,
      target_id: new ObjectId(targetId),
      reporter_id: new ObjectId(reporterId),
      reason,
      status: this.REPORT_STATUS.PENDING,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await db.collection('reports').insertOne(report);
    return result.insertedId;
  }

  async updateReportStatus(reportId, status, moderatorId, resolution = null) {
    const db = getDb();
    const update = {
      status,
      moderator_id: new ObjectId(moderatorId),
      resolution,
      updated_at: new Date(),
    };

    const result = await db
      .collection('reports')
      .updateOne({ _id: new ObjectId(reportId) }, { $set: update });
    return result.modifiedCount > 0;
  }

  async getReports(filter = {}, page = 1, limit = 20) {
    const db = getDb();
    const skip = (page - 1) * limit;

    const pipeline = [
      { $match: filter },
      { $sort: { created_at: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'reporter_id',
          foreignField: '_id',
          as: 'reporter',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'moderator_id',
          foreignField: '_id',
          as: 'moderator',
        },
      },
      {
        $unwind: {
          path: '$reporter',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: '$moderator',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          type: 1,
          target_id: 1,
          reason: 1,
          status: 1,
          resolution: 1,
          created_at: 1,
          updated_at: 1,
          'reporter.username': 1,
          'moderator.username': 1,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    const reports = await db.collection('reports').aggregate(pipeline).toArray();

    const totalCount = await db.collection('reports').countDocuments(filter);

    return {
      reports,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
      },
    };
  }

  async getAuditLog(filter = {}, page = 1, limit = 20) {
    const db = getDb();
    const skip = (page - 1) * limit;

    const pipeline = [
      { $match: filter },
      { $sort: { timestamp: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'admin_id',
          foreignField: '_id',
          as: 'admin',
        },
      },
      {
        $unwind: {
          path: '$admin',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          action: 1,
          details: 1,
          timestamp: 1,
          'admin.username': 1,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    const logs = await db.collection('audit_logs').aggregate(pipeline).toArray();

    const totalCount = await db.collection('audit_logs').countDocuments(filter);

    return {
      logs,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
      },
    };
  }

  async logAdminAction(adminId, action, details) {
    const db = getDb();
    const log = {
      admin_id: new ObjectId(adminId),
      action,
      details,
      timestamp: new Date(),
    };

    await db.collection('audit_logs').insertOne(log);
  }

  async deleteContent(type, contentId, adminId, reason) {
    const db = getDb();
    const collection = `${type}s`;

    const result = await db.collection(collection).deleteOne({ _id: new ObjectId(contentId) });

    if (result.deletedCount > 0) {
      await this.logAdminAction(adminId, 'delete_content', {
        type,
        content_id: contentId,
        reason,
      });
      return true;
    }
    return false;
  }

  async getSystemMetrics(startDate, endDate) {
    const db = getDb();
    const metrics = {};

    // User growth
    const userGrowth = await db
      .collection('users')
      .aggregate([
        {
          $match: {
            created_at: {
              $gte: new Date(startDate),
              $lte: new Date(endDate),
            },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();
    metrics.userGrowth = userGrowth;

    // Content creation
    const contentTypes = ['recipes', 'comments', 'collections'];
    metrics.contentGrowth = {};

    for (const type of contentTypes) {
      const growth = await db
        .collection(type)
        .aggregate([
          {
            $match: {
              created_at: {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
              },
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray();
      metrics.contentGrowth[type] = growth;
    }

    return metrics;
  }
}

module.exports = new AdminService();
