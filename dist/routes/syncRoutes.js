;
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { SyncService } from '../services/syncService.js';
import { SyncBatch, SyncItem, SyncStatus } from '../types/sync.js';
import { queueSyncSchema, processBatchSchema, resolveConflictSchema, syncStatusQuerySchema, QueueSync, ProcessBatch, ResolveConflict, SyncStatusQuery, SyncQueueItem, } from '../schemas/syncSchemas.js';
const router = Router();
const syncCollection = getCollection('syncData');
const syncService = new SyncService(syncCollection);
// Sync routes
router.post('/sync', auth, asyncHandler(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
            },
        });
    }
    const batch = {
        items: req.body.items.map((item) => ({
            id: item.id,
            version: item.version,
            deleted: item.deleted,
            data: item.data,
        })),
        clientId: req.body.clientId,
        timestamp: new Date(req.body.timestamp),
        userId: new ObjectId(req.user.id),
        status: 'pending',
    };
    const result = await syncService.sync(batch);
    res.json(result);
}));
// Queue changes for sync
router.post('/queue', auth, asyncHandler(async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                },
            });
        }
        const { items } = req.body;
        const batch = await syncService.queueSync(new ObjectId(req.user.id), items);
        res.status(201).json({
            success: true,
            data: batch,
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_SYNC_DATA',
                message: error instanceof Error ? error.message : 'Invalid sync data',
            },
        });
    }
}));
// Process sync batch
router.post('/process/:batchId', auth, asyncHandler(async (req, res) => {
    try {
        const batchId = new ObjectId(req.params.batchId);
        const result = await syncService.processBatch(batchId);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: {
                code: 'SYNC_PROCESSING_ERROR',
                message: error instanceof Error ? error.message : 'Error processing sync batch',
            },
        });
    }
}));
// Get sync conflicts
router.get('/conflicts', auth, asyncHandler(async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                },
            });
        }
        const conflicts = await syncService.getConflicts(new ObjectId(req.user.id));
        res.json({
            success: true,
            data: conflicts,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: {
                code: 'CONFLICT_FETCH_ERROR',
                message: error instanceof Error ? error.message : 'Error fetching conflicts',
            },
        });
    }
}));
// Resolve sync conflict
router.post('/conflicts/:conflictId/resolve', auth, asyncHandler(async (req, res) => {
    try {
        const conflictId = new ObjectId(req.params.conflictId);
        const { resolution, manualData } = req.body;
        await syncService.resolveConflict(conflictId, resolution, manualData);
        res.json({
            success: true,
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: {
                code: 'CONFLICT_RESOLUTION_ERROR',
                message: error instanceof Error ? error.message : 'Error resolving conflict',
            },
        });
    }
}));
// Get sync status
router.get('/status', auth, asyncHandler(async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                },
            });
        }
        const deviceId = req.query.deviceId;
        const lastSyncedAt = req.query.lastSyncedAt
            ? new Date(req.query.lastSyncedAt)
            : undefined;
        const status = await syncService.getSyncStatus(new ObjectId(req.user.id), deviceId, lastSyncedAt);
        res.json({
            success: true,
            data: status,
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: {
                code: 'SYNC_STATUS_ERROR',
                message: error instanceof Error ? error.message : 'Error fetching sync status',
            },
        });
    }
}));
export default router;
//# sourceMappingURL=syncRoutes.js.map