import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
const { authenticateToken } = require('../middleware/auth');
import reviewManager from '../services/review-manager.js';
import rateLimiter from '../middleware/rate-limit.js';
import { getDb } from '../database/db.js';
import { ObjectId } from 'mongodb';

const router = express.Router();

// Validation schemas
const createReviewSchema = z.object({
  recipeId: z.string(),
  rating: z.number().min(0).max(5),
  commentText: z.string().min(1, 'Comment is required').max(1000),
});

const updateReviewSchema = z
  .object({
    rating: z.number().min(0).max(5).optional(),
    commentText: z.string().min(1, 'Comment is required').max(1000).optional(),
  })
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

const flagReviewSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

// Create a review
router.post(
  '/',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: createReviewSchema }),
  async (req, res) => {
    try {
      const review = await reviewManager.createReview({
        ...req.body,
        userId: req.user.id,
      });

      res.status(201).json({
        success: true,
        data: review,
      });
    } catch (error) {
      console.error('Error creating review:', error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Update a review
router.patch(
  '/:reviewId',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: updateReviewSchema }),
  async (req, res) => {
    try {
      const review = await reviewManager.updateReview(req.params.reviewId, req.body);

      res.json({
        success: true,
        data: review,
      });
    } catch (error) {
      console.error('Error updating review:', error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Get reviews for a recipe
router.get('/recipe/:recipeId', rateLimiter.api(), async (req, res) => {
  try {
    const { page, limit, sort } = req.query;
    const reviews = await reviewManager.getRecipeReviews(req.params.recipeId, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
    });

    res.json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    console.error('Error getting recipe reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reviews',
    });
  }
});

// Flag a review
router.post(
  '/:reviewId/flag',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: flagReviewSchema }),
  async (req, res) => {
    try {
      await reviewManager.flagReview(req.params.reviewId, req.user.id, req.body.reason);

      res.json({
        success: true,
        message: 'Review flagged for moderation',
      });
    } catch (error) {
      console.error('Error flagging review:', error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Get flagged reviews (admin only)
router.get('/flagged', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    const { page, limit } = req.query;
    const reviews = await reviewManager.getFlaggedReviews({
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    console.error('Error getting flagged reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get flagged reviews',
    });
  }
});

// Vote on a review
router.post(
  '/:reviewId/vote',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    body: z.object({
      isHelpful: z.boolean(),
    }),
  }),
  async (req, res) => {
    try {
      const result = await reviewManager.voteReview(
        req.params.reviewId,
        req.user.id,
        req.body.isHelpful
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error voting on review:', error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Add author response to review
router.post(
  '/:reviewId/respond',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    body: z.object({
      responseText: z.string().min(1, 'Response is required').max(1000),
    }),
  }),
  async (req, res) => {
    try {
      const review = await reviewManager.addAuthorResponse(
        req.params.reviewId,
        req.user.id,
        req.body.responseText
      );

      res.json({
        success: true,
        data: review,
      });
    } catch (error) {
      console.error('Error adding author response:', error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Get review analytics
router.get('/analytics', authenticateToken, rateLimiter.api(), async (req, res) => {
  try {
    const db = await getDb();
    const userId = new ObjectId(req.user.id);

    // Get user's recipes
    const recipes = await db.collection('recipes').find({ userId }).project({ _id: 1 }).toArray();

    const recipeIds = recipes.map(r => r._id);

    // Aggregate review stats
    const stats = await db
      .collection('reviews')
      .aggregate([
        {
          $match: {
            recipeId: { $in: recipeIds },
            status: 'active',
          },
        },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$rating' },
            totalHelpfulVotes: { $sum: '$helpfulVotes' },
            ratingDistribution: {
              $push: '$rating',
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalReviews: 1,
            averageRating: { $round: ['$averageRating', 1] },
            totalHelpfulVotes: 1,
            ratingDistribution: {
              1: {
                $size: { $filter: { input: '$ratingDistribution', cond: { $eq: ['$$this', 1] } } },
              },
              2: {
                $size: { $filter: { input: '$ratingDistribution', cond: { $eq: ['$$this', 2] } } },
              },
              3: {
                $size: { $filter: { input: '$ratingDistribution', cond: { $eq: ['$$this', 3] } } },
              },
              4: {
                $size: { $filter: { input: '$ratingDistribution', cond: { $eq: ['$$this', 4] } } },
              },
              5: {
                $size: { $filter: { input: '$ratingDistribution', cond: { $eq: ['$$this', 5] } } },
              },
            },
          },
        },
      ])
      .toArray();

    res.json({
      success: true,
      data: stats[0] || {
        totalReviews: 0,
        averageRating: 0,
        totalHelpfulVotes: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      },
    });
  } catch (error) {
    console.error('Error getting review analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get review analytics',
    });
  }
});

export default router;
