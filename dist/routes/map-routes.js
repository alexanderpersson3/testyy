;
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { MapService } from '../services/map-service.js';
import { userManager } from '../services/user-manager.js';
const router = Router();
const mapService = MapService.getInstance();
// Validation schemas
const coordinatesSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
});
const searchOptionsSchema = z.object({
    maxDistance: z.number().positive().optional(),
    limit: z.number().positive().optional(),
});
const storeIdSchema = z.object({
    storeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid store ID format'),
});
const dealSchema = z
    .object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID format'),
    discount: z.number().min(0).max(100),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
})
    .refine(data => new Date(data.startDate) < new Date(data.endDate), {
    message: 'End date must be after start date',
});
const waitTimeSchema = z.object({
    waitTime: z.number().min(0).max(180), // max 3 hours
});
// Rate limiters
const nearbyStoresLimiter = rateLimit({
    windowMs: 60000, // 1 minute
    max: 30,
    message: 'Too many requests, please try again later',
});
const recipeStoresLimiter = rateLimit({
    windowMs: 60000, // 1 minute
    max: 20,
    message: 'Too many requests, please try again later',
});
const dealsLimiter = rateLimit({
    windowMs: 60000, // 1 minute
    max: 30,
    message: 'Too many requests, please try again later',
});
const addDealLimiter = rateLimit({
    windowMs: 60000, // 1 minute
    max: 10,
    message: 'Too many requests, please try again later',
});
const waitTimeLimiter = rateLimit({
    windowMs: 60000, // 1 minute
    max: 20,
    message: 'Too many requests, please try again later',
});
// Routes
router.get('/stores/nearby', nearbyStoresLimiter, validateRequest(z.object({
    query: searchOptionsSchema.partial(),
    body: coordinatesSchema,
})), async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const options = {
            maxDistance: req.query.maxDistance ? Number(req.query.maxDistance) : undefined,
            limit: req.query.limit ? Number(req.query.limit) : undefined,
        };
        const stores = await mapService.findNearbyStores(latitude, longitude, options);
        res.json(stores);
    }
    catch (error) {
        console.error('Error finding nearby stores:', error);
        res.status(500).json({ error: 'Failed to fetch nearby stores' });
    }
});
router.get('/stores/recipe/:recipeId', recipeStoresLimiter, validateRequest(z.object({
    params: z.object({
        recipeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid recipe ID format'),
    }),
    body: coordinatesSchema,
})), async (req, res) => {
    try {
        const { recipeId } = req.params;
        const coordinates = req.body;
        const stores = await mapService.findStoresForRecipe(recipeId, coordinates);
        res.json(stores);
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Recipe not found') {
            res.status(404).json({ error: 'Recipe not found' });
        }
        else {
            console.error('Error finding stores for recipe:', error);
            res.status(500).json({ error: 'Failed to fetch stores for recipe' });
        }
    }
});
router.get('/stores/:storeId/deals', dealsLimiter, validateRequest(z.object({
    params: storeIdSchema,
})), async (req, res) => {
    try {
        const { storeId } = req.params;
        const deals = await mapService.getStoreBestDeals(storeId);
        res.json(deals);
    }
    catch (error) {
        console.error('Error getting store deals:', error);
        res.status(500).json({ error: 'Failed to fetch store deals' });
    }
});
router.post('/stores/:storeId/deals', addDealLimiter, validateRequest(z.object({
    params: storeIdSchema,
    body: dealSchema,
})), async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const isAdmin = await userManager.isAdmin(req.user.id);
        if (!isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        const { storeId } = req.params;
        const { productId, discount, startDate, endDate } = req.body;
        await mapService.addStoreDeal(storeId, productId, discount, new Date(startDate), new Date(endDate));
        res.status(201).json({ message: 'Deal added successfully' });
    }
    catch (error) {
        console.error('Error adding store deal:', error);
        res.status(500).json({ error: 'Failed to add store deal' });
    }
});
router.post('/stores/:storeId/wait-time', waitTimeLimiter, validateRequest(z.object({
    params: storeIdSchema,
    body: waitTimeSchema,
})), async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const { storeId } = req.params;
        const { waitTime } = req.body;
        await mapService.updateStoreWaitTime(storeId, waitTime);
        res.json({ message: 'Wait time updated successfully' });
    }
    catch (error) {
        console.error('Error updating wait time:', error);
        res.status(500).json({ error: 'Failed to update wait time' });
    }
});
export default router;
//# sourceMappingURL=map-routes.js.map