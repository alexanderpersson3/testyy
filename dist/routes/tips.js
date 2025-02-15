;
import { ObjectId } from 'mongodb';
;
;
import { auth } from '../middleware/auth.js';
import { TipsService, CreateTipDTO, UpdateTipDTO, TipCategory, TipStatus } from '../services/tips.service.js';
import { DatabaseError, NotFoundError } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import logger from '../utils/logger.js';
const router = Router();
const tipsService = TipsService.getInstance();
// Get all tips
const getTips = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const { status, category, tags, page, limit } = req.query;
    const options = {
        status: status,
        category: category,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
    };
    try {
        const result = await tipsService.getTips(options);
        res.json(result);
    }
    catch (error) {
        if (error instanceof DatabaseError) {
            res.status(500).json({ error: error.message });
        }
        else {
            logger.error('Failed to get tips:', error);
            res.status(500).json({ error: 'Failed to get tips' });
        }
    }
};
// Get tip by ID
const getTipById = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    try {
        const tip = await tipsService.getTip(new ObjectId(req.params.id));
        await tipsService.incrementViews(tip._id);
        res.json(tip);
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else if (error instanceof DatabaseError) {
            res.status(500).json({ error: error.message });
        }
        else {
            logger.error('Failed to get tip:', error);
            res.status(500).json({ error: 'Failed to get tip' });
        }
    }
};
// Create new tip
const createTip = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const tipData = {
        ...req.body,
        author: {
            _id: req.user._id,
            name: req.user.name,
        },
    };
    try {
        const tip = await tipsService.createTip(tipData);
        res.status(201).json(tip);
    }
    catch (error) {
        if (error instanceof DatabaseError) {
            res.status(500).json({ error: error.message });
        }
        else {
            logger.error('Failed to create tip:', error);
            res.status(500).json({ error: 'Failed to create tip' });
        }
    }
};
// Update tip
const updateTip = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const tip = await tipsService.updateTip(new ObjectId(req.params.id), req.body);
        res.json(tip);
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else if (error instanceof DatabaseError) {
            res.status(500).json({ error: error.message });
        }
        else {
            logger.error('Failed to update tip:', error);
            res.status(500).json({ error: 'Failed to update tip' });
        }
    }
};
// Delete tip
const deleteTip = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    try {
        await tipsService.deleteTip(new ObjectId(req.params.id));
        res.json({ message: 'Tip deleted successfully' });
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else if (error instanceof DatabaseError) {
            res.status(500).json({ error: error.message });
        }
        else {
            logger.error('Failed to delete tip:', error);
            res.status(500).json({ error: 'Failed to delete tip' });
        }
    }
};
// Like tip
const likeTip = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    try {
        await tipsService.likeTip(new ObjectId(req.params.id));
        res.json({ message: 'Tip liked successfully' });
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else if (error instanceof DatabaseError) {
            res.status(500).json({ error: error.message });
        }
        else {
            logger.error('Failed to like tip:', error);
            res.status(500).json({ error: 'Failed to like tip' });
        }
    }
};
// Unlike tip
const unlikeTip = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    try {
        await tipsService.unlikeTip(new ObjectId(req.params.id));
        res.json({ message: 'Tip unliked successfully' });
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else if (error instanceof DatabaseError) {
            res.status(500).json({ error: error.message });
        }
        else {
            logger.error('Failed to unlike tip:', error);
            res.status(500).json({ error: 'Failed to unlike tip' });
        }
    }
};
// Get popular tips
const getPopularTips = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
        const tips = await tipsService.getPopularTips(limit);
        res.json(tips);
    }
    catch (error) {
        if (error instanceof DatabaseError) {
            res.status(500).json({ error: error.message });
        }
        else {
            logger.error('Failed to get popular tips:', error);
            res.status(500).json({ error: 'Failed to get popular tips' });
        }
    }
};
// Search tips
const searchTips = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    try {
        const { query, limit } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }
        const tips = await tipsService.searchTips(query, limit ? parseInt(limit) : undefined);
        res.json(tips);
    }
    catch (error) {
        if (error instanceof DatabaseError) {
            res.status(500).json({ error: error.message });
        }
        else {
            logger.error('Failed to search tips:', error);
            res.status(500).json({ error: 'Failed to search tips' });
        }
    }
};
// Register routes
router.get('/', auth, rateLimitMiddleware.api(), asyncHandler(getTips));
router.get('/popular', auth, rateLimitMiddleware.api(), asyncHandler(getPopularTips));
router.get('/search', auth, rateLimitMiddleware.api(), asyncHandler(searchTips));
router.get('/:id', auth, rateLimitMiddleware.api(), asyncHandler(getTipById));
router.post('/', auth, rateLimitMiddleware.api(), [
    check('title').trim().notEmpty(),
    check('content').trim().notEmpty(),
    check('category').isIn(['cooking', 'organization', 'shopping', 'general']),
    check('tags').isArray(),
], asyncHandler(createTip));
router.patch('/:id', auth, rateLimitMiddleware.api(), [
    check('title').optional().trim().notEmpty(),
    check('content').optional().trim().notEmpty(),
    check('category').optional().isIn(['cooking', 'organization', 'shopping', 'general']),
    check('status').optional().isIn(['draft', 'published', 'archived']),
    check('tags').optional().isArray(),
], asyncHandler(updateTip));
router.delete('/:id', auth, rateLimitMiddleware.api(), asyncHandler(deleteTip));
router.post('/:id/like', auth, rateLimitMiddleware.api(), asyncHandler(likeTip));
router.post('/:id/unlike', auth, rateLimitMiddleware.api(), asyncHandler(unlikeTip));
export default router;
//# sourceMappingURL=tips.js.map