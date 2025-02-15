import type { Collection } from 'mongodb';
import { Db } from 'mongodb';
import { db } from '../database.service.js';
export * from '../database.service.js';
export declare function getCollection<T extends Document>(name: string): Collection<T>;
export declare function getDb(): Db;
export { db };
