import express, { Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { SponsorService } from '../services/sponsor.service.js';
import { UserRole } from '../types/auth.js';
import { auth, requireRole } from '../middleware/auth.js';
import { ObjectId } from 'mongodb';
;
const router = express.Router();
const sponsorService = SponsorService.getInstance();
// Validation schemas
const sponsorSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().min(1).max(1000),
    logo: z.string().url(),
    website: z.string().url(),
    contactEmail: z.string().email(),
    status: z.enum(['active', 'inactive']),
    tier: z.enum(['basic', 'premium', 'enterprise']),
    settings: z.object({
        maxDeals: z.number().min(1),
        maxHighlightedItems: z.number().min(0),
        allowedTypes: z.array(z.enum(['highlight', 'discount', 'promotion'])),
    }),
});
const dealSchema = z.object({
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(1000),
    ingredientIds: z.array(z.string()),
    recipeIds: z.array(z.string()),
    type: z.enum(['highlight', 'discount', 'promotion']),
    discount: z
        .object({
        amount: z.number().min(0),
        type: z.enum(['percentage', 'fixed']),
        currency: z.string().optional(),
    })
        .optional(),
    startDate: z.string().transform(str => new Date(str)),
    endDate: z.string().transform(str => new Date(str)),
    priority: z.number().min(0).max(100),
    status: z.enum(['draft', 'active', 'expired', 'cancelled']),
});
const metricsSchema = z.object({
    startDate: z.string().transform(str => new Date(str)),
    endDate: z.string().transform(str => new Date(str)),
});
// Create a new sponsor
router.post('/', auth, requireRole(UserRole.ADMIN), validateRequest(sponsorSchema), asyncHandler(async (req, res) => {
    const sponsor = await sponsorService.createSponsor(req.body);
    res.status(201).json({ success: true, sponsor });
}));
// Create a new sponsor deal
router.post('/:sponsorId/deals', auth, requireRole(UserRole.ADMIN), validateRequest(dealSchema), asyncHandler(async (req, res) => {
    const deal = await sponsorService.createDeal({
        ...req.body,
        sponsorId: new ObjectId(req.params.sponsorId),
    });
    res.status(201).json({ success: true, deal });
}));
// Get deals for ingredients
router.get('/deals/ingredients', asyncHandler(async (req, res) => {
    const ingredientIds = req.query.ids.split(',');
    const deals = await sponsorService.getDealsForIngredients(ingredientIds);
    res.json({ success: true, deals });
}));
// Get deals for recipes
router.get('/deals/recipes', asyncHandler(async (req, res) => {
    const recipeIds = req.query.ids.split(',');
    const deals = await sponsorService.getDealsForRecipes(recipeIds);
    res.json({ success: true, deals });
}));
// Track deal view
router.post('/deals/:dealId/view', asyncHandler(async (req, res) => {
    await sponsorService.trackView(req.params.dealId);
    res.json({ success: true });
}));
// Track deal click
router.post('/deals/:dealId/click', asyncHandler(async (req, res) => {
    await sponsorService.trackClick(req.params.dealId);
    res.json({ success: true });
}));
// Track deal conversion
router.post('/deals/:dealId/convert', asyncHandler(async (req, res) => {
    await sponsorService.trackConversion(req.params.dealId);
    res.json({ success: true });
}));
// Get sponsor metrics
router.get('/:sponsorId/metrics', auth, requireRole(UserRole.ADMIN), validateRequest(metricsSchema), asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const metrics = await sponsorService.getSponsorMetrics(req.params.sponsorId, new Date(startDate), new Date(endDate));
    res.json({ success: true, metrics });
}));
export default router;
//# sourceMappingURL=sponsor.js.map