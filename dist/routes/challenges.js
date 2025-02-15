import express, { Response, Request, Router } from 'express';
import { ChallengeService } from '../services/challenge.service.js';
import { WebSocketService } from '../services/websocket-service.js';
import { z } from 'zod';
import { Server } from 'http';
import { UserRole } from '../types/auth.js';
import { ObjectId } from 'mongodb';
;
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { auth, requireRole } from '../middleware/auth.js';
const router = express.Router();
const wsService = WebSocketService.getInstance();
const challengeService = ChallengeService.getInstance();
// Validation schemas
const createChallengeSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().min(1).max(1000),
    type: z.enum(['count', 'streak', 'achievement']),
    startDate: z.string().transform(str => new Date(str)),
    endDate: z.string().transform(str => new Date(str)),
    targetGoal: z.number().positive(),
    rules: z.array(z.string()),
    rewards: z
        .array(z.object({
        type: z.string(),
        value: z.any(),
    }))
        .optional(),
});
const updateChallengeSchema = createChallengeSchema.partial().extend({
    status: z.enum(['upcoming', 'active', 'completed', 'cancelled']).optional(),
});
// Create a new challenge (admin only)
router.post('/', auth, requireRole(UserRole.ADMIN), rateLimitMiddleware.api, validateRequest(createChallengeSchema), async (req, res) => {
    try {
        const result = await getCollection('challenges').insertOne({
            ...req.body,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        res.status(201).json({ id: result.insertedId });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create challenge' });
    }
});
// Get a challenge by ID
router.get('/:id', auth, rateLimitMiddleware.api, async (req, res) => {
    try {
        const { id } = req.params;
        const challenge = await getCollection('challenges').findOne({ _id: new ObjectId(id) });
        if (!challenge) {
            return res.status(404).json({ error: 'Challenge not found' });
        }
        res.json(challenge);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch challenge' });
    }
});
// Get challenges list
router.get('/', auth, rateLimitMiddleware.api, async (req, res) => {
    try {
        const challenges = await getCollection('challenges').find().toArray();
        res.json(challenges);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch challenges' });
    }
});
// Update a challenge (admin only)
router.put('/:id', auth, requireRole(UserRole.ADMIN), rateLimitMiddleware.api, validateRequest(updateChallengeSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await getCollection('challenges').updateOne({ _id: new ObjectId(id) }, {
            $set: {
                ...req.body,
                updatedAt: new Date(),
            },
        });
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Challenge not found' });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update challenge' });
    }
});
// Delete challenge (admin only)
router.delete('/:id', auth, requireRole(UserRole.ADMIN), rateLimitMiddleware.api, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await getCollection('challenges').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Challenge not found' });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete challenge' });
    }
});
// Join a challenge
router.post('/:id/join', auth, rateLimitMiddleware.api, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id.toString();
        const challenge = await challengeService.joinChallenge(id, userId);
        res.json(challenge);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to join challenge' });
    }
});
// Leave a challenge
router.post('/:id/leave', auth, rateLimitMiddleware.api, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id.toString();
        const challenge = await challengeService.leaveChallenge(id, userId);
        res.json(challenge);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to leave challenge' });
    }
});
export default router;
//# sourceMappingURL=challenges.js.map