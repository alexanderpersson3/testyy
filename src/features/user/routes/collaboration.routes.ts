import { Router } from 'express';;
import type { Router } from '../types/express.js';;
import { ObjectId } from 'mongodb';;;;
import { z } from 'zod';;
import { CollaborationService } from '../services/collaboration.service.js';;
import { authenticate } from '../middleware/auth.js';;
import type { validateRequest } from '../types/express.js';
const router = Router();
const collaborationService = CollaborationService.getInstance();

// Join session schema
const joinSessionSchema = z.object({
  resourceId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  resourceType: z.enum(['recipe', 'collection', 'cooking_session']),
});

// Join collaboration session
router.post(
  '/sessions/join',
  authenticate,
  validateRequest(joinSessionSchema),
  async (req: any, res: any) => {
    try {
      const session = await collaborationService.joinSession(
        new ObjectId(req.user!.id),
        uuidv4(),
        new ObjectId(req.body.resourceId),
        req.body.resourceType
      );
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: 'Failed to join collaboration session' });
    }
  }
);

// Leave session schema
const leaveSessionSchema = z.object({
  resourceId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  resourceType: z.enum(['recipe', 'collection', 'cooking_session']),
});

// Leave collaboration session
router.post(
  '/sessions/leave',
  authenticate,
  validateRequest(leaveSessionSchema),
  async (req: any, res: any) => {
    try {
      await collaborationService.leaveSession(
        new ObjectId(req.user!.id),
        new ObjectId(req.body.resourceId),
        req.body.resourceType
      );
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to leave collaboration session' });
    }
  }
);

// Apply change schema
const applyChangeSchema = z.object({
  resourceId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  resourceType: z.enum(['recipe', 'collection', 'cooking_session']),
  operation: z.any(),
});

// Apply change to resource
router.post('/changes', authenticate, validateRequest(applyChangeSchema), async (req: any, res: any) => {
  try {
    await collaborationService.applyChange({
      userId: new ObjectId(req.user!.id),
      resourceId: new ObjectId(req.body.resourceId),
      resourceType: req.body.resourceType,
      operation: req.body.operation,
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to apply change' });
  }
});

// Get active participants schema
const getParticipantsSchema = z.object({
  resourceId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  resourceType: z.enum(['recipe', 'collection', 'cooking_session']),
});

// Get active participants
router.get(
  '/sessions/:resourceId/participants',
  authenticate,
  validateRequest(getParticipantsSchema, 'params'),
  async (req: any, res: any) => {
    try {
      const participants = await collaborationService.getActiveParticipants(
        new ObjectId(req.params.resourceId),
        req.query.resourceType as 'recipe' | 'collection' | 'cooking_session'
      );
      res.json(participants);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get active participants' });
    }
  }
);

// Get recent changes schema
const getChangesSchema = z.object({
  resourceId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  resourceType: z.enum(['recipe', 'collection', 'cooking_session']),
  limit: z
    .string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(100))
    .optional(),
});

// Get recent changes
router.get(
  '/sessions/:resourceId/changes',
  authenticate,
  validateRequest(getChangesSchema, 'params'),
  async (req: any, res: any) => {
    try {
      const changes = await collaborationService.getRecentChanges(
        new ObjectId(req.params.resourceId),
        req.query.resourceType as 'recipe' | 'collection' | 'cooking_session',
        req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
      );
      res.json(changes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get recent changes' });
    }
  }
);

export default router;
