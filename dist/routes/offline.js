import express from 'express';
;
import { requireAuth } from '../middleware/require-auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { OfflineService } from '../services/offline.service.js';
import { CleanupOptions } from '../types/offline.js';
const router = express.Router();
const offlineService = OfflineService.getInstance();
// Download recipes for offline access
router.post('/download', requireAuth, [
    check('recipeIds').isArray().withMessage('Recipe IDs array is required'),
    check('recipeIds.*').isMongoId().withMessage('Valid recipe IDs are required'),
    check('includeAttachments').optional().isBoolean(),
    check('quality').optional().isIn(['original', 'high', 'medium', 'low']),
    check('priority').optional().isIn(['high', 'normal', 'low']),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const result = await offlineService.downloadRecipes(req.user.id, req.body);
    res.status(201).json(result);
}));
// Sync offline changes
router.post('/sync', requireAuth, asyncHandler(async (req, res) => {
    await offlineService.syncChanges(req.user.id);
    res.status(204).send();
}));
// Clean up offline storage
router.post('/cleanup', requireAuth, [
    check('olderThan').optional().isISO8601(),
    check('excludeFavorites').optional().isBoolean(),
    check('excludeRecent').optional().isBoolean(),
    check('minSpaceRequired').optional().isInt({ min: 0 }),
    check('dryRun').optional().isBoolean(),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const options = {
        ...req.body,
        olderThan: req.body.olderThan ? new Date(req.body.olderThan) : undefined,
    };
    const result = await offlineService.cleanupStorage(req.user.id, options);
    res.json(result);
}));
// Get offline storage stats
router.get('/stats', requireAuth, asyncHandler(async (req, res) => {
    const stats = await offlineService.getStats(req.user.id);
    res.json(stats);
}));
// Store data for offline access
router.post('/:type/:id', requireAuth, [
    check('type').isIn(['recipe', 'collection', 'list']).withMessage('Invalid type'),
    check('id').isString().withMessage('Invalid ID'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { type, id } = req.params;
    const data = req.body;
    await offlineService.storeOfflineData(req.user.id, type, id, data);
    res.json({ success: true });
}));
// Get offline data
router.get('/:type/:id', requireAuth, [
    check('type').isIn(['recipe', 'collection', 'list']).withMessage('Invalid type'),
    check('id').isString().withMessage('Invalid ID'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { type, id } = req.params;
    const data = await offlineService.getOfflineData(req.user.id, type, id);
    if (!data) {
        return res.status(404).json({ error: 'Offline data not found' });
    }
    res.json(data);
}));
// Delete offline data
router.delete('/:type/:id', requireAuth, [
    check('type').isIn(['recipe', 'collection', 'list']).withMessage('Invalid type'),
    check('id').isString().withMessage('Invalid ID'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { type, id } = req.params;
    await offlineService.deleteOfflineData(req.user.id, type, id);
    res.status(204).send();
}));
// Clear old offline data
router.delete('/clear', requireAuth, [check('maxAge').isInt({ min: 0 }).withMessage('Max age must be a positive number')], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    await offlineService.clearOldData(req.user.id, req.body.maxAge);
    res.status(204).send();
}));
export default router;
//# sourceMappingURL=offline.js.map