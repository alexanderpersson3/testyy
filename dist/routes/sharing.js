import express, { Response } from 'express';
;
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { SharingService } from '../services/sharing.service.js';
import { ShareChannel, SharePermission } from '../types/sharing.js';
import { AuthError } from '../utils/errors.js';
const router = express.Router();
const sharingService = SharingService.getInstance();
// Create a share
router.post('/recipes/:recipeId/share', auth, [
    check('channel')
        .isIn(['link', 'email', 'facebook', 'twitter', 'pinterest', 'whatsapp', 'telegram', 'embed'])
        .withMessage('Invalid share channel'),
    check('permission')
        .isIn(['view', 'comment', 'rate', 'fork'])
        .withMessage('Invalid permission level'),
    check('expiresAt').optional().isISO8601().withMessage('Invalid expiration date'),
    check('maxUses')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Max uses must be a positive integer'),
    check('password')
        .optional()
        .isString()
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    check('allowedEmails').optional().isArray().withMessage('Allowed emails must be an array'),
    check('allowedEmails.*').optional().isEmail().withMessage('Invalid email address'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const { recipeId } = req.params;
    const result = await sharingService.createShare(recipeId, req.user.id, req.body);
    res.status(201).json(result);
}));
// Update a share
router.put('/shares/:shareId', auth, [
    check('permission')
        .optional()
        .isIn(['view', 'comment', 'rate', 'fork'])
        .withMessage('Invalid permission level'),
    check('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    check('expiresAt').optional().isISO8601().withMessage('Invalid expiration date'),
    check('maxUses')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Max uses must be a positive integer'),
    check('password')
        .optional()
        .isString()
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    check('allowedEmails').optional().isArray().withMessage('Allowed emails must be an array'),
    check('allowedEmails.*').optional().isEmail().withMessage('Invalid email address'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const { shareId } = req.params;
    await sharingService.updateShare(shareId, req.user.id, req.body);
    res.json({ success: true });
}));
// Delete a share
router.delete('/shares/:shareId', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const { shareId } = req.params;
    await sharingService.deleteShare(shareId, req.user.id);
    res.json({ success: true });
}));
// Get shares for a recipe
router.get('/recipes/:recipeId/shares', auth, asyncHandler(async (req, res) => {
    const { channel, isActive, search } = req.query;
    const shares = await sharingService.getShares({
        recipeId: req.params.recipeId,
        channel: channel,
        isActive: typeof isActive === 'string' ? isActive === 'true' : undefined,
        search: search,
    });
    res.json(shares);
}));
// Get shares by user
router.get('/users/:userId/shares', auth, asyncHandler(async (req, res) => {
    const { channel, isActive, search } = req.query;
    const shares = await sharingService.getShares({
        userId: req.params.userId,
        channel: channel,
        isActive: typeof isActive === 'string' ? isActive === 'true' : undefined,
        search: search,
    });
    res.json(shares);
}));
// Access a shared recipe
router.post('/access', [
    check('token').notEmpty().withMessage('Share token is required'),
    check('password').optional().isString(),
    check('email').optional().isEmail().withMessage('Invalid email address'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const result = await sharingService.accessShare(req.body);
    if (!result.success) {
        return res.status(403).json(result);
    }
    res.json(result);
}));
// Get share statistics
router.get('/stats', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const stats = await sharingService.getShareStats(req.user.id);
    res.json(stats);
}));
// Get share metrics
router.get('/shares/:shareId/metrics', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const { shareId } = req.params;
    const metrics = await sharingService.getShareMetrics(shareId);
    res.json(metrics);
}));
export default router;
//# sourceMappingURL=sharing.js.map