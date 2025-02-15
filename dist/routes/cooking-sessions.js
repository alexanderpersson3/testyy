import express, { Response } from 'express';
import { CookingSessionService } from '../services/cooking-session.service.js';
import { ChallengeService } from '../services/challenge.service.js';
import { initializeWebSocket, getWebSocketService } from '../services/websocket.js';
import { auth } from '../middleware/auth.js';
import { z } from 'zod';
import { Server } from 'http';
import { ObjectId } from 'mongodb';
;
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';
const router = express.Router();
// Initialize services
initializeWebSocket(global.server);
const wsService = getWebSocketService();
const challengeService = ChallengeService.getInstance();
const cookingSessionService = CookingSessionService.getInstance();
// Validation schemas
const createSessionSchema = z.object({
    recipeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid recipe ID'),
    servings: z.number().int().min(1),
    orientation: z.enum(['vertical', 'horizontal']).optional(),
}).strict();
const updateStepSchema = z.object({
    isCompleted: z.boolean(),
    notes: z.string().optional(),
}).strict();
const updateTimerSchema = z.object({
    action: z.enum(['start', 'pause', 'resume', 'stop']),
    remainingSeconds: z.number().int().min(0).optional(),
}).strict();
const commentSchema = z.object({
    text: z.string().min(1).max(1000),
}).strict();
const sessionParamsSchema = z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid session ID'),
});
// Create a new cooking session
router.post('/sessions', auth, rateLimitMiddleware.api(), validateRequest(createSessionSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const sessionId = await cookingSessionService.initiateSession(req.user.id, {
        ...req.body,
        recipeId: req.body.recipeId
    });
    res.status(201).json({ success: true, sessionId: sessionId.toString() });
}));
// Get a cooking session by ID
router.get('/:id', auth, rateLimitMiddleware.api(), validateRequest(sessionParamsSchema, 'params'), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const session = await cookingSessionService.getSessionById(req.params.id, req.user.id);
    if (!session) {
        throw new NotFoundError('Cooking session not found');
    }
    res.json(session);
}));
// Get cooking session feed
router.get('/', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const sessions = await cookingSessionService.getFeed({ limit: 20 }, req.user.id);
    res.json(sessions);
}));
// Update a cooking session
router.put('/:id', auth, rateLimitMiddleware.api(), validateRequest(sessionParamsSchema, 'params'), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    await cookingSessionService.updateSession(req.params.id, req.user.id, req.body);
    res.json({ success: true });
}));
// Delete a cooking session
router.delete('/:id', auth, rateLimitMiddleware.api(), validateRequest(sessionParamsSchema, 'params'), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    await cookingSessionService.deleteSession(req.params.id, req.user.id);
    res.json({ success: true });
}));
// Like a cooking session
router.post('/:id/like', auth, rateLimitMiddleware.api(), validateRequest(sessionParamsSchema, 'params'), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    await cookingSessionService.likeSession(req.params.id, req.user.id);
    res.json({ success: true });
}));
// Unlike a cooking session
router.delete('/:id/like', auth, rateLimitMiddleware.api(), validateRequest(sessionParamsSchema, 'params'), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    await cookingSessionService.unlikeSession(req.params.id, req.user.id);
    res.json({ success: true });
}));
// Add a comment to a cooking session
router.post('/:id/comments', auth, rateLimitMiddleware.api(), validateRequest(sessionParamsSchema, 'params'), validateRequest(commentSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const comment = await cookingSessionService.addComment(new ObjectId(req.params.id), new ObjectId(req.user.id), req.body.text);
    res.status(201).json({ commentId: comment._id.toString() });
}));
// Get comments for a cooking session
router.get('/:id/comments', auth, rateLimitMiddleware.api(), validateRequest(sessionParamsSchema, 'params'), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    const comments = await cookingSessionService.getComments(req.params.id, limit, offset);
    res.json({ comments });
}));
// Update step progress
router.patch('/sessions/:sessionId/steps/:stepIndex', auth, rateLimitMiddleware.api(), validateRequest(updateStepSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    await cookingSessionService.updateStepProgress(req.params.sessionId, req.user.id, parseInt(req.params.stepIndex), req.body);
    res.json({ success: true });
}));
// Update timer status
router.patch('/sessions/:sessionId/steps/:stepIndex/timers/:timerId', auth, rateLimitMiddleware.api(), validateRequest(updateTimerSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    await cookingSessionService.updateTimer(req.params.sessionId, req.user.id, parseInt(req.params.stepIndex), req.params.timerId, req.body);
    res.json({ success: true });
}));
export default router;
//# sourceMappingURL=cooking-sessions.js.map