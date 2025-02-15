import { ObjectId } from 'mongodb';

// Base document type for all MongoDB documents
export interface BaseDocument {
  _id: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Generic type for creating new documents
export type CreateDocument<T> = Omit<T, keyof BaseDocument>;

// Generic type for updating documents
export type UpdateDocument<T> = Partial<Omit<T, keyof BaseDocument>>;

// Generic type for documents with optional ID
export type WithOptionalId<T> = Omit<T, '_id'> & { _id?: ObjectId };

// Generic type for documents with required ID
export type WithId<T> = T & { _id: ObjectId };

// MongoDB operation types
export interface MongoTimestamps {
  createdAt: Date;
  updatedAt: Date;
}

// Common response types
export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  skip?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Common utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type RequireAtLeastOne<T> = { [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>> }[keyof T];
export type RequireOnlyOne<T> = { [K in keyof T]-?: Required<Pick<T, K>> & Omit<Partial<T>, K> }[keyof T]; 