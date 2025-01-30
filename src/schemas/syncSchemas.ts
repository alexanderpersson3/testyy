import { z } from 'zod';
import { ObjectId } from 'mongodb';

// Helper function to validate ObjectId
const objectIdSchema = z.string().refine(
  (val) => {
    try {
      new ObjectId(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid ObjectId format' }
);

// Base schemas for common types
export const syncOperationSchema = z.enum(['create', 'update', 'delete']);
export const entityTypeSchema = z.enum(['recipe', 'review', 'collection']);
export const syncStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export const resolutionSchema = z.enum(['client_wins', 'server_wins', 'manual_merge']);

// Schema for individual sync items
export const syncItemSchema = z.object({
  entityId: z.string(),
  entityType: entityTypeSchema,
  operation: syncOperationSchema,
  data: z.record(z.any()),
  clientTimestamp: z.string(),
  deviceId: z.string(),
  version: z.number()
});

// Schema for queuing sync batch
export const queueSyncSchema = z.object({
  items: z.array(syncItemSchema)
});

// Schema for processing sync batch
export const processBatchSchema = z.object({
  batchId: z.string()
});

// Schema for resolving conflicts
export const resolveConflictSchema = z.object({
  conflictId: z.string(),
  resolution: resolutionSchema,
  manualData: z.record(z.any()).optional()
});

// Schema for sync status query
export const syncStatusQuerySchema = z.object({
  deviceId: z.string(),
  lastSyncedAt: z.string().optional()
});

// Schema for sync metadata
export const syncMetadataSchema = z.object({
  lastSyncedAt: z.string(),
  deviceId: z.string(),
  version: z.number()
});

// Response schemas
export const syncResultSchema = z.object({
  success: z.boolean(),
  processedItems: z.number().int().nonnegative(),
  failedItems: z.number().int().nonnegative(),
  conflicts: z.array(z.object({
    conflictId: z.string(),
    resolution: resolutionSchema,
    manualData: z.record(z.any()).optional()
  })),
  newVersion: z.number().int().positive()
});

export const syncConflictSchema = z.object({
  _id: objectIdSchema.optional(),
  queueItemId: objectIdSchema,
  clientVersion: z.object({
    data: z.record(z.any()),
    timestamp: z.date(),
    version: z.number().int().positive()
  }),
  serverVersion: z.object({
    data: z.record(z.any()),
    timestamp: z.date(),
    version: z.number().int().positive()
  }),
  resolution: resolutionSchema.optional(),
  resolvedData: z.record(z.any()).optional(),
  resolvedAt: z.date().optional(),
  createdAt: z.date()
});

// Inferred types
export type SyncOperation = z.infer<typeof syncOperationSchema>;
export type EntityType = z.infer<typeof entityTypeSchema>;
export type SyncStatus = z.infer<typeof syncStatusSchema>;
export type Resolution = z.infer<typeof resolutionSchema>;
export type SyncItem = z.infer<typeof syncItemSchema>;
export type QueueSync = z.infer<typeof queueSyncSchema>;
export type ProcessBatch = z.infer<typeof processBatchSchema>;
export type ResolveConflict = z.infer<typeof resolveConflictSchema>;
export type SyncStatusQuery = z.infer<typeof syncStatusQuerySchema>;
export type SyncMetadata = z.infer<typeof syncMetadataSchema>;

// Service types
export interface SyncQueueItem extends SyncItem {
  _id: string;
  userId: string;
  status: SyncStatus;
  retryCount: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncBatch {
  _id: string;
  userId: string;
  items: SyncQueueItem[];
  status: SyncStatus;
  processedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncConflictDocument {
  _id: string;
  userId: string;
  entityId: string;
  entityType: EntityType;
  clientData: Record<string, any>;
  serverData: Record<string, any>;
  clientTimestamp: Date;
  serverTimestamp: Date;
  resolution?: Resolution;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncResultDocument {
  success: boolean;
  processedItems: number;
  failedItems: number;
  conflicts: {
    conflictId: string;
    resolution: Resolution;
    manualData?: Record<string, any>;
  }[];
  newVersion: number;
} 
