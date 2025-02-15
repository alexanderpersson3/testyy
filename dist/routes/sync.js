;
import { ObjectId } from 'mongodb';
;
import { DatabaseService } from '../db/database.service.js';
import { SyncOperation, SyncStatus, SyncStats, SyncConflict } from '../types/sync.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import logger from '../utils/logger.js';
const router = Router();
const db = DatabaseService.getInstance();
// Get sync status
const getSyncStatus = async (req, res) => {
    try {
        const status = await db.getCollection('sync_operations')
            .aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ])
            .toArray();
        const stats = {
            pending: status.find(s => s._id === 'pending')?.count || 0,
            completed: status.find(s => s._id === 'completed')?.count || 0,
            failed: status.find(s => s._id === 'failed')?.count || 0,
            total: 0
        };
        stats.total = stats.pending + stats.completed + stats.failed;
        res.json(stats);
    }
    catch (error) {
        logger.error('Failed to get sync status:', error);
        res.status(500).json({ error: 'Failed to get sync status' });
    }
};
// Get sync queue
const getSyncQueue = async (req, res) => {
    try {
        const queue = await db.getCollection('sync_operations')
            .find({ status: 'pending' })
            .sort({ createdAt: 1 })
            .toArray();
        res.json({ queue });
    }
    catch (error) {
        logger.error('Failed to get sync queue:', error);
        res.status(500).json({ error: 'Failed to get sync queue' });
    }
};
// Process sync queue
const processSyncQueue = async (req, res) => {
    try {
        const queue = await db.getCollection('sync_operations')
            .find({ status: 'pending' })
            .sort({ createdAt: 1 })
            .limit(10)
            .toArray();
        // Process each operation
        await Promise.all(queue.map(async (operation) => {
            try {
                // Update operation status
                await db.getCollection('sync_operations').updateOne({ _id: operation._id }, {
                    $set: {
                        status: 'processing',
                        startedAt: new Date()
                    }
                });
                // Process operation based on type
                switch (operation.type) {
                    case 'create':
                        await db.getCollection(operation.collection).insertOne(operation.data);
                        break;
                    case 'update':
                        await db.getCollection(operation.collection).updateOne({ _id: operation.documentId }, { $set: operation.data });
                        break;
                    case 'delete':
                        await db.getCollection(operation.collection).deleteOne({ _id: operation.documentId });
                        break;
                }
                // Mark operation as completed
                await db.getCollection('sync_operations').updateOne({ _id: operation._id }, {
                    $set: {
                        status: 'completed',
                        completedAt: new Date()
                    }
                });
            }
            catch (error) {
                logger.error(`Failed to process sync operation ${operation._id}:`, error);
                // Mark operation as failed
                await db.getCollection('sync_operations').updateOne({ _id: operation._id }, {
                    $set: {
                        status: 'failed',
                        error: error instanceof Error ? error.message : 'Unknown error',
                        completedAt: new Date()
                    }
                });
            }
        }));
        res.json({ message: 'Sync queue processed' });
    }
    catch (error) {
        logger.error('Failed to process sync queue:', error);
        res.status(500).json({ error: 'Failed to process sync queue' });
    }
};
// Get sync conflicts
const getSyncConflicts = async (req, res) => {
    try {
        const conflicts = await db.getCollection('sync_conflicts')
            .find()
            .sort({ createdAt: -1 })
            .toArray();
        res.json({ conflicts });
    }
    catch (error) {
        logger.error('Failed to get sync conflicts:', error);
        res.status(500).json({ error: 'Failed to get sync conflicts' });
    }
};
// Resolve sync conflict
const resolveSyncConflict = async (req, res) => {
    try {
        const { resolution } = req.body;
        if (!resolution || !['client', 'server'].includes(resolution)) {
            throw new ValidationError('Invalid resolution. Must be "client" or "server"');
        }
        const conflict = await db.getCollection('sync_conflicts').findOne({
            _id: new ObjectId(req.params.id)
        });
        if (!conflict) {
            throw new NotFoundError('Conflict not found');
        }
        // Apply resolution
        const version = resolution === 'client' ? conflict.clientVersion : conflict.serverVersion;
        await db.getCollection(conflict.collection).updateOne({ _id: conflict.documentId }, { $set: version });
        // Mark conflict as resolved
        await db.getCollection('sync_conflicts').updateOne({ _id: conflict._id }, {
            $set: {
                status: 'resolved',
                resolution,
                resolvedAt: new Date(),
                updatedAt: new Date()
            }
        });
        res.json({ message: 'Conflict resolved' });
    }
    catch (error) {
        if (error instanceof ValidationError) {
            res.status(400).json({ error: error.message });
        }
        else if (error instanceof NotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else {
            logger.error('Failed to resolve conflict:', error);
            res.status(500).json({ error: 'Failed to resolve conflict' });
        }
    }
};
// Register routes
router.get('/status', rateLimitMiddleware.api(), asyncHandler(getSyncStatus));
router.get('/queue', rateLimitMiddleware.api(), asyncHandler(getSyncQueue));
router.post('/process', rateLimitMiddleware.api(), asyncHandler(processSyncQueue));
router.get('/conflicts', rateLimitMiddleware.api(), asyncHandler(getSyncConflicts));
router.post('/conflicts/:id/resolve', rateLimitMiddleware.api(), asyncHandler(resolveSyncConflict));
export default router;
//# sourceMappingURL=sync.js.map