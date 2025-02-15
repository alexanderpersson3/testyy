import { ObjectId } from 'mongodb';
import type { 
  Document,
  Filter,
  UpdateFilter,
  FindOptions,
  InsertOneOptions,
  UpdateOptions,
  DeleteOptions,
  AggregateOptions,
  IndexSpecification,
  Collection,
  Filter as MongoFilterType
} from 'mongodb';

/**
 * TODO: Type System Improvements Needed
 * 
 * Current Issues:
 * 1. Bulk operation type compatibility with MongoDB's native types
 * 2. Document transformation type safety
 * 
 * These issues are tracked and will be addressed in a future update.
 */

/**
 * Base interface for all MongoDB documents in our application
 */
export interface BaseDocument extends Document {
    _id: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Type for documents as stored in MongoDB (with _id and timestamps)
 */
export type WithId<T extends BaseDocument> = T;

/**
 * Type for documents being inserted (without _id)
 */
export type CreateDocument<T extends BaseDocument> = Omit<T, '_id'>;

/**
 * Type for update operations
 */
export type UpdateDocument<T extends BaseDocument> = Partial<Omit<T, '_id' | 'createdAt' | 'updatedAt'>>;

/**
 * Type for MongoDB filters with proper typing
 * @example
 * ```typescript
 * // Basic filter
 * const filter: Filter<User> = {
 *   age: { $gt: 18 },
 *   roles: { $in: ['user', 'admin'] }
 * };
 * 
 * // Array operations
 * const arrayFilter: Filter<Post> = {
 *   tags: { $all: ['typescript', 'mongodb'] },
 *   comments: { $size: 5 }
 * };
 * 
 * // Text search
 * const textFilter: Filter<Article> = {
 *   $text: { 
 *     $search: 'mongodb typescript',
 *     $language: 'en',
 *     $caseSensitive: false
 *   }
 * };
 * ```
 */
export type Filter<T extends BaseDocument> = {
    [P in keyof T]?: 
        | T[P] 
        | { $in: T[P][] }
        | { $nin: T[P][] }
        | { $exists: boolean }
        | { $ne: T[P] }
        | { $gt: T[P] }
        | { $gte: T[P] }
        | { $lt: T[P] }
        | { $lte: T[P] }
        | { $regex: string, $options?: string }
        | { $elemMatch: T[P] extends Array<infer U> ? Partial<U> : never }
        | { $size: number }
        | { $all: T[P] extends Array<infer U> ? U[] : never }
        | { $not: Filter<T>[P] }
        | { $text: { $search: string, $language?: string, $caseSensitive?: boolean, $diacriticSensitive?: boolean } };
};

/**
 * Type for MongoDB sort operations with support for dot notation
 */
export type Sort<T extends BaseDocument> = {
    [P in keyof T | `${string & keyof T}.${string}`]?: 1 | -1;
};

/**
 * Type for MongoDB push operations
 */
export type PushOperator<T extends BaseDocument> = {
    [P in keyof T]?: T[P] extends Array<infer U> ? U | { $each: U[] } : never;
};

/**
 * Type for MongoDB pull operations
 */
export type PullOperator<T extends BaseDocument> = {
    [P in keyof T]?: T[P] extends Array<infer U> ? Partial<U> | { $in: U[] } : never;
};

/**
 * Type for update operations with timestamps
 * @example
 * ```typescript
 * // Basic update
 * const update: UpdateOperation<User> = {
 *   $set: { name: 'John', updatedAt: new Date() },
 *   $inc: { loginCount: 1 }
 * };
 * 
 * // Array updates
 * const arrayUpdate: UpdateOperation<Post> = {
 *   $push: { 
 *     comments: { 
 *       $each: [newComment],
 *       $position: 0,
 *       $slice: 10
 *     }
 *   }
 * };
 * 
 * // Field operations
 * const fieldUpdate: UpdateOperation<Document> = {
 *   $rename: { 'oldField': 'newField' },
 *   $unset: { 'temporaryField': '' }
 * };
 * ```
 */
export type UpdateOperation<T extends BaseDocument> = {
    $set?: UpdateDocument<T> & { updatedAt: Date };
    $push?: PushOperator<T>;
    $pull?: PullOperator<T>;
    $inc?: Partial<Record<keyof T, number>>;
    $unset?: { [P in keyof T]?: '' };
    $min?: Partial<T>;
    $max?: Partial<T>;
    $mul?: Partial<Record<keyof T, number>>;
    $rename?: { [key: string]: string };
    $currentDate?: { 
        [P in keyof T]?: true | { $type: 'date' | 'timestamp' } 
    };
};

/**
 * Type for bulk write operations
 * T must extend BaseDocument to ensure proper type safety with MongoDB operations
 */
export type BulkWriteOperation<T extends BaseDocument> = AnyBulkWriteOperation<T>;

/**
 * Type for MongoDB aggregation pipeline stages with improved type safety
 * @example
 * ```typescript
 * // Complex aggregation pipeline
 * const pipeline: AggregationStage<User>[] = [
 *   { 
 *     $match: { 
 *       age: { $gte: 18 },
 *       status: 'active'
 *     }
 *   },
 *   {
 *     $lookup: {
 *       from: 'posts',
 *       localField: '_id',
 *       foreignField: 'userId',
 *       as: 'posts',
 *       pipeline: [
 *         { $match: { status: 'published' } },
 *         { $sort: { createdAt: -1 } }
 *       ]
 *     }
 *   },
 *   {
 *     $group: {
 *       _id: '$country',
 *       totalUsers: { $sum: 1 },
 *       avgAge: { $avg: '$age' },
 *       names: { $push: '$name' }
 *     }
 *   },
 *   {
 *     $facet: {
 *       byAge: [
 *         { $match: { avgAge: { $gt: 25 } } }
 *       ],
 *       byCount: [
 *         { $match: { totalUsers: { $gt: 100 } } }
 *       ]
 *     }
 *   }
 * ];
 * ```
 */
export type AggregationStage<T extends BaseDocument> = {
    $match?: Filter<T>;
    $sort?: Sort<T>;
    $limit?: number;
    $skip?: number;
    $project?: {
        [P in keyof T | string]?: 
            | 0 
            | 1 
            | { $first: string } 
            | { $last: string } 
            | { $slice: [string, number] }
            | { $concat: string[] }
            | { $toLower: string }
            | { $toUpper: string }
            | { $substr: [string, number, number] };
    };
    $lookup?: {
        from: string;
        localField: keyof T | string;
        foreignField: string;
        as: string;
        pipeline?: AggregationStage<any>[];
        let?: Record<string, any>;  // Variables for pipeline
    };
    $group?: {
        _id: any;
        [key: string]: any | {
            $sum: number | { $cond: [any, number, number] };
            $avg?: string | number;
            $first?: string;
            $last?: string;
            $push?: any;
            $addToSet?: any;
            $max?: any;
            $min?: any;
            $stdDevPop?: any;  // Population standard deviation
            $stdDevSamp?: any;  // Sample standard deviation
        };
    };
    $unwind?: string | {
        path: string;
        preserveNullAndEmptyArrays?: boolean;
        includeArrayIndex?: string;
    };
    $facet?: {  // Multiple aggregation pipelines
        [key: string]: AggregationStage<T>[];
    };
    [key: string]: any;
};

/**
 * Type for pagination options with validation
 */
export interface PaginationOptions {
    page?: number;
    limit?: number;
    sort?: string | { [key: string]: 1 | -1 };
    order?: 'asc' | 'desc';
    fields?: string[];
}

/**
 * Type for paginated response with improved type safety
 */
export interface PaginatedResponse<T extends BaseDocument> {
    data: WithId<T>[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

/**
 * Helper type for MongoDB operation results
 * T must extend BaseDocument to ensure proper type safety
 */
export type MongoOperationResult<T extends BaseDocument> = T;

/**
 * Helper type for optional ID in documents
 * T must extend BaseDocument to ensure proper type safety
 */
export type WithOptionalId<T extends BaseDocument> = OptionalUnlessRequiredId<T>;

/**
 * Helper type for updating fields
 * T must extend BaseDocument to ensure proper type safety
 */
export type UpdateFields<T extends BaseDocument> = Partial<Omit<T, '_id' | 'createdAt' | 'updatedAt'>>;

/**
 * Helper type for push fields in updates
 * T must extend BaseDocument to ensure proper type safety
 */
export type PushFields<T extends BaseDocument> = {
    [P in keyof T]?: T[P] extends Array<infer U> ? U : never;
};

/**
 * Helper type for pull fields in updates
 * T must extend BaseDocument to ensure proper type safety
 */
export type PullFields<T extends BaseDocument> = {
    [P in keyof T]?: T[P] extends Array<infer U> ? Partial<U> : never;
};

/**
 * Helper type for MongoDB document transformations
 * T can be any type, will be wrapped with WithId if it extends BaseDocument
 */
export type TransformDocument<T> = T extends BaseDocument ? WithId<T> : T;

/**
 * Helper type for MongoDB modify results
 * T must extend BaseDocument to ensure proper type safety
 */
export type ModifyResult<T extends BaseDocument> = T | null;

/**
 * Helper type for non-null MongoDB modify results
 * T must extend BaseDocument to ensure proper type safety
 */
export type SafeModifyResult<T extends BaseDocument> = NonNullable<ModifyResult<T>>;

/**
 * Helper type for MongoDB insertable document
 * T must extend BaseDocument to ensure proper type safety
 */
export type InsertableDocument<T extends BaseDocument> = OptionalUnlessRequiredId<T> & {
    createdAt: Date;
    updatedAt: Date;
};

/**
 * Type for MongoDB array update operators
 */
export type ArrayUpdateOperators<T extends BaseDocument> = {
    $addToSet?: PushOperator<T>;  // Add unique elements
    $pop?: { [P in keyof T]?: 1 | -1 };  // Remove first or last element
    $pullAll?: PullOperator<T>;  // Remove all matching elements
    $push?: PushOperator<T> & {
        $position?: number;  // Insert position
        $slice?: number;  // Limit array size after push
        $sort?: 1 | -1 | Record<string, 1 | -1>;  // Sort array after push
    };
};

/**
 * Type guard to check if a value is a valid MongoDB Filter
 */
export function isValidFilter<T extends BaseDocument>(value: unknown): value is Filter<T> {
    if (!value || typeof value !== 'object') return false;
    
    // Check for common MongoDB operators
    const obj = value as Record<string, unknown>;
    for (const key in obj) {
        const val = obj[key];
        if (typeof val === 'object' && val !== null) {
            // Check for valid MongoDB operators
            const operators = Object.keys(val as object).filter((op): op is string => typeof op === 'string');
            const validOperators = ['$in', '$nin', '$exists', '$ne', '$gt', '$gte', '$lt', '$lte', 
                '$regex', '$elemMatch', '$size', '$all', '$not', '$text'];
            if (!operators.every(op => validOperators.includes(op))) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Type guard to check if a value is a valid MongoDB UpdateOperation
 */
export function isValidUpdate<T extends BaseDocument>(value: unknown): value is UpdateOperation<T> {
    if (!value || typeof value !== 'object') return false;
    
    const update = value as Record<string, unknown>;
    const validOperators = ['$set', '$push', '$pull', '$inc', '$unset', '$min', '$max', 
        '$mul', '$rename', '$currentDate'];
    
    // Check that all top-level keys are valid MongoDB update operators
    return Object.keys(update).every(key => validOperators.includes(key));
}

/**
 * Type guard to check if a value is a valid MongoDB AggregationStage
 */
export function isValidAggregationStage<T extends BaseDocument>(value: unknown): value is AggregationStage<T> {
    if (!value || typeof value !== 'object') return false;
    
    const stage = value as Record<string, unknown>;
    const validStages = ['$match', '$sort', '$limit', '$skip', '$project', '$lookup', 
        '$group', '$unwind', '$facet'] as const;
    
    // Check that the stage has exactly one valid MongoDB aggregation operator
    const [firstKey] = Object.keys(stage);
    return typeof firstKey === 'string' && validStages.includes(firstKey as typeof validStages[number]);
}

/**
 * Type guard to check if a value is a valid MongoDB Sort operation
 */
export function isValidSort<T extends BaseDocument>(value: unknown): value is Sort<T> {
    if (!value || typeof value !== 'object') return false;
    
    const sort = value as Record<string, unknown>;
    return Object.values(sort).every(val => val === 1 || val === -1);
}

/**
 * Validation utility for MongoDB operations
 */
export const MongoValidation = {
    /**
     * Validates a filter and throws if invalid
     */
    validateFilter<T extends BaseDocument>(filter: unknown): asserts filter is Filter<T> {
        if (!isValidFilter<T>(filter)) {
            throw new Error('Invalid MongoDB filter');
        }
    },

    /**
     * Validates an update operation and throws if invalid
     */
    validateUpdate<T extends BaseDocument>(update: unknown): asserts update is UpdateOperation<T> {
        if (!isValidUpdate<T>(update)) {
            throw new Error('Invalid MongoDB update operation');
        }
    },

    /**
     * Validates an aggregation stage and throws if invalid
     */
    validateAggregationStage<T extends BaseDocument>(stage: unknown): asserts stage is AggregationStage<T> {
        if (!isValidAggregationStage<T>(stage)) {
            throw new Error('Invalid MongoDB aggregation stage');
        }
    },

    /**
     * Validates a sort operation and throws if invalid
     */
    validateSort<T extends BaseDocument>(sort: unknown): asserts sort is Sort<T> {
        if (!isValidSort<T>(sort)) {
            throw new Error('Invalid MongoDB sort operation');
        }
    }
};

/**
 * Base MongoDB document type with required fields
 */
export interface MongoDocument extends Document {
  _id: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Type for creating a new document (without _id and timestamps)
 */
export type MongoCreateDocument<T extends MongoDocument> = Omit<T, keyof MongoDocument>;

/**
 * Type for updating a document (all fields optional except _id)
 */
export type MongoUpdateDocument<T extends MongoDocument> = Partial<Omit<T, '_id'>> & { _id: ObjectId };

/**
 * Type for MongoDB filter operations
 */
export type MongoFilter<T extends Document> = MongoFilterType<T>;

/**
 * Type for MongoDB update operations
 */
export type MongoUpdate<T extends Document> = UpdateFilter<T>;

/**
 * Type for MongoDB find options
 */
export interface MongoFindOptions<T extends Document> extends FindOptions<T> {
  lean?: boolean;
}

/**
 * Type for MongoDB insert options
 */
export interface MongoInsertOptions extends InsertOneOptions {
  timestamps?: boolean;
}

/**
 * Type for MongoDB update options
 */
export interface MongoUpdateOptions extends UpdateOptions {
  timestamps?: boolean;
}

/**
 * Type for MongoDB delete options
 */
export interface MongoDeleteOptions extends DeleteOptions {
  softDelete?: boolean;
}

/**
 * Type for MongoDB aggregate options
 */
export interface MongoAggregateOptions extends AggregateOptions {
  explain?: boolean;
}

/**
 * Type for MongoDB index options
 */
export interface MongoIndexOptions extends IndexSpecification {
  background?: boolean;
  unique?: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
}

/**
 * Type for MongoDB collection with enhanced type safety
 */
export interface TypedCollection<T extends MongoDocument> extends Omit<Collection<T>, 'findOne'> {
  findById(id: ObjectId | string): Promise<T | null>;
  findByIdAndUpdate(id: ObjectId | string, update: MongoUpdate<T>, options?: MongoUpdateOptions): Promise<T | null>;
  findByIdAndDelete(id: ObjectId | string, options?: MongoDeleteOptions): Promise<boolean>;
  findOne(filter: MongoFilter<T>): Promise<T | null>;
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
export function isMongoDocument<T extends MongoDocument>(value: unknown): value is T {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_id' in value &&
    isObjectId((value as T)._id) &&
    'createdAt' in value &&
    'updatedAt' in value
  );
}

/**
 * Helper type for MongoDB aggregation pipeline stages
 */
export type MongoAggregationStage = {
  $match?: Record<string, unknown>;
  $project?: Record<string, unknown>;
  $group?: Record<string, unknown>;
  $sort?: Record<string, unknown>;
  $limit?: number;
  $skip?: number;
  $lookup?: {
    from: string;
    localField: string;
    foreignField: string;
    as: string;
  };
  $unwind?: string | { path: string; preserveNullAndEmptyArrays?: boolean };
  [key: string]: unknown;
};

/**
 * Helper type for MongoDB aggregation pipeline
 */
export type MongoAggregationPipeline = MongoAggregationStage[];

/**
 * Helper type for MongoDB bulk write operations
 */
export type MongoBulkWriteOperation<T extends MongoDocument> = {
  insertOne?: { document: MongoCreateDocument<T> };
  updateOne?: {
    filter: MongoFilter<T>;
    update: MongoUpdate<T>;
    upsert?: boolean;
  };
  updateMany?: {
    filter: MongoFilter<T>;
    update: MongoUpdate<T>;
    upsert?: boolean;
  };
  deleteOne?: { filter: MongoFilter<T> };
  deleteMany?: { filter: MongoFilter<T> };
  replaceOne?: {
    filter: MongoFilter<T>;
    replacement: T;
    upsert?: boolean;
  };
};
