import type { Collection, Filter, UpdateFilter, FindOptions, Sort, WithId, OptionalUnlessRequiredId } from 'mongodb';
import { ObjectId } from 'mongodb';
import type {
  MongoDocument,
  CreateDocument,
  UpdateDocument,
  MongoPaginationOptions,
  TypedCollection
} from '../types/mongodb.types.js';
import { DatabaseService } from './database.service.js';
import { isObjectId } from '../types/mongodb.types.js';

/**
 * Base repository class for MongoDB collections
 */
export abstract class BaseRepository<T extends MongoDocument> {
  protected readonly collection: Collection<T>;

  constructor(collectionName: string) {
    const db = DatabaseService.getInstance();
    this.collection = db.getCollection<T>(collectionName);
  }

  /**
   * Find a document by its ID
   */
  async findById(id: string | ObjectId): Promise<WithId<T> | null> {
    const _id = isObjectId(id) ? id : new ObjectId(id);
    return this.collection.findOne({ _id } as Filter<T>);
  }

  /**
   * Find documents matching a filter
   */
  async find(filter: Filter<T>, options?: FindOptions): Promise<WithId<T>[]> {
    return this.collection.find(filter, options).toArray();
  }

  /**
   * Find one document matching a filter
   */
  async findOne(filter: Filter<T>, options?: FindOptions): Promise<WithId<T> | null> {
    return this.collection.findOne(filter, options);
  }

  /**
   * Create a new document
   */
  async create(data: CreateDocument<T>): Promise<WithId<T>> {
    const now = new Date();
    const doc = {
      ...data,
      createdAt: now,
      updatedAt: now
    } as unknown as OptionalUnlessRequiredId<T>;

    const result = await this.collection.insertOne(doc);
    return {
      ...doc,
      _id: result.insertedId
    } as WithId<T>;
  }

  /**
   * Update a document by ID
   */
  async updateById(id: string | ObjectId, update: UpdateDocument<T>): Promise<WithId<T> | null> {
    const _id = isObjectId(id) ? id : new ObjectId(id);
    const result = await this.collection.findOneAndUpdate(
      { _id } as Filter<T>,
      { 
        $set: {
          ...update,
          updatedAt: new Date()
        }
      } as UpdateFilter<T>,
      { returnDocument: 'after' }
    );
    return result.value;
  }

  /**
   * Delete a document by ID
   */
  async deleteById(id: string | ObjectId): Promise<boolean> {
    const _id = isObjectId(id) ? id : new ObjectId(id);
    const result = await this.collection.deleteOne({ _id } as Filter<T>);
    return result.deletedCount === 1;
  }

  /**
   * Find documents with pagination
   */
  async paginate(
    filter: Filter<T>,
    options: MongoPaginationOptions = {}
  ): Promise<{
    items: WithId<T>[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 10));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.collection
        .find(filter)
        .sort(options.sort as Sort)
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.collection.countDocuments(filter)
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
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
} 