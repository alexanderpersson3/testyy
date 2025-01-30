import { Router, Response, RequestHandler } from 'express';
import { ObjectId } from 'mongodb';
import { AuthenticatedRequest, auth, requireRole } from '../middleware/auth';
import { ModerationService } from '../services/moderationService';
import { getDb } from '../db/connection';
import {
  addToQueueSchema,
  reviewRecipeSchema,
  queueQuerySchema,
  statsQuerySchema,
  AddToQueueInput,
  ReviewRecipeInput,
  QueueQuery,
  StatsQuery,
  moderationStatusSchema
} from '../schemas/moderationSchemas';

const router = Router();
const moderationService = new ModerationService(getDb());

type AsyncRequestHandler = (req: AuthenticatedRequest, res: Response) => Promise<Response | void>;

// Get moderation queue
const getQueue: AsyncRequestHandler = async (req, res) => {
  try {
    const query = queueQuerySchema.parse(req.query) as QueueQuery;
    const queuedRecipes = await moderationService.getQueuedRecipes({
      status: query.status?.map(s => moderationStatusSchema.parse(s)),
      priority: query.priority,
      limit: query.limit,
      offset: query.offset
    });
    
    return res.json({
      success: true,
      data: queuedRecipes
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'QUEUE_FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Error fetching moderation queue'
      }
    });
  }
};

// Add recipe to moderation queue
const addToQueue: AsyncRequestHandler = async (req, res) => {
  try {
    const input = addToQueueSchema.parse({
      recipeId: req.params.recipeId,
      priority: req.body.priority
    }) as AddToQueueInput;

    const queueItem = await moderationService.addToQueue(
      new ObjectId(input.recipeId),
      input.priority
    );
    
    return res.status(201).json({
      success: true,
      data: queueItem
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'QUEUE_ADD_ERROR',
        message: error instanceof Error ? error.message : 'Error adding to moderation queue'
      }
    });
  }
};

// Review recipe
const reviewRecipe: AsyncRequestHandler = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const input = reviewRecipeSchema.parse({
      recipeId: req.params.recipeId,
      action: req.body.action,
      note: req.body.note
    }) as ReviewRecipeInput;

    await moderationService.reviewRecipe(
      new ObjectId(input.recipeId),
      new ObjectId(req.user.id),
      input.action,
      input.note
    );
    
    return res.json({
      success: true
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'REVIEW_ERROR',
        message: error instanceof Error ? error.message : 'Error reviewing recipe'
      }
    });
  }
};

// Get moderation history for a recipe
const getModerationHistory: AsyncRequestHandler = async (req, res) => {
  try {
    const recipeId = new ObjectId(req.params.recipeId);
    const history = await moderationService.getModerationHistory(recipeId);
    
    return res.json({
      success: true,
      data: history
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'HISTORY_FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Error fetching moderation history'
      }
    });
  }
};

// Get moderator stats
const getModeratorStats: AsyncRequestHandler = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const query = statsQuerySchema.parse(req.query) as StatsQuery;
    const stats = await moderationService.getModeratorStats(
      new ObjectId(req.user.id),
      new Date(query.startDate),
      new Date(query.endDate)
    );
    
    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'STATS_FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Error fetching moderator stats'
      }
    });
  }
};

// Create protected routes
const protectedRoutes = Router();
protectedRoutes.use(auth);
protectedRoutes.use(requireRole('moderator'));

// Register routes
protectedRoutes.get('/queue', getQueue);
protectedRoutes.post('/queue/:recipeId', addToQueue);
protectedRoutes.post('/queue/:recipeId/review', reviewRecipe);
protectedRoutes.get('/history/:recipeId', getModerationHistory);
protectedRoutes.get('/stats', getModeratorStats);

// Use protected routes
router.use('/', protectedRoutes);

export default router; 