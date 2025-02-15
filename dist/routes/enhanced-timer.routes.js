;
import { ObjectId } from 'mongodb';
;
import { z } from 'zod';
import { EnhancedTimerService } from '../services/enhanced-timer.service.js';
import { authenticate } from '../middleware/auth.js';
import logger from '../utils/logger.js';
const router = Router();
const timerService = EnhancedTimerService.getInstance();
// Validation schemas
const timerParamsSchema = z.object({
    timerId: z.string().refine(val => ObjectId.isValid(val), { message: 'Invalid timer ID format' }),
});
const groupParamsSchema = z.object({
    groupId: z.string().refine(val => ObjectId.isValid(val), { message: 'Invalid group ID format' }),
});
const recipeParamsSchema = z.object({
    recipeId: z
        .string()
        .refine(val => ObjectId.isValid(val), { message: 'Invalid recipe ID format' }),
});
// Create timers from recipe
router.post('/recipes/:recipeId/timers', authenticate, validateRequest(recipeParamsSchema, 'params'), async (req, res) => {
    try {
        const timerGroup = await timerService.createTimersFromRecipe(new ObjectId(req.user._id), new ObjectId(req.params.recipeId));
        res.status(201).json(timerGroup);
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Recipe not found') {
            return res.status(404).json({ error: 'Recipe not found' });
        }
        if (error instanceof Error && error.message === 'No timers found in recipe instructions') {
            return res.status(400).json({ error: 'No timers found in recipe instructions' });
        }
        logger.error('Failed to create timers from recipe:', error);
        res.status(500).json({ error: 'Failed to create timers from recipe' });
    }
});
// Get active timers
router.get('/active', authenticate, async (req, res) => {
    try {
        const timers = await timerService.getActiveTimers(new ObjectId(req.user._id));
        res.json({ timers });
    }
    catch (error) {
        logger.error('Failed to get active timers:', error);
        res.status(500).json({ error: 'Failed to get active timers' });
    }
});
// Get timer groups
router.get('/groups', authenticate, validateRequest(z.object({
    recipeId: z
        .string()
        .refine(val => !val || ObjectId.isValid(val), { message: 'Invalid recipe ID format' })
        .optional(),
}), 'query'), async (req, res) => {
    try {
        const groups = await timerService.getTimerGroups(new ObjectId(req.user._id), req.query.recipeId ? new ObjectId(req.query.recipeId) : undefined);
        res.json({ groups });
    }
    catch (error) {
        logger.error('Failed to get timer groups:', error);
        res.status(500).json({ error: 'Failed to get timer groups' });
    }
});
// Start timer
router.post('/timers/:timerId/start', authenticate, validateRequest(timerParamsSchema, 'params'), async (req, res) => {
    try {
        const timer = await timerService.startTimer(new ObjectId(req.params.timerId));
        res.json({ timer });
    }
    catch (error) {
        if (error instanceof Error) {
            switch (error.message) {
                case 'Timer not found':
                    return res.status(404).json({ error: 'Timer not found' });
                case 'Timer cannot be started':
                    return res.status(400).json({ error: 'Timer cannot be started' });
                default:
                    logger.error('Failed to start timer:', error);
                    return res.status(500).json({ error: 'Failed to start timer' });
            }
        }
        res.status(500).json({ error: 'Failed to start timer' });
    }
});
// Start timer group
router.post('/groups/:groupId/start', authenticate, validateRequest(groupParamsSchema, 'params'), async (req, res) => {
    try {
        const group = await timerService.startTimerGroup(new ObjectId(req.params.groupId));
        res.json({ group });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Timer group not found') {
            return res.status(404).json({ error: 'Timer group not found' });
        }
        logger.error('Failed to start timer group:', error);
        res.status(500).json({ error: 'Failed to start timer group' });
    }
});
// Pause timer
router.post('/timers/:timerId/pause', authenticate, validateRequest(timerParamsSchema, 'params'), async (req, res) => {
    try {
        const timer = await timerService.pauseTimer(new ObjectId(req.params.timerId));
        res.json({ timer });
    }
    catch (error) {
        if (error instanceof Error) {
            switch (error.message) {
                case 'Timer not found':
                    return res.status(404).json({ error: 'Timer not found' });
                case 'Timer cannot be paused':
                    return res.status(400).json({ error: 'Timer cannot be paused' });
                default:
                    logger.error('Failed to pause timer:', error);
                    return res.status(500).json({ error: 'Failed to pause timer' });
            }
        }
        res.status(500).json({ error: 'Failed to pause timer' });
    }
});
// Stop timer
router.post('/timers/:timerId/stop', authenticate, validateRequest(timerParamsSchema, 'params'), async (req, res) => {
    try {
        const timer = await timerService.stopTimer(new ObjectId(req.params.timerId));
        res.json({ timer });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Timer not found') {
            return res.status(404).json({ error: 'Timer not found' });
        }
        logger.error('Failed to stop timer:', error);
        res.status(500).json({ error: 'Failed to stop timer' });
    }
});
// Bulk start timers
router.post('/timers/bulk/start', authenticate, validateRequest(z.object({
    timerIds: z.array(z.string().refine(val => ObjectId.isValid(val), { message: 'Invalid timer ID format' })),
}), 'body'), async (req, res) => {
    try {
        const timers = await timerService.startTimers(req.body.timerIds.map((id) => new ObjectId(id)));
        res.json({ timers });
    }
    catch (error) {
        logger.error('Failed to start timers:', error);
        res.status(500).json({ error: 'Failed to start timers' });
    }
});
// Bulk pause timers
router.post('/timers/bulk/pause', authenticate, validateRequest(z.object({
    timerIds: z.array(z.string().refine(val => ObjectId.isValid(val), { message: 'Invalid timer ID format' })),
}), 'body'), async (req, res) => {
    try {
        const timers = await timerService.pauseTimers(req.body.timerIds.map((id) => new ObjectId(id)));
        res.json({ timers });
    }
    catch (error) {
        logger.error('Failed to pause timers:', error);
        res.status(500).json({ error: 'Failed to pause timers' });
    }
});
// Bulk stop timers
router.post('/timers/bulk/stop', authenticate, validateRequest(z.object({
    timerIds: z.array(z.string().refine(val => ObjectId.isValid(val), { message: 'Invalid timer ID format' })),
}), 'body'), async (req, res) => {
    try {
        const timers = await timerService.stopTimers(req.body.timerIds.map((id) => new ObjectId(id)));
        res.json({ timers });
    }
    catch (error) {
        logger.error('Failed to stop timers:', error);
        res.status(500).json({ error: 'Failed to stop timers' });
    }
});
// Sync timer
router.post('/timers/:timerId/sync', authenticate, validateRequest(timerParamsSchema, 'params'), async (req, res) => {
    try {
        const timer = await timerService.syncTimer(new ObjectId(req.params.timerId));
        res.json({ timer });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Timer not found') {
            return res.status(404).json({ error: 'Timer not found' });
        }
        logger.error('Failed to sync timer:', error);
        res.status(500).json({ error: 'Failed to sync timer' });
    }
});
// Get timer statistics
router.get('/stats', authenticate, async (req, res) => {
    try {
        const stats = await timerService.getTimerStats(new ObjectId(req.user._id));
        res.json({ stats });
    }
    catch (error) {
        logger.error('Failed to get timer statistics:', error);
        res.status(500).json({ error: 'Failed to get timer statistics' });
    }
});
// Reset timer
router.post('/timers/:timerId/reset', authenticate, validateRequest(timerParamsSchema, 'params'), async (req, res) => {
    try {
        const timer = await timerService.resetTimer(new ObjectId(req.params.timerId));
        res.json({ timer });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Timer not found') {
            return res.status(404).json({ error: 'Timer not found' });
        }
        logger.error('Failed to reset timer:', error);
        res.status(500).json({ error: 'Failed to reset timer' });
    }
});
// Add alerts to timer
router.post('/timers/:timerId/alerts', authenticate, validateRequest(timerParamsSchema, 'params'), validateRequest(z.object({
    alerts: z.array(z.object({
        type: z.enum(['notification', 'sound', 'voice']),
        time: z.number().min(0),
        message: z.string(),
    })),
}), 'body'), async (req, res) => {
    try {
        const timer = await timerService.addAlerts(new ObjectId(req.params.timerId), req.body.alerts);
        res.json({ timer });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Timer not found') {
            return res.status(404).json({ error: 'Timer not found' });
        }
        logger.error('Failed to add alerts:', error);
        res.status(500).json({ error: 'Failed to add alerts' });
    }
});
export default router;
//# sourceMappingURL=enhanced-timer.routes.js.map