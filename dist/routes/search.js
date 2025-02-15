import express, {} from 'express';
;
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { SearchService } from '../services/search.service.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
const router = express.Router();
const searchService = SearchService.getInstance();
// Search recipes
router.get('/', (req, res, next) => rateLimitMiddleware.custom({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute for search
    keyPrefix: 'rl:search:',
})(req, res, next), [
    check('text').isString().trim().notEmpty().withMessage('Search text is required'),
    check('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    check('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    check('filters').optional().isObject(),
    check('filters.cuisines').optional().isArray(),
    check('filters.mealTypes').optional().isArray(),
    check('filters.dietaryRestrictions').optional().isArray(),
    check('filters.difficulty').optional().isArray(),
    check('filters.prepTime.min').optional().isInt({ min: 0 }),
    check('filters.prepTime.max').optional().isInt({ min: 0 }),
    check('filters.cookTime.min').optional().isInt({ min: 0 }),
    check('filters.cookTime.max').optional().isInt({ min: 0 }),
    check('filters.totalTime.min').optional().isInt({ min: 0 }),
    check('filters.totalTime.max').optional().isInt({ min: 0 }),
    check('filters.ingredients.include').optional().isArray(),
    check('filters.ingredients.exclude').optional().isArray(),
    check('filters.nutrition').optional().isObject(),
    check('filters.rating.min').optional().isFloat({ min: 0, max: 5 }),
    check('filters.rating.max').optional().isFloat({ min: 0, max: 5 }),
    check('filters.tags').optional().isArray(),
    check('filters.equipment').optional().isArray(),
], (async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { text = '', page = '1', limit = '20', filters: filtersStr, sort: sortStr } = req.query;
        const filters = filtersStr ? JSON.parse(filtersStr) : {};
        const sort = sortStr ? JSON.parse(sortStr) : undefined;
        const searchQuery = {
            text,
            filters,
            sort,
            page: Number(page),
            limit: Number(limit),
        };
        const results = await searchService.search(searchQuery);
        res.json(results);
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            return res.status(400).json({ error: 'Invalid filters or sort format' });
        }
        throw error;
    }
}));
// Advanced search
router.post('/advanced', auth, (async (req, res) => {
    try {
        const { text, filters, sort, page = 1, limit = 20 } = req.body;
        const searchQuery = {
            text,
            filters,
            sort,
            page,
            limit,
        };
        const results = await searchService.search(searchQuery);
        res.json(results);
    }
    catch (error) {
        throw error;
    }
}));
// Get popular searches
router.get('/popular', (req, res, next) => rateLimitMiddleware.api()(req, res, next), [check('period').optional().isIn(['day', 'week', 'month', 'all'])], (async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const filters = {
        category: [req.query.period || 'week'],
    };
    const searchQuery = {
        text: '',
        filters,
        page: 1,
        limit: 10,
    };
    const facets = await searchService.getSearchFacets(searchQuery);
    res.json(facets);
}));
// Get search suggestions
router.get('/suggestions', (req, res, next) => rateLimitMiddleware.api()(req, res, next), [check('text').isString().trim().notEmpty().withMessage('Search text is required')], (async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const suggestions = await searchService.getSuggestions(req.query.text);
    res.json(suggestions);
}));
export default router;
//# sourceMappingURL=search.js.map