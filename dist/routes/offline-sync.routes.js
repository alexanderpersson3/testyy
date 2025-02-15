;
import { ObjectId } from 'mongodb';
;
import { z } from 'zod';
import { OfflineSyncService, SyncOperation } from '../services/offline-sync.service.js';
import { authenticate } from '../middleware/auth.js';
const router = Router();
const syncService = OfflineSyncService.getInstance();
// Record operation schema
const recordOperationSchema = z.object({
    deviceId: z.string(),
    type: z.enum(['create', 'update', 'delete']),
    collection: z.string(),
    documentId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    changes: z.record(z.any()),
});
// Record sync operation
router.post('/operations', authenticate, validateRequest(recordOperationSchema), async (req, res) => {
    try {
        const operation = await syncService.recordOperation({
            userId: new ObjectId(req.user.id),
            deviceId: req.body.deviceId,
            type: req.body.type,
            collection: req.body.collection,
            documentId: new ObjectId(req.body.documentId),
            changes: req.body.changes,
        });
        res.status(201).json(operation);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to record sync operation' });
    }
});
// Get pending operations schema
const getPendingOperationsSchema = z.object({
    deviceId: z.string(),
});
// Get pending operations
router.get('/operations/pending', authenticate, validateRequest(getPendingOperationsSchema, 'query'), async (req, res) => {
    try {
        const operations = await syncService.getPendingOperations(new ObjectId(req.user.id), req.query.deviceId);
        res.json(operations);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get pending operations' });
    }
});
// Get sync state schema
const getSyncStateSchema = z.object({
    deviceId: z.string(),
});
// Get sync state
router.get('/state', authenticate, validateRequest(getSyncStateSchema, 'query'), async (req, res) => {
    try {
        const state = await syncService.getSyncState(new ObjectId(req.user.id), req.query.deviceId);
        if (!state) {
            return res.status(404).json({ error: 'Sync state not found' });
        }
        res.json(state);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get sync state' });
    }
});
// Update sync state schema
const updateSyncStateSchema = z.object({
    deviceId: z.string(),
    collections: z.record(z.object({
        version: z.number().int().min(0),
    })),
});
// Update sync state
router.patch('/state', authenticate, validateRequest(updateSyncStateSchema), async (req, res) => {
    try {
        const state = await syncService.updateSyncState(new ObjectId(req.user.id), req.body.deviceId, req.body.collections);
        res.json(state);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update sync state' });
    }
});
// Sync changes schema
const syncChangesSchema = z.object({
    deviceId: z.string(),
    operations: z.array(z.object({
        _id: z.string().regex(/^[0-9a-fA-F]{24}$/),
        type: z.enum(['create', 'update', 'delete']),
        collection: z.string(),
        documentId: z.string().regex(/^[0-9a-fA-F]{24}$/),
        changes: z.record(z.any()),
        status: z.enum(['pending', 'completed', 'failed']),
        timestamp: z.string().datetime(),
    })),
});
// Sync changes
router.post('/sync', authenticate, validateRequest(syncChangesSchema), async (req, res) => {
    try {
        const operations = req.body.operations.map((op) => ({
            ...op,
            _id: new ObjectId(op._id),
            documentId: new ObjectId(op.documentId),
            timestamp: new Date(op.timestamp),
        }));
        const result = await syncService.syncChanges(new ObjectId(req.user.id), req.body.deviceId, operations);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to sync changes' });
    }
});
// Get changes since last sync schema
const getChangesSchema = z.object({
    deviceId: z.string(),
    collections: z.array(z.string()),
});
// Get changes since last sync
router.get('/changes', authenticate, validateRequest(getChangesSchema, 'query'), async (req, res) => {
    try {
        const changes = await syncService.getChangesSinceLastSync(new ObjectId(req.user.id), req.query.deviceId, req.query.collections);
        res.json(changes);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get changes' });
    }
});
export default router;
//# sourceMappingURL=offline-sync.routes.js.map