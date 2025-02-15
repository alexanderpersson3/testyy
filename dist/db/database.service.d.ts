import type { Collection } from 'mongodb';
import { Db } from 'mongodb';
import type { Document, Filter, FindOptions, FindOneAndUpdateOptions, BulkWriteOptions, OptionalUnlessRequiredId, AnyBulkWriteOperation, WithId } from '../types/index.js';
export declare class DatabaseService {
    private static instance;
    private client;
    private db;
    private constructor();
    static getInstance(): DatabaseService;
    getCollection<TSchema extends Document>(name: string): Collection<TSchema>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    insertOne<TSchema extends Document>(collection: string, doc: OptionalUnlessRequiredId<TSchema>): Promise<WithId<TSchema>>;
    findOne<TSchema extends Document>(collection: string, filter: Filter<TSchema>, options?: FindOptions): Promise<WithId<TSchema> | null>;
    findMany<TSchema extends Document>(collection: string, filter: Filter<TSchema>, options?: FindOptions): Promise<WithId<TSchema>[]>;
    updateOne<TSchema extends Document>(collection: string, filter: Filter<TSchema>, update: Partial<TSchema>, options?: FindOneAndUpdateOptions): Promise<WithId<TSchema> | null>;
    deleteOne<TSchema extends Document>(collection: string, filter: Filter<TSchema>): Promise<boolean>;
    bulkWrite<TSchema extends Document>(collection: string, operations: AnyBulkWriteOperation<TSchema>[], options?: BulkWriteOptions): Promise<boolean>;
    paginate<TSchema extends Document>(collection: string, filter: Filter<TSchema>, options: {
        page?: number;
        limit?: number;
        sort?: string;
        order?: 'asc' | 'desc';
    }): Promise<{
        data: WithId<TSchema>[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    aggregate<TSchema extends Document, TResult extends Document = TSchema>(collection: string, pipeline: object[]): Promise<WithId<TResult>[]>;
    isConnected(): Promise<boolean>;
    getDb(): Db;
}
export declare const db: DatabaseService;
export declare function connectToDatabase(): Promise<Db>;
export default DatabaseService;
