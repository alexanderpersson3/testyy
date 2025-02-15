import type { Recipe } from '../types/express.js';
import { ObjectId } from 'mongodb';
import type { RecipeDocument } from '../types/express.js';
export type SyncOperationType = 'create' | 'update' | 'delete';
export type ConflictResolution = 'client_wins' | 'server_wins' | 'manual_merge';
export type SyncStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface SyncMetadata {
  lastSyncedAt: Date;
  deviceId: string;
  version: number;
}

// Base types for sync operations
export interface BaseSyncItem {
  id: string;
  version: number;
}

// Type for items in a sync batch
export interface SyncItem extends BaseSyncItem {
  deleted?: boolean;
  data?: Record<string, any>;
}

// Type for a sync batch from the client
export interface SyncBatch {
  _id?: ObjectId;
  items: SyncItem[];
  clientId: string;
  timestamp: Date;
  userId?: ObjectId;
  deviceId?: string;
  status?: SyncStatus;
  startedAt?: Date;
  completedAt?: Date;
  conflicts?: Array<{
    itemId: ObjectId;
    status: SyncStatus;
    resolution?: ConflictResolution;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}

// Type for items in the sync queue
export interface QueueItem extends BaseSyncItem {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  data?: Record<string, any>;
  deleted?: boolean;
  clientId: string;
}

// Type for a sync batch in the queue
export interface QueueBatch {
  items: QueueItem[];
  clientId: string;
  timestamp: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncOperation {
  _id: ObjectId;
  type: SyncOperationType;
  collection: string;
  documentId: ObjectId;
  data: Record<string, any>;
  status: SyncStatus;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncConflict {
  _id: ObjectId;
  collection: string;
  documentId: ObjectId;
  clientVersion: Record<string, any>;
  serverVersion: Record<string, any>;
  status: 'unresolved' | 'resolved';
  resolution?: 'client' | 'server';
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncStats {
  pending: number;
  completed: number;
  failed: number;
  total: number;
}

/**
 * Base interface for synchronization results
 */
export interface SyncResult {
  success: boolean;
  timestamp: Date;
  duration: number;
  errors: {
    itemId: ObjectId;
    error: string;
  }[];
}

/**
 * Interface for ingredient synchronization results
 */
export interface IngredientSyncResult extends SyncResult {
  totalIngredients: number;
  updatedIngredients: number;
  newIngredients: number;
}

/**
 * Interface for price synchronization results
 */
export interface PriceSyncResult extends SyncResult {
  totalRecipes: number;
  updatedPrices: number;
  priceAlerts: number;
}

/**
 * Interface for price alert results
 */
export interface PriceAlertResult {
  priceAlerts: number;
  errors: {
    itemId: ObjectId;
    error: string;
  }[];
}
