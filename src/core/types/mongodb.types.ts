import type { 
  Collection,
  Document,
  Filter,
  UpdateFilter,
  FindOptions,
  InsertOneOptions,
  UpdateOptions,
  DeleteOptions,
  AggregateOptions,
  IndexSpecification,
  BulkWriteOptions,
  OptionalUnlessRequiredId,
  AnyBulkWriteOperation,
  WithId
} from 'mongodb';
import { ObjectId } from 'mongodb';

/**
 * Base MongoDB document type
 */
export interface MongoDocument {
  _id: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Type for creating a new document
 */
export type CreateDocument<T extends MongoDocument> = Omit<T, '_id' | 'createdAt' | 'updatedAt'>;

/**
 * Type for updating an existing document
 */
export type UpdateDocument<T extends MongoDocument> = Partial<Omit<T, '_id' | 'createdAt' | 'updatedAt'>>;

/**
 * MongoDB operation options with defaults
 */
export interface MongoOperationOptions {
  session?: unknown;
  bypassDocumentValidation?: boolean;
  writeConcern?: {
    w?: number | 'majority';
    j?: boolean;
    wtimeout?: number;
  };
}

/**
 * MongoDB find options with pagination
 */
export interface MongoPaginationOptions extends FindOptions {
  page?: number;
  limit?: number;
  sort?: { [key: string]: 1 | -1 };
}

/**
 * MongoDB aggregation options with type safety
 */
export interface MongoAggregationOptions extends AggregateOptions {
  explain?: boolean;
  allowDiskUse?: boolean;
  maxTimeMS?: number;
  bypassDocumentValidation?: boolean;
  collation?: {
    locale: string;
    caseLevel?: boolean;
    caseFirst?: string;
    strength?: number;
    numericOrdering?: boolean;
    alternate?: string;
    maxVariable?: string;
    backwards?: boolean;
  };
}

/**
 * MongoDB bulk write operation with type safety
 */
export interface MongoBulkOperation<T extends MongoDocument> {
  insertOne?: {
    document: OptionalUnlessRequiredId<T>;
  };
  updateOne?: {
    filter: Filter<T>;
    update: UpdateFilter<T>;
    upsert?: boolean;
  };
  updateMany?: {
    filter: Filter<T>;
    update: UpdateFilter<T>;
    upsert?: boolean;
  };
  deleteOne?: {
    filter: Filter<T>;
  };
  deleteMany?: {
    filter: Filter<T>;
  };
  replaceOne?: {
    filter: Filter<T>;
    replacement: OptionalUnlessRequiredId<T>;
    upsert?: boolean;
  };
}

/**
 * MongoDB bulk write result with type safety
 */
export interface MongoBulkWriteResult {
  ok: number;
  writeErrors: any[];
  writeConcernErrors: any[];
  insertedIds: { [key: number]: ObjectId };
  nInserted: number;
  nUpserted: number;
  nMatched: number;
  nModified: number;
  nRemoved: number;
  upserted: { index: number; _id: ObjectId }[];
}

/**
 * MongoDB collection with enhanced type safety
 */
export interface TypedCollection<T extends MongoDocument> extends Omit<Collection<T>, 'findOne'> {
  findById(id: ObjectId | string): Promise<T | null>;
  findByIdAndUpdate(id: ObjectId | string, update: UpdateFilter<T>, options?: UpdateOptions): Promise<T | null>;
  findByIdAndDelete(id: ObjectId | string, options?: DeleteOptions): Promise<boolean>;
  findOne(filter: Filter<T>, options?: FindOptions): Promise<T | null>;
  paginate(filter: Filter<T>, options?: MongoPaginationOptions): Promise<{
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
}

/**
 * MongoDB index options with type safety
 */
export interface MongoIndexOptions extends Omit<IndexSpecification, 'key'> {
  key: { [key: string]: 1 | -1 | 'text' | '2dsphere' };
  unique?: boolean;
  sparse?: boolean;
  background?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: object;
}

/**
 * Type guard to check if a value is a MongoDB ObjectId
 */
export function isObjectId(value: unknown): value is ObjectId {
  return value instanceof ObjectId;
}

/**
 * Type guard to check if a value is a MongoDB document
 */
export function isMongoDocument(value: unknown): value is MongoDocument {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_id' in value &&
    isObjectId((value as any)._id) &&
    'createdAt' in value &&
    value.createdAt instanceof Date &&
    'updatedAt' in value &&
    value.updatedAt instanceof Date
  );
}

/**
 * Helper to create a MongoDB filter with type safety
 */
export function createFilter<T extends MongoDocument>(
  filter: Partial<T> | Filter<T>
): Filter<T> {
  return filter as Filter<T>;
}

/**
 * Helper to create a MongoDB update with type safety
 */
export function createUpdate<T extends MongoDocument>(
  update: Partial<T> | UpdateFilter<T>
): UpdateFilter<T> {
  if (!('$set' in update) && !('$unset' in update)) {
    return { $set: { ...update, updatedAt: new Date() } };
  }
  return update as UpdateFilter<T>;
} 