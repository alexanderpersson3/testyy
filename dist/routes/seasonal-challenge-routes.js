;
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { SeasonalChallengeService } from '../services/social/seasonal-challenges.js';
import { userManager } from '../services/user-manager.js';
import express from 'express';
import { ObjectId } from 'mongodb';
;
import { db } from '../db/database.service.js';
import { auth } from '../middleware/auth.js';
const router = Router();
const seasonalChallenges = new SeasonalChallengeService();
// Validation schemas
const challengeSchema = z.object({
    title: z.string().min(3).max(100),
    description: z.string().min(10).max(500),
    type: z.enum(['recipe_creation', 'recipe_rating', 'recipe_sharing', 'recipe_saving']),
    seasonType: z.enum(['spring', 'summer', 'autumn', 'winter', 'holiday']),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    goal: z.number().min(1),
    reward: z.object({
        type: z.string(),
        value: z.number(),
    }),
});
const progressSchema = z.object({
    progress: z.number().min(0).max(100),
});
// Helper function to handle errors
const handleError = (error) => {
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unexpected error occurred';
};
// Create a new seasonal challenge
router.post('/create', auth, rateLimitMiddleware.api, validateRequest(challengeSchema), async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }
        const isAdmin = await userManager.isAdmin(req.user.id);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required',
            });
        }
        const challenge = {
            ...req.body,
            startDate: new Date(req.body.startDate),
            endDate: new Date(req.body.endDate),
        };
        const result = await seasonalChallenges.createChallenge(challenge);
        return res.status(201).json({
            success: true,
            message: 'Seasonal challenge created',
            data: { challengeId: result._id },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: handleError(error),
        });
    }
});
// Get active seasonal challenges
router.get('/', auth, rateLimitMiddleware.api, async (req, res) => {
    try {
        const challenges = await seasonalChallenges.getActiveSeasonalChallenges();
        res.json(challenges);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch seasonal challenges' });
    }
});
// Join a challenge
router.post('/:challengeId/join', auth, rateLimitMiddleware.api, validateRequest(z.object({
    challengeId: z.string(),
})), async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }
        const { challengeId } = req.params;
        const joined = await seasonalChallenges.joinChallenge(req.user.id, challengeId);
        return res.status(200).json({
            success: true,
            message: 'Successfully joined the challenge',
            data: { joined },
        });
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                message: error.message,
            });
        }
        res.status(500).json({
            success: false,
            message: handleError(error),
        });
    }
});
// Update challenge progress
router.post('/:challengeId/progress', auth, rateLimitMiddleware.api, validateRequest(z.object({
    challengeId: z.string(),
    progress: z.number(),
})), async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }
        const { challengeId } = req.params;
        const { progress } = req.body;
        await seasonalChallenges.updateProgress(req.user.id, challengeId, progress);
        return res.status(200).json({
            success: true,
            message: 'Challenge progress updated',
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: handleError(error),
        });
    }
});
export default router;
//# sourceMappingURL=seasonal-challenge-routes.js.map