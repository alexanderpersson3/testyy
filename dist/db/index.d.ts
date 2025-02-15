import type { Collection } from 'mongodb';
import type { Document, ObjectId } from '../types/index.js';
import { type Db } from 'mongodb';
import { connectToDatabase as connect, DatabaseService } from '@/db/database.service';
declare const db: any;
/**
 * Ensure database connection is established
 */
export declare function ensureConnection(): Promise<void>;
/**
 * Get a typed collection
 */
export declare function getCollection<T extends Document>(name: string): Collection<T>;
/**
 * Get the database instance
 */
export declare function getDb(): Db;
export { db, DatabaseService };
export { connect as connectToDatabase };
export type { Db, Collection, Document, ObjectId };
