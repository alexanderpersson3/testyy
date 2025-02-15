import { ObjectId } from 'mongodb';;;;
import { connectToDatabase } from '../db.js';;
import logger from '../utils/logger.js';

export interface SyncOperation {
  _id?: ObjectId;
  userId: ObjectId;
  deviceId: string;
  type: 'create' | 'update' | 'delete';
  collection: string;
  documentId: ObjectId;
  changes: Record<string, any>;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
  timestamp: Date;
  syncedAt?: Date;
}

export interface SyncState {
  _id?: ObjectId;
  userId: ObjectId;
  deviceId: string;
  lastSyncTimestamp: Date;
  collections: Record<
    string,
    {
      lastSyncTimestamp: Date;
      version: number;
    }
  >;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncResult {
  success: boolean;
  operations: {
    total: number;
    completed: number;
    failed: number;
  };
  errors?: Array<{
    operation: SyncOperation;
    error: string;
  }>;
  timestamp: Date;
}

export class OfflineSyncService {
  private static instance: OfflineSyncService;

  private constructor() {}

  static getInstance(): OfflineSyncService {
    if (!OfflineSyncService.instance) {
      OfflineSyncService.instance = new OfflineSyncService();
    }
    return OfflineSyncService.instance;
  }

  /**
   * Record sync operation
   */
  async recordOperation(
    operation: Omit<SyncOperation, '_id' | 'status' | 'timestamp'>
  ): Promise<SyncOperation> {
    const db = await connectToDatabase();

    const now = new Date();
    const newOperation: SyncOperation = {
      ...operation,
      status: 'pending',
      timestamp: now,
    };

    const result = await db.collection<SyncOperation>('sync_operations').insertOne(newOperation);
    return {
      ...newOperation,
      _id: result.insertedId,
    };
  }

  /**
   * Get pending operations
   */
  async getPendingOperations(userId: ObjectId, deviceId: string): Promise<SyncOperation[]> {
    const db = await connectToDatabase();

    return db
      .collection<SyncOperation>('sync_operations')
      .find({
        userId,
        deviceId,
        status: 'pending',
      })
      .sort({ timestamp: 1 })
      .toArray();
  }

  /**
   * Get sync state
   */
  async getSyncState(userId: ObjectId, deviceId: string): Promise<SyncState | null> {
    const db = await connectToDatabase();

    return db.collection<SyncState>('sync_states').findOne({
      userId,
      deviceId,
    });
  }

  /**
   * Update sync state
   */
  async updateSyncState(
    userId: ObjectId,
    deviceId: string,
    collections: Record<string, { version: number }>
  ): Promise<SyncState> {
    const db = await connectToDatabase();
    const now = new Date();

    const defaultState: SyncState = {
      userId,
      deviceId,
      lastSyncTimestamp: now,
      collections: {},
      createdAt: now,
      updatedAt: now,
    };

    // Convert collections to the correct format
    const syncCollections: Record<string, { lastSyncTimestamp: Date; version: number }> = {};
    for (const [collection, { version }] of Object.entries(collections)) {
      syncCollections[collection] = {
        lastSyncTimestamp: now,
        version,
      };
    }

    const updates = {
      lastSyncTimestamp: now,
      collections: syncCollections,
      updatedAt: now,
    };

    const result = await db.collection<SyncState>('sync_states').findOneAndUpdate(
      { userId, deviceId },
      {
        $set: updates,
        $setOnInsert: defaultState,
      },
      {
        returnDocument: 'after',
        upsert: true,
      }
    );

    if (!result.value) {
      throw new Error('Failed to update sync state');
    }

    return result.value;
  }

  /**
   * Sync changes
   */
  async syncChanges(
    userId: ObjectId,
    deviceId: string,
    operations: SyncOperation[]
  ): Promise<SyncResult> {
    const db = await connectToDatabase();

    const result: SyncResult = {
      success: true,
      operations: {
        total: operations.length,
        completed: 0,
        failed: 0,
      },
      timestamp: new Date(),
    };

    const errors: Array<{ operation: SyncOperation; error: string }> = [];

    for (const operation of operations) {
      try {
        switch (operation.type) {
          case 'create':
            await this.handleCreate(operation);
            break;
          case 'update':
            await this.handleUpdate(operation);
            break;
          case 'delete':
            await this.handleDelete(operation);
            break;
        }

        // Mark operation as completed
        await db.collection<SyncOperation>('sync_operations').updateOne(
          { _id: operation._id },
          {
            $set: {
              status: 'completed',
              syncedAt: new Date(),
            },
          }
        );

        result.operations.completed++;
      } catch (error) {
        // Mark operation as failed
        await db.collection<SyncOperation>('sync_operations').updateOne(
          { _id: operation._id },
          {
            $set: {
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
              syncedAt: new Date(),
            },
          }
        );

        errors.push({
          operation,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.operations.failed++;
      }
    }

    if (errors.length > 0) {
      result.success = false;
      result.errors = errors;
    }

    // Update sync state
    await this.updateSyncState(userId, deviceId, {});

    return result;
  }

  /**
   * Handle create operation
   */
  private async handleCreate(operation: SyncOperation): Promise<void> {
    const db = await connectToDatabase();

    const document = {
      _id: operation.documentId,
      ...operation.changes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection(operation.collection).insertOne(document);
  }

  /**
   * Handle update operation
   */
  private async handleUpdate(operation: SyncOperation): Promise<void> {
    const db = await connectToDatabase();

    const updates = {
      ...operation.changes,
      updatedAt: new Date(),
    };

    const result = await db
      .collection(operation.collection)
      .updateOne({ _id: operation.documentId }, { $set: updates });

    if (result.matchedCount === 0) {
      throw new Error('Document not found');
    }
  }

  /**
   * Handle delete operation
   */
  private async handleDelete(operation: SyncOperation): Promise<void> {
    const db = await connectToDatabase();

    const result = await db.collection(operation.collection).deleteOne({
      _id: operation.documentId,
    });

    if (result.deletedCount === 0) {
      throw new Error('Document not found');
    }
  }

  /**
   * Get changes since last sync
   */
  async getChangesSinceLastSync(
    userId: ObjectId,
    deviceId: string,
    collections: string[]
  ): Promise<Record<string, any[]>> {
    const db = await connectToDatabase();

    const syncState = await this.getSyncState(userId, deviceId);
    const changes: Record<string, any[]> = {};

    for (const collection of collections) {
      const lastSync = syncState?.collections[collection]?.lastSyncTimestamp || new Date(0);

      changes[collection] = await db
        .collection(collection)
        .find({
          $or: [{ updatedAt: { $gt: lastSync } }, { createdAt: { $gt: lastSync } }],
        })
        .toArray();
    }

    return changes;
  }
}
