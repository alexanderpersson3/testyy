import { Router, Response } from 'express';
import { ObjectId } from 'mongodb';
import { AuthenticatedRequest } from '../types/auth';
import { auth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { SyncService } from '../services/syncService';
import { connectToDatabase } from '../db/connection';
import { SyncBatch, SyncItem, SyncStatus } from '../types/sync';
import {
  queueSyncSchema,
  processBatchSchema,
  resolveConflictSchema,
  syncStatusQuerySchema,
  QueueSync,
  ProcessBatch,
  ResolveConflict,
  SyncStatusQuery,
  SyncQueueItem
} from '../schemas/syncSchemas';

const router = Router();

// Sync routes
router.post(
  '/sync',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    const db = await connectToDatabase();
    const collection = db.collection('syncData');
    const syncService = new SyncService(collection);

    const batch: SyncBatch = {
      items: req.body.items.map((item: any): SyncItem => ({
        id: item.id,
        version: item.version,
        deleted: item.deleted,
        data: item.data
      })),
      clientId: req.body.clientId,
      timestamp: new Date(req.body.timestamp),
      userId: new ObjectId(req.user.id),
      status: 'pending' as SyncStatus
    };

    const result = await syncService.sync(batch);
    res.json(result);
  })
);

// Queue changes for sync
router.post(
  '/queue',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const { items } = req.body;
      
      const db = await connectToDatabase();
      const collection = db.collection('syncData');
      const syncService = new SyncService(collection);
      const batch = await syncService.queueSync(new ObjectId(req.user.id), items);
      
      res.status(201).json({
        success: true,
        data: batch
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SYNC_DATA',
          message: error instanceof Error ? error.message : 'Invalid sync data'
        }
      });
    }
  })
);

// Process sync batch
router.post(
  '/process/:batchId',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const batchId = new ObjectId(req.params.batchId);
      const db = await connectToDatabase();
      const collection = db.collection('syncData');
      const syncService = new SyncService(collection);
      const result = await syncService.processBatch(batchId);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'SYNC_PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Error processing sync batch'
        }
      });
    }
  })
);

// Get sync conflicts
router.get(
  '/conflicts',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const db = await connectToDatabase();
      const collection = db.collection('syncData');
      const syncService = new SyncService(collection);
      const conflicts = await syncService.getConflicts(new ObjectId(req.user.id));
      
      res.json({
        success: true,
        data: conflicts
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'CONFLICT_FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Error fetching conflicts'
        }
      });
    }
  })
);

// Resolve sync conflict
router.post(
  '/conflicts/:conflictId/resolve',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const conflictId = new ObjectId(req.params.conflictId);
      const { resolution, manualData } = req.body;

      const db = await connectToDatabase();
      const collection = db.collection('syncData');
      const syncService = new SyncService(collection);
      await syncService.resolveConflict(conflictId, resolution, manualData);
      
      res.json({
        success: true
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CONFLICT_RESOLUTION_ERROR',
          message: error instanceof Error ? error.message : 'Error resolving conflict'
        }
      });
    }
  })
);

// Get sync status
router.get(
  '/status',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const deviceId = req.query.deviceId as string;
      const lastSyncedAt = req.query.lastSyncedAt ? new Date(req.query.lastSyncedAt as string) : undefined;

      const db = await connectToDatabase();
      const collection = db.collection('syncData');
      const syncService = new SyncService(collection);
      const status = await syncService.getSyncStatus(new ObjectId(req.user.id), deviceId, lastSyncedAt);
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'SYNC_STATUS_ERROR',
          message: error instanceof Error ? error.message : 'Error fetching sync status'
        }
      });
    }
  })
);

export default router; 