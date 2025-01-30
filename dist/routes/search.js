import express from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { SearchService } from '../services/search.js';
const router = express.Router();
// Search recipes
router.get('/recipes', [
    check('query').optional().trim(),
    check('sortBy').optional().isIn(['relevance', 'name', 'createdAt', 'likes', 'rating.average', 'prepTime']),
    check('order').optional().isIn(['asc', 'desc']),
    check('categories').optional().isArray(),
    check('tags').optional().isArray(),
    check('difficulty').optional().isIn(['easy', 'medium', 'hard']),
    check('cuisine').optional().trim(),
    check('maxPrepTime').optional().isInt({ min: 1 }),
    check('isPrivate').optional().isBoolean(),
    check('isPro').optional().isBoolean(),
    check('page').optional().isInt({ min: 1 }),
    check('limit').optional().isInt({ min: 1, max: 50 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const searchService = new SearchService(db.collection('recipes'));
    const { recipes, total } = await searchService.searchRecipes({
        ...req.query,
        userId: req.query.userId ? new ObjectId(req.query.userId) : undefined
    });
    res.json({
        recipes,
        total,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
    });
}));
// Get search suggestions
router.get('/suggestions', [
    check('query').trim().notEmpty()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const searchService = new SearchService(db.collection('recipes'));
    const suggestions = await searchService.getSuggestions(req.query.query);
    res.json({ suggestions });
}));
// Get popular searches
router.get('/popular', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const searchService = new SearchService(db.collection('recipes'));
    const popularSearches = await searchService.getPopularSearches();
    res.json({ popularSearches });
}));
export default router;
//# sourceMappingURL=search.js.map