import { Router } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import rateLimiter from '../middleware/rate-limit.js';

const router = Router();

// Helper function to get start date based on period
const getStartDate = period => {
  const now = new Date();
  switch (period) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
};

// Get dashboard overview
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { period = '7d' } = req.query;
    const startDate = getStartDate(period);

    // User statistics
    const userStats = await db
      .collection('users')
      .aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            new: [{ $match: { createdAt: { $gte: startDate } } }, { $count: 'count' }],
            active: [{ $match: { lastLoginAt: { $gte: startDate } } }, { $count: 'count' }],
            verified: [{ $match: { isEmailVerified: true } }, { $count: 'count' }],
          },
        },
      ])
      .next();

    // Recipe statistics
    const recipeStats = await db
      .collection('recipes')
      .aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            new: [{ $match: { createdAt: { $gte: startDate } } }, { $count: 'count' }],
            byCategory: [{ $group: { _id: '$category', count: { $sum: 1 } } }],
          },
        },
      ])
      .next();

    // Engagement statistics
    const engagementStats = await db
      .collection('recipes')
      .aggregate([
        {
          $facet: {
            likes: [{ $match: { 'likes.createdAt': { $gte: startDate } } }, { $count: 'count' }],
            comments: [
              { $match: { 'comments.createdAt': { $gte: startDate } } },
              { $count: 'count' },
            ],
            shares: [{ $match: { 'shares.createdAt': { $gte: startDate } } }, { $count: 'count' }],
          },
        },
      ])
      .next();

    res.json({
      users: {
        total: userStats.total[0]?.count || 0,
        new: userStats.new[0]?.count || 0,
        active: userStats.active[0]?.count || 0,
        verified: userStats.verified[0]?.count || 0,
      },
      recipes: {
        total: recipeStats.total[0]?.count || 0,
        new: recipeStats.new[0]?.count || 0,
        byCategory: recipeStats.byCategory || [],
      },
      engagement: {
        likes: engagementStats.likes[0]?.count || 0,
        comments: engagementStats.comments[0]?.count || 0,
        shares: engagementStats.shares[0]?.count || 0,
      },
    });
  } catch (error) {
    throw error;
  }
});

// Get user analytics
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { period = '30d' } = req.query;
    const startDate = getStartDate(period);

    // User growth over time
    const userGrowth = await db
      .collection('users')
      .aggregate([
        {
          $match: { createdAt: { $gte: startDate } },
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ])
      .toArray();

    // User demographics
    const demographics = await db
      .collection('users')
      .aggregate([
        {
          $facet: {
            byCountry: [
              { $group: { _id: '$country', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 10 },
            ],
            byAge: [
              {
                $bucket: {
                  groupBy: '$age',
                  boundaries: [0, 18, 25, 35, 50, 65, 120],
                  default: 'unknown',
                },
              },
            ],
          },
        },
      ])
      .next();

    // User retention
    const retention = await db
      .collection('users')
      .aggregate([
        {
          $match: { createdAt: { $gte: startDate } },
        },
        {
          $lookup: {
            from: 'user_sessions',
            localField: '_id',
            foreignField: 'userId',
            as: 'sessions',
          },
        },
        {
          $project: {
            weeksSinceRegistration: {
              $floor: {
                $divide: [{ $subtract: ['$lastLoginAt', '$createdAt'] }, 7 * 24 * 60 * 60 * 1000],
              },
            },
          },
        },
        {
          $group: {
            _id: '$weeksSinceRegistration',
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    res.json({
      growth: userGrowth,
      demographics,
      retention,
    });
  } catch (error) {
    throw error;
  }
});

// Get recipe analytics
router.get('/recipes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { period = '30d' } = req.query;
    const startDate = getStartDate(period);

    // Recipe creation over time
    const creationStats = await db
      .collection('recipes')
      .aggregate([
        {
          $match: { createdAt: { $gte: startDate } },
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
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ])
      .toArray();

    // Popular categories
    const categoryStats = await db
      .collection('recipes')
      .aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            avgRating: { $avg: '$rating' },
            totalLikes: { $sum: { $size: '$likes' } },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray();

    // Most engaged recipes
    const topRecipes = await db
      .collection('recipes')
      .aggregate([
        {
          $project: {
            title: 1,
            category: 1,
            userId: 1,
            engagement: {
              $add: [
                { $size: '$likes' },
                { $multiply: [{ $size: '$comments' }, 2] },
                { $multiply: [{ $size: '$shares' }, 3] },
              ],
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'creator',
          },
        },
        { $unwind: '$creator' },
        { $sort: { engagement: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    res.json({
      creation: creationStats,
      categories: categoryStats,
      topRecipes,
    });
  } catch (error) {
    throw error;
  }
});

// Get search analytics
router.get('/search', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { period = '7d' } = req.query;
    const startDate = getStartDate(period);

    // Search volume over time
    const searchVolume = await db
      .collection('search_logs')
      .aggregate([
        {
          $match: { timestamp: { $gte: startDate } },
        },
        {
          $group: {
            _id: {
              year: { $year: '$timestamp' },
              month: { $month: '$timestamp' },
              day: { $dayOfMonth: '$timestamp' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ])
      .toArray();

    // Popular search terms
    const popularTerms = await db
      .collection('search_logs')
      .aggregate([
        {
          $match: { timestamp: { $gte: startDate } },
        },
        {
          $group: {
            _id: '$query',
            count: { $sum: 1 },
            avgResults: { $avg: '$resultCount' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ])
      .toArray();

    // Search success rate
    const successRate = await db
      .collection('search_logs')
      .aggregate([
        {
          $match: { timestamp: { $gte: startDate } },
        },
        {
          $group: {
            _id: null,
            totalSearches: { $sum: 1 },
            successfulSearches: {
              $sum: { $cond: [{ $gt: ['$resultCount', 0] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            successRate: {
              $multiply: [{ $divide: ['$successfulSearches', '$totalSearches'] }, 100],
            },
          },
        },
      ])
      .next();

    res.json({
      volume: searchVolume,
      popularTerms,
      successRate: successRate?.successRate || 0,
    });
  } catch (error) {
    throw error;
  }
});

// Get performance analytics
router.get('/performance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { period = '24h' } = req.query;
    const startDate = getStartDate(period);

    // API response times
    const responseTimes = await db
      .collection('api_logs')
      .aggregate([
        {
          $match: { timestamp: { $gte: startDate } },
        },
        {
          $group: {
            _id: '$endpoint',
            avgResponseTime: { $avg: '$responseTime' },
            p95ResponseTime: { $percentile: ['$responseTime', 95] },
            count: { $sum: 1 },
          },
        },
        { $sort: { avgResponseTime: -1 } },
      ])
      .toArray();

    // Error analysis
    const errors = await db
      .collection('error_logs')
      .aggregate([
        {
          $match: { timestamp: { $gte: startDate } },
        },
        {
          $group: {
            _id: {
              endpoint: '$endpoint',
              statusCode: '$statusCode',
              message: '$message',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ])
      .toArray();

    // System load
    const systemLoad = await db
      .collection('system_metrics')
      .aggregate([
        {
          $match: { timestamp: { $gte: startDate } },
        },
        {
          $group: {
            _id: {
              year: { $year: '$timestamp' },
              month: { $month: '$timestamp' },
              day: { $dayOfMonth: '$timestamp' },
              hour: { $hour: '$timestamp' },
            },
            avgCpuUsage: { $avg: '$cpuUsage' },
            avgMemoryUsage: { $avg: '$memoryUsage' },
            avgActiveConnections: { $avg: '$activeConnections' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
      ])
      .toArray();

    res.json({
      responseTimes,
      errors,
      systemLoad,
    });
  } catch (error) {
    throw error;
  }
});

export default router;
