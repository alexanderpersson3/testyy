import express, { Response } from 'express';
;
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { VariationsService } from '../services/variations.service.js';
import { VariationType } from '../types/recipe-variation.js';
import { ObjectId } from 'mongodb';
;
const router = express.Router();
const variationsService = VariationsService.getInstance();
// Get variations for a recipe
router.get('/recipes/:recipeId/variations', asyncHandler(async (req, res) => {
    const { type, status, isApproved, sort = 'newest', limit = '20', offset = '0', } = req.query;
    const variations = await variationsService.getVariations({
        originalRecipeId: req.params.recipeId,
        type: type ? [type] : undefined,
        status: status ? [status] : undefined,
        isVerified: typeof isApproved === 'string' ? isApproved === 'true' : undefined,
        sort: sort,
        limit: parseInt(limit),
        offset: parseInt(offset),
    });
    res.json(variations);
}));
// Get variations by user
router.get('/users/:userId/variations', asyncHandler(async (req, res) => {
    const { type, status, isApproved, sort = 'newest', limit = '20', offset = '0', } = req.query;
    const variations = await variationsService.getVariations({
        authorId: req.params.userId,
        type: type ? [type] : undefined,
        status: status ? [status] : undefined,
        isVerified: typeof isApproved === 'string' ? isApproved === 'true' : undefined,
        sort: sort,
        limit: parseInt(limit),
        offset: parseInt(offset),
    });
    res.json(variations);
}));
// Get a single variation
router.get('/variations/:variationId', asyncHandler(async (req, res) => {
    const { variationId } = req.params;
    const variations = await variationsService.getVariations({
        originalRecipeId: variationId
    });
    if (variations.length === 0) {
        return res.status(404).json({ message: 'Variation not found' });
    }
    res.json(variations[0]);
}));
// Create a variation
router.post('/', auth, [
    check('originalRecipeId').isMongoId().withMessage('Valid recipe ID is required'),
    check('name').isString().trim().notEmpty().withMessage('Name is required'),
    check('description').isString().trim().notEmpty().withMessage('Description is required'),
    check('type')
        .isIn(['dietary', 'ingredient', 'method', 'equipment', 'seasonal', 'regional'])
        .withMessage('Valid variation type is required'),
    check('changes').isArray().withMessage('Changes array is required'),
    check('changes.*.type')
        .isIn([
        'add_ingredient',
        'remove_ingredient',
        'substitute_ingredient',
        'adjust_amount',
        'add_step',
        'remove_step',
        'modify_step',
        'change_equipment',
        'adjust_time',
        'adjust_temperature',
    ])
        .withMessage('Valid change type is required'),
    check('changes.*.description')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Change description is required'),
    check('changes.*.details').isObject().withMessage('Change details are required'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const variation = await variationsService.createVariation(req.user.id, req.body);
    res.status(201).json(variation);
}));
// Update a variation
router.put('/:variationId', auth, [
    check('name').optional().isString().trim(),
    check('description').optional().isString().trim(),
    check('type')
        .optional()
        .isIn(['dietary', 'ingredient', 'method', 'equipment', 'seasonal', 'regional']),
    check('changes').optional().isArray(),
    check('changes.*.type')
        .optional()
        .isIn([
        'add_ingredient',
        'remove_ingredient',
        'substitute_ingredient',
        'adjust_amount',
        'add_step',
        'remove_step',
        'modify_step',
        'change_equipment',
        'adjust_time',
        'adjust_temperature',
    ]),
    check('changes.*.description').optional().isString().trim(),
    check('changes.*.details').optional().isObject(),
    check('status').optional().isIn(['draft', 'published', 'archived']),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { variationId } = req.params;
    const variation = await variationsService.updateVariation(req.user.id, variationId, req.body);
    res.json(variation);
}));
// Delete a variation
router.delete('/:variationId', auth, asyncHandler(async (req, res) => {
    const { variationId } = req.params;
    await variationsService.deleteVariation(req.user.id, variationId);
    res.status(204).send();
}));
// Rate a variation
router.post('/variations/:variationId/rate', auth, [
    check('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    check('review').optional().trim(),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { variationId } = req.params;
    const userId = req.user.id;
    await variationsService.addReview(userId, variationId, {
        rating: req.body.rating,
        comment: req.body.review,
        success: true
    });
    res.json({ success: true });
}));
// Get variation stats
router.get('/variations/:variationId/stats', asyncHandler(async (req, res) => {
    const { variationId } = req.params;
    const stats = await variationsService.getStats(variationId);
    res.json(stats);
}));
export default router;
//# sourceMappingURL=variations.js.map