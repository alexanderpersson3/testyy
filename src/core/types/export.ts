import { ObjectId } from 'mongodb';;;;
import type { Recipe } from '../types/express.js';
import { NotificationChannel } from '../index.js';;

export type ExportFormat = 'pdf' | 'json' | 'csv';
export type ImportFormat = 'json' | 'csv' | 'mealplanner' | 'cookmate' | 'paprika';

export interface ExportOptions {
  includeImages: boolean;
  includeNotes: boolean;
  includeTags: boolean;
  pdfTemplate?: string;
  pageSize?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  language?: string;
}

export interface ImportOptions {
  skipDuplicates?: boolean;
  updateExisting?: boolean;
  matchBy?: ('title' | 'url' | 'externalId')[];
  assignToCollection?: ObjectId;
  defaultPrivacy?: 'public' | 'private';
  defaultTags?: string[];
}

export interface ExportJob {
  _id: ObjectId;
  userId: ObjectId;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: ExportFormat;
  options: ExportOptions;
  recipeIds: ObjectId[];
  collectionIds?: ObjectId[];
  progress: number;
  resultUrl?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportJob {
  _id: ObjectId;
  userId: ObjectId;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: ImportFormat;
  options: ImportOptions;
  fileKey: string;
  sourceUrl?: string;
  stats?: {
    total: number;
    imported: number;
    skipped: number;
    failed: number;
    updated: number;
  };
  error?: string;
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipeParseResult {
  success: boolean;
  recipe?: Partial<Recipe>;
  error?: string;
  warnings?: string[];
  confidence: number;
  format?: string;
  metadata?: {
    source?: string;
    importedFrom?: string;
    originalUrl?: string;
    lastModified?: Date;
  };
}

export interface ExportTemplate {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  description?: string;
  format: ExportFormat;
  options: ExportOptions;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportMapping {
  _id: ObjectId;
  name: string;
  description?: string;
  format: ImportFormat;
  fieldMappings: {
    [key: string]: {
      targetField: string;
      transform?: string;
      defaultValue?: any;
    };
  };
  isDefault?: boolean;
  isPublic?: boolean;
  userId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportResult {
  url: string;
  format: ExportFormat;
  size: number;
  expiresAt: Date;
  metadata: {
    pageCount: number;
    template?: string;
  };
}

export interface ImportResult {
  recipes: Recipe[];
  stats: {
    total: number;
    imported: number;
    skipped: number;
    failed: number;
    updated: number;
  };
  errors?: Array<{
    index: number;
    error: string;
    data?: any;
  }>;
  warnings?: Array<{
    index: number;
    warning: string;
    data?: any;
  }>;
}

export interface FormatDetectionResult {
  format?: ImportFormat;
  confidence: number;
  possibleFormats: Array<{
    format: ImportFormat;
    confidence: number;
  }>;
  metadata?: {
    version?: string;
    generator?: string;
    timestamp?: Date;
  };
}

export interface ExportNotification {
  userId: ObjectId;
  type: 'export_completed' | 'export_failed';
  title: string;
  message: string;
  data: {
    jobId: ObjectId;
  };
  channels: NotificationChannel[];
}
