import express, { Response } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { CreatorTipService } from '../services/creator-tip.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ObjectId } from 'mongodb';
;
import { ValidationError } from '../utils/errors.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
const router = express.Router();
const creatorTipService = CreatorTipService.getInstance();
// Validation schemas
const addTipSchema = z.object({
    text: z.string().min(1).max(1000),
}).strict();
const recipeParamsSchema = z.object({
    recipeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid recipe ID'),
}).strict();
const tipParamsSchema = z.object({
    recipeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid recipe ID'),
    tipIndex: z.string().transform((val) => parseInt(val, 10)),
}).strict();
// Add a tip to a recipe
router.post('/recipes/:recipeId/tips', auth, rateLimitMiddleware.api(), validateRequest(recipeParamsSchema, 'params'), validateRequest(addTipSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const tip = await creatorTipService.createTip(new ObjectId(req.user.id), req.body.text);
    if (!tip._id) {
        throw new ValidationError('Failed to create tip');
    }
    res.status(201).json({
        success: true,
        tipId: tip._id.toString(),
    });
}));
// Toggle tip visibility
router.patch('/recipes/:recipeId/tips/:tipIndex/visibility', auth, rateLimitMiddleware.api(), validateRequest(tipParamsSchema, 'params'), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const tip = await creatorTipService.getTip(new ObjectId(req.params.tipIndex));
    if (!tip || !tip._id) {
        throw new ValidationError('Tip not found');
    }
    await creatorTipService.updateTip(tip._id, new ObjectId(req.user.id), tip.content);
    res.json({ success: true });
}));
// Delete a tip
router.delete('/recipes/:recipeId/tips/:tipIndex', auth, rateLimitMiddleware.api(), validateRequest(tipParamsSchema, 'params'), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const tip = await creatorTipService.getTip(new ObjectId(req.params.tipIndex));
    if (!tip || !tip._id) {
        throw new ValidationError('Tip not found');
    }
    await creatorTipService.deleteTip(tip._id, new ObjectId(req.user.id));
    res.json({ success: true });
}));
// Get visible tips for a recipe
router.get('/recipes/:recipeId/tips', rateLimitMiddleware.api(), validateRequest(recipeParamsSchema, 'params'), asyncHandler(async (req, res) => {
    const tips = await creatorTipService.getUserTips(new ObjectId(req.params.recipeId));
    res.json({ success: true, tips });
}));
export default router;
//# sourceMappingURL=creator-tips.js.map