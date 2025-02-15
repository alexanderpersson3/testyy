import express, { Response, Request } from 'express';
import { z } from 'zod';
import { auth } from '../../middleware/auth.js';
import { rateLimitMiddleware } from '../../middleware/rate-limit.js';
import { SeasonalChallengeService } from '../../services/social/seasonal-challenges.js';
import { DatabaseService } from '../../db/database.service.js';
import { UserRole } from '../../types/auth.js';
const router = express.Router();
const seasonalChallenges = new SeasonalChallengeService();
const db = DatabaseService.getInstance();
// Validation schemas
const createChallengeSchema = z.object({
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    type: z.enum(['recipe_count', 'cuisine_explorer', 'diet_specialist', 'review_contributor']),
    seasonType: z.enum(['spring', 'summer', 'autumn', 'winter', 'holiday']),
    startDate: z.string().transform(str => new Date(str)),
    endDate: z.string().transform(str => new Date(str)),
    requirements: z.object({
        count: z.number().optional(),
        cuisineTypes: z.array(z.string()).optional(),
        dietTypes: z.array(z.string()).optional(),
        duration: z.number().optional(),
        specificRecipes: z.array(z.string()).optional(),
    }),
    rewards: z.object({
        points: z.number(),
        badgeId: z.string().optional(),
        unlockFeature: z.string().optional(),
    }),
});
const progressSchema = z.object({
    progress: z.number().min(0).max(100),
});
// Create seasonal challenge (admin only)
router.post('/', auth, rateLimitMiddleware.api(), validateRequest(createChallengeSchema), async (req, res) => {
    try {
        if (!req.user || req.user.role !== UserRole.ADMIN) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        const now = new Date();
        const challengeData = {
            ...req.body,
            createdAt: now,
            updatedAt: now
        };
        const result = await db.getCollection('seasonal_challenges').insertOne(challengeData);
        res.status(201).json({ id: result.insertedId });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create seasonal challenge' });
    }
});
// Get active seasonal challenges
router.get('/active', auth, rateLimitMiddleware.api(), async (req, res) => {
    try {
        const challenges = await seasonalChallenges.getActiveSeasonalChallenges();
        res.json({
            success: true,
            data: challenges,
        });
    }
    catch (error) {
        console.error('Error getting active seasonal challenges:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'An unknown error occurred',
        });
    }
});
// Join a challenge
router.post('/:challengeId/join', auth, rateLimitMiddleware.api(), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        // Check if challenge exists and is active
        const challenge = await db.getCollection('seasonal_challenges').findOne({
            _id: new ObjectId(req.params.challengeId),
            endDate: { $gt: new Date() },
        });
        if (!challenge) {
            return res.status(404).json({ error: 'Challenge not found or expired' });
        }
        // Check if user already joined
        const existing = await db.getCollection('challenge_participants').findOne({
            challengeId: new ObjectId(req.params.challengeId),
            userId: new ObjectId(req.user.id),
        });
        if (existing) {
            return res.status(400).json({ error: 'Already joined this challenge' });
        }
        // Join challenge
        const now = new Date();
        const participantData = {
            challengeId: new ObjectId(req.params.challengeId),
            userId: new ObjectId(req.user.id),
            progress: 0,
            joinedAt: now,
            createdAt: now,
            updatedAt: now
        };
        await db.getCollection('challenge_participants').insertOne(participantData);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to join seasonal challenge' });
    }
});
// Update challenge progress
router.post('/:challengeId/progress', auth, rateLimitMiddleware.api(), validateRequest(progressSchema), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const result = await db.getCollection('challenge_participants').updateOne({
            challengeId: new ObjectId(req.params.challengeId),
            userId: new ObjectId(req.user.id),
        }, {
            $set: {
                progress: req.body.progress,
                updatedAt: new Date(),
            },
        });
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Not participating in this challenge' });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update challenge progress' });
    }
});
// Get current season
router.get('/current-season', rateLimitMiddleware.api(), async (req, res) => {
    try {
        const season = await seasonalChallenges.getCurrentSeason();
        res.json({
            success: true,
            data: { season },
        });
    }
    catch (error) {
        console.error('Error getting current season:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'An unknown error occurred',
        });
    }
});
export default router;
//# sourceMappingURL=seasonal-challenges.js.map