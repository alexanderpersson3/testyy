import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { getDb } from '../db.js';
import { ObjectId } from 'mongodb';
const router = Router();
// Validation schemas
const syncItemSchema = z.object({
    type: z.enum(['recipe', 'list', 'favorite']),
    id: z.string(),
    action: z.enum(['create', 'update', 'delete']),
    data: z.record(z.any()).optional()
});
const syncBatchSchema = z.object({
    items: z.array(syncItemSchema),
    deviceId: z.string(),
    lastSyncedAt: z.string().datetime()
});
// Rate limiters
const syncLimiter = rateLimitMiddleware.custom({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: 'Too many sync requests, please try again later.'
});
// Queue sync items
router.post('/queue', requireAuth, syncLimiter, validateRequest({ body: syncBatchSchema }), async (req, res) => {
    try {
        const db = await getDb();
        const { items, deviceId, lastSyncedAt } = req.body;
        // Create sync batch
        const batch = {
            userId: req.user._id,
            deviceId,
            items,
            status: 'pending',
            createdAt: new Date(),
            lastSyncedAt: new Date(lastSyncedAt)
        };
        const result = await db.collection('sync_batches').insertOne(batch);
        res.json({
            success: true,
            batchId: result.insertedId
        });
    }
    catch (error) {
        console.error('Error queueing sync:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to queue sync items'
        });
    }
});
// Get sync status
router.get('/status/:deviceId', requireAuth, syncLimiter, async (req, res) => {
    try {
        const db = await getDb();
        const { deviceId } = req.params;
        const lastSyncedAt = req.query.lastSyncedAt;
        // Get pending sync batches
        const batches = await db.collection('sync_batches')
            .find({
            userId: req.user._id,
            deviceId,
            createdAt: { $gt: new Date(lastSyncedAt) }
        })
            .toArray();
        res.json({
            success: true,
            hasPendingChanges: batches.length > 0,
            lastSyncedAt: batches[0]?.createdAt || lastSyncedAt
        });
    }
    catch (error) {
        console.error('Error getting sync status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get sync status'
        });
    }
});
// Get sync conflicts
router.get('/conflicts', requireAuth, syncLimiter, async (req, res) => {
    try {
        const db = await getDb();
        // Get unresolved conflicts
        const conflicts = await db.collection('sync_conflicts')
            .find({
            userId: req.user._id,
            status: 'unresolved'
        })
            .toArray();
        res.json({
            success: true,
            conflicts: conflicts.map(c => ({
                id: c._id,
                type: c.type,
                localVersion: c.localVersion,
                remoteVersion: c.remoteVersion,
                createdAt: c.createdAt
            }))
        });
    }
    catch (error) {
        console.error('Error getting conflicts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get sync conflicts'
        });
    }
});
// Resolve sync conflict
router.post('/conflicts/:conflictId/resolve', requireAuth, syncLimiter, validateRequest({
    body: z.object({
        resolution: z.enum(['local', 'remote', 'merge']),
        mergedData: z.record(z.any()).optional()
    })
}), async (req, res) => {
    try {
        const db = await getDb();
        const { conflictId } = req.params;
        const { resolution, mergedData } = req.body;
        // Get conflict
        const conflict = await db.collection('sync_conflicts').findOne({
            _id: new ObjectId(conflictId),
            userId: req.user._id,
            status: 'unresolved'
        });
        if (!conflict) {
            return res.status(404).json({
                success: false,
                message: 'Conflict not found'
            });
        }
        // Apply resolution
        let resolvedData;
        switch (resolution) {
            case 'local':
                resolvedData = conflict.localVersion;
                break;
            case 'remote':
                resolvedData = conflict.remoteVersion;
                break;
            case 'merge':
                if (!mergedData) {
                    return res.status(400).json({
                        success: false,
                        message: 'Merged data required for merge resolution'
                    });
                }
                resolvedData = mergedData;
                break;
        }
        // Update data in appropriate collection
        await db.collection(conflict.collection).updateOne({ _id: conflict.itemId }, { $set: resolvedData });
        // Mark conflict as resolved
        await db.collection('sync_conflicts').updateOne({ _id: new ObjectId(conflictId) }, {
            $set: {
                status: 'resolved',
                resolution,
                resolvedData,
                resolvedAt: new Date()
            }
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error resolving conflict:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resolve sync conflict'
        });
    }
});
export default router;
//# sourceMappingURL=sync.js.map