import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation';
import { rateLimiter } from '../middleware/rate-limit';
import { SeasonalChallengeService } from '../services/social/seasonal-challenges';
import userManager from '../services/user-manager';
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
        value: z.number()
    })
});
const progressSchema = z.object({
    progress: z.number().min(0).max(100)
});
// Helper function to handle errors
const handleError = (error) => {
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unexpected error occurred';
};
// Create a new seasonal challenge
router.post('/create', rateLimiter.api(), validateRequest({
    body: challengeSchema
}), async (req, res) => {
    try {
        const authReq = req;
        if (!authReq.user?.id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }
        const isAdmin = await userManager.isAdmin(authReq.user.id);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        const challenge = {
            ...req.body,
            startDate: new Date(req.body.startDate),
            endDate: new Date(req.body.endDate)
        };
        const challengeId = await seasonalChallenges.createSeasonalChallenge(challenge);
        return res.status(201).json({
            success: true,
            message: 'Seasonal challenge created',
            data: { challengeId }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: handleError(error)
        });
    }
});
// Get active seasonal challenges
router.get('/', rateLimiter.api(), async (req, res) => {
    try {
        const challenges = await seasonalChallenges.getActiveSeasonalChallenges();
        res.json({
            success: true,
            challenges
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: handleError(error)
        });
    }
});
// Join a challenge
router.post('/join', rateLimiter.api(), validateRequest({
    params: z.object({
        challengeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid challenge ID format')
    })
}), async (req, res) => {
    try {
        const authReq = req;
        const { challengeId } = authReq.params;
        if (!authReq.user?.id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }
        const joined = await seasonalChallenges.joinChallenge(authReq.user.id, challengeId);
        return res.status(200).json({
            success: true,
            message: 'Successfully joined the challenge',
            data: { joined }
        });
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        res.status(500).json({
            success: false,
            message: handleError(error)
        });
    }
});
// Update challenge progress
router.post('/progress', rateLimiter.api(), validateRequest({
    params: z.object({
        challengeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid challenge ID format')
    }),
    body: progressSchema
}), async (req, res) => {
    try {
        const authReq = req;
        const { challengeId } = authReq.params;
        if (!authReq.user?.id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }
        const { progress } = authReq.body;
        await seasonalChallenges.updateProgress(authReq.user.id, challengeId, progress);
        return res.status(200).json({
            success: true,
            message: 'Challenge progress updated'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: handleError(error)
        });
    }
});
export default router;
//# sourceMappingURL=seasonal-challenge-routes.js.map