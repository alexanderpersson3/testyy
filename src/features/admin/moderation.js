import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../../middleware/validation.js';
import { authenticateToken } from '../../middleware/auth.js';
import rateLimiter from '../../middleware/rate-limit.js';
import moderationManager from '../../services/admin/moderation-manager.js';

const router = express.Router();

// Validation schemas
const banUserSchema = z
  .object({
    userId: z.string(),
    reason: z.string().min(1),
    duration: z.number().int().positive().optional(),
  })
  .strict();

const removeContentSchema = z
  .object({
    contentId: z.string(),
    contentType: z.enum(['recipe', 'comment', 'review']),
    reason: z.string().min(1),
  })
  .strict();

const paginationSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  })
  .strict();

// Ban a user
router.post(
  '/ban-user',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    body: banUserSchema,
  }),
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { userId, reason, duration } = req.body;
      await moderationManager.banUser(userId, reason, duration);

      res.json({
        success: true,
        message: 'User banned successfully',
      });
    } catch (error) {
      console.error('Error banning user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to ban user',
      });
    }
  }
);

// Unban a user
router.post('/unban-user/:userId', authenticateToken, rateLimiter.api(), async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { userId } = req.params;
    await moderationManager.unbanUser(userId);

    res.json({
      success: true,
      message: 'User unbanned successfully',
    });
  } catch (error) {
    console.error('Error unbanning user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unban user',
    });
  }
});

// Remove content
router.post(
  '/remove-content',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    body: removeContentSchema,
  }),
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { contentId, contentType, reason } = req.body;
      await moderationManager.removeContent(contentId, contentType, reason);

      res.json({
        success: true,
        message: 'Content removed successfully',
      });
    } catch (error) {
      console.error('Error removing content:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove content',
      });
    }
  }
);

// Get moderation logs
router.get(
  '/logs',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({
    query: paginationSchema,
  }),
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const logs = await moderationManager.getModerationLogs(req.query);

      res.json({
        success: true,
        data: logs,
      });
    } catch (error) {
      console.error('Error getting moderation logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get moderation logs',
      });
    }
  }
);

export default router;
