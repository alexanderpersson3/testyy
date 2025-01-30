import { Collection, ObjectId } from 'mongodb';
import { SyncBatch, SyncItem, QueueItem, SyncConflict as SyncConflictType, ConflictResolution, SyncStatus } from '../types/sync';

interface SyncConflict {
  type: 'conflict';
  message: string;
  item: any;
}

interface SyncResult {
  success: boolean;
  conflicts?: SyncConflict[];
  newVersion?: number;
}

export class SyncService {
  constructor(
    private collection: Collection,
    private versionField: string = 'version'
  ) {}

  async sync(batch: SyncBatch): Promise<SyncResult> {
    try {
      // Check for conflicts
      const conflicts = await this.checkConflicts(batch);
      if (conflicts.length > 0) {
        return {
          success: false,
          conflicts
        };
      }

      // Apply changes
      for (const item of batch.items) {
        if (item.deleted) {
          await this.collection.deleteOne({ _id: new ObjectId(item.id) });
        } else if (item.data) {
          const update = {
            ...item.data,
            [this.versionField]: item.version
          };
          await this.collection.updateOne(
            { _id: new ObjectId(item.id) },
            { $set: update },
            { upsert: true }
          );
        }
      }

      const newVersion = Math.max(...batch.items.map(item => item.version)) + 1;
      return {
        success: true,
        newVersion
      };
    } catch (error) {
      console.error('Sync error:', error);
      return {
        success: false,
        conflicts: [{
          type: 'conflict',
          message: error instanceof Error ? error.message : 'Unknown error',
          item: null
        }]
      };
    }
  }

  async queueSync(userId: ObjectId, items: Omit<QueueItem, '_id' | 'status' | 'createdAt' | 'updatedAt'>[]): Promise<SyncBatch> {
    const now = new Date();
    const batch: SyncBatch = {
      userId,
      items: items.map(item => ({
        ...item,
        version: item.version || 1
      })),
      status: 'pending',
      clientId: items[0]?.clientId || '',
      timestamp: now,
      conflicts: [],
      createdAt: now,
      updatedAt: now
    };

    await this.collection.insertOne(batch);
    return batch;
  }

  async processBatch(batchId: ObjectId): Promise<SyncResult> {
    const batch = await this.collection.findOne({ _id: batchId }) as SyncBatch;
    if (!batch) {
      throw new Error('Batch not found');
    }

    return this.sync(batch);
  }

  async getConflicts(userId: ObjectId): Promise<SyncConflictType[]> {
    const conflicts = await this.collection.find({
      userId,
      'conflicts.status': 'conflict'
    }).toArray() as SyncConflictType[];

    return conflicts;
  }

  async resolveConflict(
    conflictId: ObjectId,
    resolution: ConflictResolution,
    manualData?: any
  ): Promise<void> {
    const now = new Date();
    await this.collection.updateOne(
      { _id: conflictId },
      {
        $set: {
          resolution,
          resolvedData: manualData,
          resolvedAt: now,
          updatedAt: now
        }
      }
    );
  }

  async getSyncStatus(
    userId: ObjectId,
    deviceId: string,
    lastSyncedAt?: Date
  ): Promise<{
    pendingChanges: number;
    conflicts: number;
    lastSyncedAt: Date | null;
  }> {
    const query: any = { userId, deviceId };
    if (lastSyncedAt) {
      query.updatedAt = { $gt: lastSyncedAt };
    }

    const [pendingChanges, conflicts] = await Promise.all([
      this.collection.countDocuments({
        ...query,
        status: 'pending'
      }),
      this.collection.countDocuments({
        ...query,
        'conflicts.status': 'conflict'
      })
    ]);

    const lastSync = await this.collection
      .find({ userId, deviceId, status: 'completed' })
      .sort({ completedAt: -1 })
      .limit(1)
      .toArray();

    return {
      pendingChanges,
      conflicts,
      lastSyncedAt: lastSync[0]?.completedAt || null
    };
  }

  private async checkConflicts(batch: SyncBatch): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = [];

    for (const item of batch.items) {
      const existing = await this.collection.findOne({
        _id: new ObjectId(item.id)
      });

      if (existing) {
        const currentVersion = existing[this.versionField] || 0;
        if (currentVersion > item.version) {
          conflicts.push({
            type: 'conflict',
            message: `Version conflict: server version ${currentVersion} > client version ${item.version}`,
            item: existing
          });
        }
      }
    }

    return conflicts;
  }
} 