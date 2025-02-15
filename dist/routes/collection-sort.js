import express, { Response } from 'express';
;
import { requireAuth } from '../middleware/require-auth.js';
import { asyncHandler } from '../utils/async-handler.js';
const router = express.Router();
const sortService = new CollectionSortService();
// Sort collection recipes
router.post('/:collectionId/sort', requireAuth, [
    check('field')
        .isIn(['name', 'rating', 'difficulty', 'cookingTime', 'created', 'updated', 'popularity'])
        .withMessage('Invalid sort field'),
    check('direction').isIn(['asc', 'desc']).withMessage('Invalid sort direction'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { field, direction } = req.body;
    await sortService.sortCollectionRecipes(req.params.collectionId, { field, direction });
    res.json({ success: true });
}));
// Filter collection recipes
router.post('/:collectionId/filter', requireAuth, [
    check('tags').optional().isArray(),
    check('rating.min').optional().isFloat({ min: 0, max: 5 }),
    check('rating.max').optional().isFloat({ min: 0, max: 5 }),
    check('difficulty').optional().isArray(),
    check('cookingTime.min').optional().isInt({ min: 0 }),
    check('cookingTime.max').optional().isInt({ min: 0 }),
    check('ingredients.include').optional().isArray(),
    check('ingredients.exclude').optional().isArray(),
    check('cuisine').optional().isArray(),
    check('dietary').optional().isArray(),
    check('searchText').optional().isString(),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const filteredCollection = await sortService.filterCollectionRecipes(req.params.collectionId, req.body);
    res.json(filteredCollection);
}));
export default router;
//# sourceMappingURL=collection-sort.js.map