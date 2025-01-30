import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';
import { OfflineStorageService } from '../services/offline-storage';
import SubscriptionManager from '../services/subscription-manager';
const router = express.Router();
// Validation schemas
const saveRecipeSchema = z.object({
    recipeId: z.string(),
    data: z.any()
});
// Initialize services
let offlineStorage = null;
async function getOfflineStorage() {
    if (!offlineStorage) {
        const subscriptionManager = SubscriptionManager.getInstance();
        offlineStorage = new OfflineStorageService({
            hasFeatureAccess: (userId, feature) => subscriptionManager.hasFeatureAccess(userId, feature)
        });
    }
    return offlineStorage;
}
// Save recipe for offline use
router.post('/recipes', authenticateToken, validateRequest({ body: saveRecipeSchema }), (async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const storage = await getOfflineStorage();
        await storage.markRecipeForOffline(req.user.id, req.body.recipeId);
        res.status(201).json({ success: true });
    }
    catch (error) {
        if (error instanceof Error) {
            res.status(error.message.includes('Premium') ? 403 : 500).json({
                success: false,
                message: error.message
            });
        }
        else {
            res.status(500).json({
                success: false,
                message: 'An unexpected error occurred'
            });
        }
    }
}));
// Get offline recipes
router.get('/recipes', authenticateToken, (async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const storage = await getOfflineStorage();
        const recipes = await storage.getOfflineRecipes(req.user.id);
        res.json({ recipes });
    }
    catch (error) {
        if (error instanceof Error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
        else {
            res.status(500).json({
                success: false,
                message: 'An unexpected error occurred'
            });
        }
    }
}));
// Delete offline recipe
router.delete('/recipes/:recipeId', authenticateToken, (async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const storage = await getOfflineStorage();
        await storage.removeOfflineRecipe(req.user.id, req.params.recipeId);
        res.json({ success: true });
    }
    catch (error) {
        if (error instanceof Error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
        else {
            res.status(500).json({
                success: false,
                message: 'An unexpected error occurred'
            });
        }
    }
}));
// Export the router as default
export default router;
//# sourceMappingURL=offline.js.map