import express, { Response } from 'express';
import { ChallengeService } from '../services/challenge.service';
import { WebSocketService } from '../services/websocket-service';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';
import { Server } from 'http';
import { RequestHandler } from 'express';
import { ChallengeType, ChallengeStatus } from '../types/challenge';
import { AuthenticatedRequest } from '../types/auth';

declare global {
  var server: Server;
}

const router = express.Router();
const wsService = new WebSocketService(global.server);
const challengeService = new ChallengeService(wsService);

// Validation schemas
const createChallengeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  type: z.enum(['count', 'streak', 'achievement'] as const),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
  targetGoal: z.number().positive(),
  rules: z.array(z.string()),
  rewards: z.array(z.object({
    type: z.string(),
    value: z.any()
  })).optional()
});

const updateChallengeSchema = createChallengeSchema.partial().extend({
  status: z.enum(['upcoming', 'active', 'completed', 'cancelled'] as const).optional()
});

// Create a new challenge (admin only)
router.post('/',
  authenticateToken as RequestHandler,
  requireRole('admin') as RequestHandler,
  validateRequest({ body: createChallengeSchema }),
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const challengeId = await challengeService.createChallenge(req.body);
      res.status(201).json({ challengeId: challengeId.toString() });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create challenge' });
    }
  }) as RequestHandler
);

// Get a challenge by ID
router.get('/:id',
  authenticateToken as RequestHandler,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const challenge = await challengeService.getChallenge(
        req.params.id,
        req.user.id
      );
      if (!challenge) {
        return res.status(404).json({ error: 'Challenge not found' });
      }
      res.json(challenge);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get challenge' });
    }
  }) as RequestHandler
);

// Get challenges list
router.get('/',
  authenticateToken as RequestHandler,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const challenges = await challengeService.getChallenges(
        {
          status: req.query.status as ChallengeStatus | undefined,
          type: req.query.type as ChallengeType | undefined,
          limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
          offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
          includeProgress: req.query.includeProgress === 'true',
          includeLeaderboard: req.query.includeLeaderboard === 'true'
        },
        req.user.id
      );
      res.json({ challenges });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get challenges' });
    }
  }) as RequestHandler
);

// Update a challenge (admin only)
router.patch('/:id',
  authenticateToken as RequestHandler,
  requireRole('admin') as RequestHandler,
  validateRequest({ body: updateChallengeSchema }),
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      await challengeService.updateChallenge(req.params.id, req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update challenge' });
    }
  }) as RequestHandler
);

// Join a challenge
router.post('/:id/join',
  authenticateToken as RequestHandler,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      await challengeService.joinChallenge(
        req.params.id,
        req.user.id
      );
      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Challenge not found') {
          return res.status(404).json({ error: error.message });
        }
        if (error.message === 'Challenge is not open for joining' || 
            error.message === 'Already joined this challenge') {
          return res.status(400).json({ error: error.message });
        }
      }
      res.status(500).json({ error: 'Failed to join challenge' });
    }
  }) as RequestHandler
);

// Get challenge leaderboard
router.get('/:id/leaderboard',
  authenticateToken as RequestHandler,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const leaderboard = await challengeService.getLeaderboard(
        req.params.id,
        limit
      );
      res.json({ leaderboard });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get leaderboard' });
    }
  }) as RequestHandler
);

export { router as challengeRouter }; 