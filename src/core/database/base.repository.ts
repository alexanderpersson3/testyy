import { Collection, Document, Filter, Sort, FindOptions, ObjectId, WithId, OptionalUnlessRequiredId, UpdateResult } from 'mongodb';
import { DatabaseService } from './database.service';

export interface PaginationOptions {
  limit?: number;
  cursor?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  fields?: string[];
}

export interface PaginatedResult<T> {
  items: WithId<T>[];
  nextCursor?: string;
  hasMore: boolean;
  total: number;
}

/**
 * Base repository class for MongoDB collections
 */
export abstract class BaseRepository<T extends Document> {
  protected readonly collection: Collection<T>;
  protected readonly defaultLimit = 20;
  protected readonly maxLimit = 100;

  constructor(collectionName: string) {
    const db = DatabaseService.getInstance();
    this.collection = db.getCollection<T>(collectionName);
  }

  protected buildProjection(fields?: string[]): Record<string, 1 | 0> | undefined {
    if (!fields || fields.length === 0) {
      return undefined;
    }

    const projection: Record<string, 1 | 0> = {};
    fields.forEach(field => {
      projection[field] = 1;
    });
    return projection;
  }

  protected decodeCursor(cursor: string): Record<string, any> {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      throw new Error('Invalid cursor');
    }
  }

  protected encodeCursor(data: Record<string, any>): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  /**
   * Find a document by its ID
   */
  async findById(id: string | ObjectId, options: Partial<FindOptions> = {}): Promise<WithId<T> | null> {
    const _id = typeof id === 'string' ? new ObjectId(id) : id;
    return this.collection.findOne({ _id } as Filter<T>, options);
  }

  /**
   * Find documents matching a filter
   */
  async find(
    filter: Filter<T>,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<T>> {
    const {
      limit = this.defaultLimit,
      cursor,
      sortField = '_id',
      sortOrder = 'desc',
      fields
    } = options;

    const actualLimit = Math.min(limit, this.maxLimit);
    const sort: Sort = { [sortField]: sortOrder === 'desc' ? -1 : 1 };
    
    let queryFilter = { ...filter };
    if (cursor) {
      const decodedCursor = this.decodeCursor(cursor);
      const cursorValue = decodedCursor[sortField];
      if (cursorValue) {
        queryFilter = {
          ...queryFilter,
          [sortField]: sortOrder === 'desc' 
            ? { $lt: cursorValue }
            : { $gt: cursorValue }
        };
      }
    }

    const projection = this.buildProjection(fields);
    const findOptions: FindOptions = {
      sort,
      limit: actualLimit + 1,
      ...(projection && { projection })
    };

    const items = await this.collection.find(queryFilter, findOptions).toArray();
    const hasMore = items.length > actualLimit;
    if (hasMore) {
      items.pop(); // Remove the extra item we fetched
    }

    const total = await this.collection.countDocuments(filter);

    let nextCursor: string | undefined;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      const cursorValue = lastItem[sortField as keyof WithId<T>];
      if (cursorValue) {
        nextCursor = this.encodeCursor({
          [sortField]: cursorValue
        });
      }
    }

    return {
      items,
      nextCursor,
      hasMore,
      total
    };
  }

  /**
   * Find one document matching a filter
   */
  async findOne(filter: Filter<T>, options: Partial<FindOptions> = {}): Promise<WithId<T> | null> {
    return this.collection.findOne(filter, options);
  }

  /**
   * Create a new document
   */
  async create(data: OptionalUnlessRequiredId<T>): Promise<WithId<T>> {
    const result = await this.collection.insertOne(data);
    const created = await this.findById(result.insertedId);
    if (!created) {
      throw new Error('Failed to create document');
    }
    return created;
  }

  /**
   * Update a document by ID
   */
  async update(id: string | ObjectId, data: Partial<T>): Promise<WithId<T> | null> {
    const _id = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await this.collection.findOneAndUpdate(
      { _id } as Filter<T>,
      { $set: data },
      { returnDocument: 'after' }
    );
    return result?.value || null;
  }

  /**
   * Delete a document by ID
   */
  async delete(id: string | ObjectId): Promise<boolean> {
    const _id = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await this.collection.deleteOne({ _id } as Filter<T>);
    return result.deletedCount === 1;
  }

  /**
   * Check if a document exists
   */
  async exists(filter: Filter<T>): Promise<boolean> {
    const count = await this.collection.countDocuments(filter, { limit: 1 });
    return count > 0;
  }

  /**
   * Count documents matching a filter
   */
  async count(filter: Filter<T>): Promise<number> {
    return this.collection.countDocuments(filter);
  }

  // Bulk operations
  async bulkWrite(operations: any[]): Promise<boolean> {
    const result = await this.collection.bulkWrite(operations);
    return result.ok === 1;
  }

  // Aggregation helper
  async aggregate<R extends Document = T>(pipeline: object[]): Promise<R[]> {
    return this.collection.aggregate<R>(pipeline).toArray();
  }
} 