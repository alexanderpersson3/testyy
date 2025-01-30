import express from 'express';
import { CookingSessionService } from '../services/cooking-session.service';
import { ChallengeService } from '../services/challenge.service';
import { WebSocketService } from '../services/websocket-service';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';
const router = express.Router();
const wsService = new WebSocketService(global.server);
const challengeService = new ChallengeService(wsService);
const cookingSessionService = new CookingSessionService(wsService, challengeService);
// Validation schemas
const createSessionSchema = z.object({
    title: z.string().min(1).max(100),
    description: z.string().max(1000).optional(),
    startTime: z.string().transform(str => new Date(str)),
    endTime: z.string().transform(str => new Date(str)),
    photos: z.array(z.string().url()).optional(),
    visibility: z.enum(['public', 'followers', 'private']).optional()
});
const updateSessionSchema = createSessionSchema.partial();
const commentSchema = z.object({
    text: z.string().min(1).max(1000)
});
// Create a new cooking session
router.post('/', authenticateToken, validateRequest({ body: createSessionSchema }), (async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const sessionId = await cookingSessionService.createSession(req.user.id, req.body);
        res.status(201).json({ sessionId: sessionId.toString() });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create cooking session' });
    }
}));
// Get a cooking session by ID
router.get('/:id', authenticateToken, (async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const session = await cookingSessionService.getSession(req.params.id, req.user.id);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json(session);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get cooking session' });
    }
}));
// Get cooking session feed
router.get('/', authenticateToken, (async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const sessions = await cookingSessionService.getFeed({
            limit: req.query.limit ? parseInt(req.query.limit) : undefined,
            offset: req.query.offset ? parseInt(req.query.offset) : undefined,
            userId: req.query.userId,
            following: req.query.following === 'true',
            visibility: req.query.visibility
        }, req.user.id);
        res.json({ sessions });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get cooking sessions' });
    }
}));
// Update a cooking session
router.patch('/:id', authenticateToken, validateRequest({ body: updateSessionSchema }), (async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await cookingSessionService.updateSession(req.params.id, req.user.id, req.body);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update cooking session' });
    }
}));
// Delete a cooking session
router.delete('/:id', authenticateToken, (async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await cookingSessionService.deleteSession(req.params.id, req.user.id);
        res.status(200).json({ success: true });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Session not found or user not authorized') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to delete cooking session' });
    }
}));
// Like a cooking session
router.post('/:id/like', authenticateToken, (async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await cookingSessionService.likeSession(req.params.id, req.user.id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to like cooking session' });
    }
}));
// Unlike a cooking session
router.delete('/:id/like', authenticateToken, (async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await cookingSessionService.unlikeSession(req.params.id, req.user.id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to unlike cooking session' });
    }
}));
// Add a comment to a cooking session
router.post('/:id/comments', authenticateToken, validateRequest({ body: commentSchema }), (async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const commentId = await cookingSessionService.addComment(req.params.id, req.user.id, req.body.text);
        res.status(201).json({ commentId: commentId.toString() });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to add comment' });
    }
}));
// Get comments for a cooking session
router.get('/:id/comments', authenticateToken, (async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const offset = req.query.offset ? parseInt(req.query.offset) : 0;
        const comments = await cookingSessionService.getComments(req.params.id, limit, offset);
        res.json({ comments });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get comments' });
    }
}));
export { router as cookingSessionRouter };
//# sourceMappingURL=cooking-sessions.js.map