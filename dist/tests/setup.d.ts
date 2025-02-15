import type { Document } from '../types/index.js';
import { Db, OptionalUnlessRequiredId } from 'mongodb';
import type { Recipe } from '../types/index.js';
declare let db: Db;
export declare function createTestData<T extends Document>(collection: string, data: OptionalUnlessRequiredId<T>[]): Promise<void>;
export declare function getCollectionData<T extends Document>(collection: string): Promise<T[]>;
export declare function clearCollection(collection: string): Promise<void>;
export declare function createTestRecipe(overrides?: Partial<Omit<Recipe, '_id'>>): Omit<Recipe, '_id'>;
export { db };
