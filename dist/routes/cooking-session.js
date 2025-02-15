;
import { ObjectId } from 'mongodb';
;
import { CookingSessionService } from '../services/cooking-session.service.js';
import { authenticate } from '../middleware/auth.js';
import { z } from 'zod';
const router = Router();
const cookingSessionService = CookingSessionService.getInstance();
// Create session schema
const createSessionSchema = z.object({
    recipeId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    scheduledFor: z.string().datetime().optional(),
    maxParticipants: z.number().min(2).max(20).optional(),
    isPrivate: z.boolean().optional(),
});
// Create a new cooking session
router.post('/', authenticate, validateRequest(createSessionSchema), async (req, res) => {
    try {
        const session = await cookingSessionService.createSession(new ObjectId(req.body.recipeId), new ObjectId(req.user.id), {
            scheduledFor: req.body.scheduledFor ? new Date(req.body.scheduledFor) : undefined,
            maxParticipants: req.body.maxParticipants,
            isPrivate: req.body.isPrivate,
        });
        res.status(201).json(session);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create cooking session' });
    }
});
// Join session schema
const joinSessionSchema = z.object({
    sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/),
});
// Join a cooking session
router.post('/join', authenticate, validateRequest(joinSessionSchema), async (req, res) => {
    try {
        const success = await cookingSessionService.joinSession(new ObjectId(req.body.sessionId), new ObjectId(req.user.id));
        if (success) {
            res.status(200).json({ message: 'Successfully joined session' });
        }
        else {
            res.status(400).json({ error: 'Failed to join session' });
        }
    }
    catch (error) {
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: 'Failed to join session' });
        }
    }
});
// Start session schema
const startSessionSchema = z.object({
    sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/),
});
// Start a cooking session
router.post('/start', authenticate, validateRequest(startSessionSchema), async (req, res) => {
    try {
        const success = await cookingSessionService.startSession(new ObjectId(req.body.sessionId), new ObjectId(req.user.id));
        if (success) {
            res.status(200).json({ message: 'Session started' });
        }
        else {
            res.status(400).json({ error: 'Failed to start session' });
        }
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to start session' });
    }
});
// End session schema
const endSessionSchema = z.object({
    sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/),
});
// End a cooking session
router.post('/end', authenticate, validateRequest(endSessionSchema), async (req, res) => {
    try {
        const success = await cookingSessionService.endSession(new ObjectId(req.body.sessionId), new ObjectId(req.user.id));
        if (success) {
            res.status(200).json({ message: 'Session ended' });
        }
        else {
            res.status(400).json({ error: 'Failed to end session' });
        }
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to end session' });
    }
});
// Update step schema
const updateStepSchema = z.object({
    sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    stepNumber: z.number().min(0),
    completed: z.boolean(),
});
// Update current step
router.post('/step', authenticate, validateRequest(updateStepSchema), async (req, res) => {
    try {
        const success = await cookingSessionService.updateStep(new ObjectId(req.body.sessionId), new ObjectId(req.user.id), req.body.stepNumber, req.body.completed);
        if (success) {
            res.status(200).json({ message: 'Step updated' });
        }
        else {
            res.status(400).json({ error: 'Failed to update step' });
        }
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update step' });
    }
});
// Add photo schema
const addPhotoSchema = z.object({
    sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    imageUrl: z.string().url(),
    caption: z.string().optional(),
    stepNumber: z.number().min(0).optional(),
});
// Add a photo to the session
router.post('/photo', authenticate, validateRequest(addPhotoSchema), async (req, res) => {
    try {
        const photo = await cookingSessionService.addPhoto(new ObjectId(req.body.sessionId), new ObjectId(req.user.id), req.body.imageUrl, {
            caption: req.body.caption,
            stepNumber: req.body.stepNumber,
        });
        res.status(201).json(photo);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to add photo' });
    }
});
// Add comment schema
const addCommentSchema = z.object({
    sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    content: z.string().min(1).max(1000),
    stepNumber: z.number().min(0).optional(),
});
// Add a comment to the session
router.post('/comment', authenticate, validateRequest(addCommentSchema), async (req, res) => {
    try {
        const comment = await cookingSessionService.addComment(new ObjectId(req.body.sessionId), new ObjectId(req.user.id), req.body.content, req.body.stepNumber);
        res.status(201).json(comment);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to add comment' });
    }
});
// Create invite schema
const createInviteSchema = z.object({
    sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    email: z.string().email(),
});
// Create an invite
router.post('/invite', authenticate, validateRequest(createInviteSchema), async (req, res) => {
    try {
        const invite = await cookingSessionService.createInvite(new ObjectId(req.body.sessionId), new ObjectId(req.user.id), req.body.email);
        res.status(201).json(invite);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create invite' });
    }
});
// Accept invite schema
const acceptInviteSchema = z.object({
    inviteId: z.string().regex(/^[0-9a-fA-F]{24}$/),
});
// Accept an invite
router.post('/invite/accept', authenticate, validateRequest(acceptInviteSchema), async (req, res) => {
    try {
        const success = await cookingSessionService.acceptInvite(new ObjectId(req.body.inviteId), new ObjectId(req.user.id));
        if (success) {
            res.status(200).json({ message: 'Invite accepted' });
        }
        else {
            res.status(400).json({ error: 'Failed to accept invite' });
        }
    }
    catch (error) {
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: 'Failed to accept invite' });
        }
    }
});
// Get session details
router.get('/:sessionId', authenticate, async (req, res) => {
    try {
        const session = await cookingSessionService.getSession(new ObjectId(req.params.sessionId));
        if (session) {
            res.status(200).json(session);
        }
        else {
            res.status(404).json({ error: 'Session not found' });
        }
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get session details' });
    }
});
// List active sessions schema
const listSessionsSchema = z.object({
    limit: z.coerce.number().min(1).max(100).optional(),
    offset: z.coerce.number().min(0).optional(),
    includePrivate: z.coerce.boolean().optional(),
});
// List active sessions
router.get('/', authenticate, validateRequest(listSessionsSchema, 'query'), async (req, res) => {
    try {
        const sessions = await cookingSessionService.listActiveSessions({
            limit: req.query.limit ? Number(req.query.limit) : undefined,
            offset: req.query.offset ? Number(req.query.offset) : undefined,
            includePrivate: req.query.includePrivate === 'true',
        });
        res.status(200).json(sessions);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to list sessions' });
    }
});
export default router;
//# sourceMappingURL=cooking-session.js.map