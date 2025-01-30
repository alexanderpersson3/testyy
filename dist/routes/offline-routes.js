import { Router } from 'express';
import { z } from 'zod';
import { rateLimiter } from '../middleware/rate-limit';
import { OfflineStorageService } from '../services/offline-storage';
import SubscriptionManager from '../services/subscription-manager';
import { ObjectId } from 'mongodb';
import { auth } from '../middleware/auth';
const router = Router();
const subscriptionManager = SubscriptionManager.getInstance();
const offlineStorage = new OfflineStorageService({
    hasFeatureAccess: (userId, feature) => subscriptionManager.hasFeatureAccess(userId, feature)
});
// Validation schemas
const recipeIdSchema = z.object({
    recipeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid recipe ID format')
});
// Helper function to handle errors
const handleError = (error) => {
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unexpected error occurred';
};
// Mark recipe for offline access
router.post('/:recipeId', auth, async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const hasAccess = await subscriptionManager.hasFeatureAccess(req.user.id, 'offline_access');
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FEATURE_NOT_AVAILABLE',
                    message: 'Offline access requires a premium subscription'
                }
            });
        }
        const recipeId = new ObjectId(req.params.recipeId);
        await offlineStorage.markRecipeForOffline(recipeId.toString(), req.user.id);
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: {
                code: 'OFFLINE_SAVE_ERROR',
                message: error instanceof Error ? error.message : 'Error saving recipe for offline access'
            }
        });
    }
});
// Get offline recipes
router.get('/', rateLimiter.api(), async (req, res) => {
    try {
        const authReq = req;
        if (!authReq.user?.id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }
        const recipes = await offlineStorage.getOfflineRecipes(authReq.user.id);
        res.json({ success: true, recipes });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: handleError(error)
        });
    }
});
// Remove recipe from offline access
router.delete('/:recipeId', auth, async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const hasAccess = await subscriptionManager.hasFeatureAccess(req.user.id, 'offline_access');
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FEATURE_NOT_AVAILABLE',
                    message: 'Offline access requires a premium subscription'
                }
            });
        }
        const recipeId = new ObjectId(req.params.recipeId);
        await offlineStorage.removeOfflineRecipe(recipeId.toString(), req.user.id);
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: {
                code: 'OFFLINE_DELETE_ERROR',
                message: error instanceof Error ? error.message : 'Error removing recipe from offline access'
            }
        });
    }
});
export default router;
//# sourceMappingURL=offline-routes.js.map