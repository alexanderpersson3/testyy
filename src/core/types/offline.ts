import type { Recipe } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
import type { BaseDocument } from '../types/express.js';

/**
 * Offline sync status
 */
export type SyncStatus = 'pending' | 'synced' | 'conflict' | 'error';

/**
 * Offline recipe
 */
export interface OfflineRecipe extends BaseDocument {
  userId: ObjectId;
  recipe: {
    id: string;
    name: string;
    description: string;
    ingredients: Array<{
      product: string;
      quantity: number;
      createdAt: Date;
  updatedAt: Date;
}>;
    instructions: string[];
    servings: number;
    prepTime: number;
    cookTime: number;
    totalTime: number;
    difficulty: 'easy' | 'medium' | 'hard';
    cuisine: string;
    tags: string[];
    images: string[];
    nutrition: Record<string, number>;
  };
  attachments: Array<{
    type: string;
    localPath: string;
    originalUrl: string;
    size: number;
    mimeType: string;
  }>;
  notes: Array<{
    text: string;
    timestamp: Date;
  }>;
  lastAccessed: Date;
  lastModified: Date;
  syncStatus: SyncStatus;
  syncTimestamp: Date;
  version: number;
}

/**
 * Offline storage settings
 */
export interface OfflineSettings {
  maxStorageSize: number; // in bytes
  maxRecipes: number;
  autoSync: boolean;
  syncInterval: number; // in minutes
  keepFavorites: boolean;
  keepRecent: boolean;
  mediaQuality: 'low' | 'medium' | 'high';
  downloadAttachments: boolean;
  retryAttempts: number;
  conflictResolution: 'manual' | 'auto';
}

/**
 * Offline storage stats
 */
export interface OfflineStats {
  totalSize: number; // in bytes
  recipeCount: number;
  attachmentSize: number; // in bytes
  lastSync: Date;
  syncErrors: number;
  pendingChanges: number;
  storageUsage: {
    recipes: number; // in bytes
    attachments: number; // in bytes
    notes: number; // in bytes
    other: number; // in bytes
  };
}

/**
 * Sync operation
 */
export interface SyncOperation extends BaseDocument {
  userId: ObjectId;
  type: 'upload' | 'download' | 'delete';
  recipeId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  retryCount: number;
  changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    createdAt: Date;
  updatedAt: Date;
}>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  timestamp: Date;
}

/**
 * Sync conflict
 */
export interface SyncConflict {
  recipeId: string;
  localVersion: number;
  remoteVersion: number;
  changes: Array<{
    field: string;
    localValue: any;
    remoteValue: any;
  }>;
  resolution?: 'local' | 'remote' | 'merge';
}

/**
 * Download request
 */
export interface DownloadRequest {
  recipeIds: string[];
  includeAttachments?: boolean;
  quality?: 'low' | 'medium' | 'high';
}

/**
 * Download result
 */
export interface DownloadResult {
  successful: string[];
  failed: Array<{
    recipeId: string;
    error: string;
  }>;
  totalSize: number; // in bytes
  duration: number; // in milliseconds
}

/**
 * Storage cleanup options
 */
export interface CleanupOptions {
  olderThan?: Date;
  excludeFavorites?: boolean;
  dryRun?: boolean;
}

/**
 * Cleanup result
 */
export interface CleanupResult {
  removedRecipes: string[];
  removedAttachments: string[];
  spaceFreed: number; // in bytes
  dryRun: boolean;
}

/**
 * Offline error
 */
export interface OfflineError extends BaseDocument {
  code: string;
  message: string;
  details: Record<string, any>;
  recipeId?: string;
  timestamp: Date;
  stack?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Offline data
 */
export interface OfflineData extends BaseDocument {
  userId: ObjectId;
  type: 'recipe' | 'collection' | 'list';
  dataId: ObjectId;
  data: any;
  version: number;
  size: number;
  lastModified: Date;
  lastSynced: Date;
  lastAccessed: Date;
  status: 'synced' | 'pending' | 'conflict';
  metadata: {
    originalSource: string;
    compressionType?: string;
    checksum?: string;
    createdAt: Date;
  updatedAt: Date;
};
}

/**
 * Offline event
 */
export interface OfflineEvent extends BaseDocument {
  userId: ObjectId;
  type: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}
