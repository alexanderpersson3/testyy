import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../../middleware/validation';
import { auth } from '../../middleware/auth';
import { rateLimiter } from '../../middleware/rate-limit';
import { SeasonalChallengeService } from '../../services/social/seasonal-challenges';
const router = express.Router();
const seasonalChallenges = new SeasonalChallengeService();
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
        specificRecipes: z.array(z.string()).optional()
    }),
    rewards: z.object({
        points: z.number(),
        badgeId: z.string().optional(),
        unlockFeature: z.string().optional()
    })
});
const progressSchema = z.object({
    progress: z.number().min(0).max(100)
});
// Create seasonal challenge (admin only)
router.post('/', auth, rateLimiter.api(), validateRequest({ body: createChallengeSchema }), async (req, res) => {
    try {
        // Verify admin status
        if (!req.user?.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        const challengeId = await seasonalChallenges.createSeasonalChallenge(req.body);
        res.status(201).json({
            success: true,
            data: { challengeId }
        });
    }
    catch (error) {
        console.error('Error creating seasonal challenge:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'An unknown error occurred'
        });
    }
});
// Get active seasonal challenges
router.get('/active', auth, rateLimiter.api(), async (req, res) => {
    try {
        const challenges = await seasonalChallenges.getActiveSeasonalChallenges();
        res.json({
            success: true,
            data: challenges
        });
    }
    catch (error) {
        console.error('Error getting active seasonal challenges:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'An unknown error occurred'
        });
    }
});
// Join a challenge
router.post('/:challengeId/join', auth, rateLimiter.api(), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        const success = await seasonalChallenges.joinChallenge(req.user.id, req.params.challengeId);
        res.json({
            success,
            message: success ? 'Successfully joined challenge' : 'Failed to join challenge'
        });
    }
    catch (error) {
        console.error('Error joining challenge:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'An unknown error occurred'
        });
    }
});
// Update challenge progress
router.post('/:challengeId/progress', auth, rateLimiter.api(), validateRequest({ body: progressSchema }), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        await seasonalChallenges.updateProgress(req.user.id, req.params.challengeId, req.body.progress);
        res.json({
            success: true,
            message: 'Progress updated successfully'
        });
    }
    catch (error) {
        console.error('Error updating challenge progress:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'An unknown error occurred'
        });
    }
});
// Get current season
router.get('/current-season', rateLimiter.api(), async (req, res) => {
    try {
        const season = await seasonalChallenges.getCurrentSeason();
        res.json({
            success: true,
            data: { season }
        });
    }
    catch (error) {
        console.error('Error getting current season:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'An unknown error occurred'
        });
    }
});
export default router;
//# sourceMappingURL=seasonal-challenges.js.map