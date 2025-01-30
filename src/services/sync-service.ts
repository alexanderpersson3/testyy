import { Collection, ObjectId } from 'mongodb';
import { getDb } from '../config/db';

export type SyncStatus = 'pending' | 'synced' | 'conflict' | 'error';
export type ConflictResolution = 'client' | 'server' | 'manual';

interface SyncItem {
  id: string;
  type: 'recipe' | 'shopping_list' | 'collection';
  data: any;
  version: number;
  lastModified: Date;
  clientId?: string;
}

interface SyncBatch {
  _id?: ObjectId;
  userId: ObjectId;
  deviceId: string;
  items: SyncItem[];
  status: SyncStatus;
  conflicts: Array<{
    itemId: string;
    type: string;
    clientVersion: number;
    serverVersion: number;
    resolution?: ConflictResolution;
    resolvedData?: any;
  }>;
  timestamp: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class SyncService {
  private collection!: Collection;
  private readonly versionField = 'version';
  private initialized = false;

  constructor() {
    this.initializeCollection().catch(error => {
      console.error('Failed to initialize sync service:', error);
    });
  }

  private async initializeCollection() {
    if (this.initialized) return;

    const db = await getDb();
    this.collection = db.collection('sync_batches');
    
    // Create indexes
    await this.collection.createIndex({ userId: 1, status: 1 });
    await this.collection.createIndex({ userId: 1, deviceId: 1, timestamp: -1 });
    await this.collection.createIndex({ 'items.id': 1 });

    this.initialized = true;
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initializeCollection();
    }
  }

  async queueSync(
    userId: ObjectId,
    deviceId: string,
    items: Omit<SyncItem, 'version'>[]
  ): Promise<SyncBatch> {
    const now = new Date();
    const batch: SyncBatch = {
      userId,
      deviceId,
      items: items.map(item => ({
        ...item,
        version: 1,
        lastModified: now
      })),
      status: 'pending',
      conflicts: [],
      timestamp: now,
      createdAt: now,
      updatedAt: now
    };

    await this.collection.insertOne(batch);
    return batch;
  }

  async processBatch(batchId: ObjectId): Promise<{
    success: boolean;
    conflicts?: Array<{
      itemId: string;
      type: string;
      message: string;
    }>;
  }> {
    const batch = await this.collection.findOne({ _id: batchId }) as SyncBatch;
    if (!batch) {
      throw new Error('Batch not found');
    }

    const conflicts = await this.checkConflicts(batch);
    if (conflicts.length > 0) {
      await this.collection.updateOne(
        { _id: batchId },
        {
          $set: {
            status: 'conflict',
            conflicts,
            updatedAt: new Date()
          }
        }
      );

      return {
        success: false,
        conflicts: conflicts.map(c => ({
          itemId: c.itemId,
          type: c.type,
          message: `Version conflict: server version ${c.serverVersion} > client version ${c.clientVersion}`
        }))
      };
    }

    // Apply changes if no conflicts
    const db = await getDb();
    for (const item of batch.items) {
      await db.collection(this.getCollectionName(item.type)).updateOne(
        { _id: new ObjectId(item.id) },
        {
          $set: {
            ...item.data,
            [this.versionField]: item.version,
            updatedAt: new Date()
          }
        }
      );
    }

    await this.collection.updateOne(
      { _id: batchId },
      {
        $set: {
          status: 'synced',
          completedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    return { success: true };
  }

  async resolveConflict(
    batchId: ObjectId,
    resolutions: Array<{
      itemId: string;
      resolution: ConflictResolution;
      manualData?: any;
    }>
  ): Promise<void> {
    const batch = await this.collection.findOne({ _id: batchId }) as SyncBatch;
    if (!batch || batch.status !== 'conflict') {
      throw new Error('Invalid batch or batch not in conflict state');
    }

    const db = await getDb();
    const now = new Date();

    for (const resolution of resolutions) {
      const item = batch.items.find(i => i.id === resolution.itemId);
      if (!item) continue;

      const data = resolution.resolution === 'client' ? item.data :
                  resolution.resolution === 'manual' ? resolution.manualData :
                  await this.getServerVersion(item.type, item.id);

      await db.collection(this.getCollectionName(item.type)).updateOne(
        { _id: new ObjectId(item.id) },
        {
          $set: {
            ...data,
            [this.versionField]: item.version + 1,
            updatedAt: now
          }
        }
      );
    }

    await this.collection.updateOne(
      { _id: batchId },
      {
        $set: {
          status: 'synced',
          completedAt: now,
          updatedAt: now
        }
      }
    );
  }

  private async checkConflicts(batch: SyncBatch): Promise<Array<{
    itemId: string;
    type: string;
    clientVersion: number;
    serverVersion: number;
  }>> {
    const conflicts = [];
    const db = await getDb();

    for (const item of batch.items) {
      const serverItem = await db.collection(this.getCollectionName(item.type))
        .findOne({ _id: new ObjectId(item.id) });

      if (serverItem) {
        const serverVersion = serverItem[this.versionField] || 1;
        if (serverVersion > item.version) {
          conflicts.push({
            itemId: item.id,
            type: item.type,
            clientVersion: item.version,
            serverVersion
          });
        }
      }
    }

    return conflicts;
  }

  private async getServerVersion(type: string, id: string): Promise<any> {
    const db = await getDb();
    return await db.collection(this.getCollectionName(type))
      .findOne({ _id: new ObjectId(id) });
  }

  private getCollectionName(type: string): string {
    switch (type) {
      case 'recipe': return 'recipes';
      case 'shopping_list': return 'shopping_lists';
      case 'collection': return 'collections';
      default: throw new Error(`Invalid sync item type: ${type}`);
    }
  }
} 
