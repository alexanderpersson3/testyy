import type { Collection } from 'mongodb';
import { jest } from '@jest/globals';
import type { Document, WithId, Filter, UpdateFilter } from '../types/index.js';
import { Db, FindOptions, InsertOneResult, DeleteResult, UpdateResult } from 'mongodb';
import type { UserDocument } from '../types/index.js';
import type { RecipeDocument } from '../types/index.js';
import { ObjectId } from 'mongodb';
import { Challenge, ChallengeSubmission } from '../types/challenge.js';
import '@testing-library/jest-dom';
declare let testDb: Db;
interface MockCollectionMethods<T extends Document> {
    findOne: jest.MockedFunction<(filter: Filter<T>) => Promise<T | null>>;
    find: jest.MockedFunction<(filter: Filter<T>, options?: FindOptions) => {
        sort: jest.MockedFunction<(sort: Record<string, 1 | -1>) => {
            skip: jest.MockedFunction<(skip: number) => {
                limit: jest.MockedFunction<(limit: number) => {
                    toArray: jest.MockedFunction<() => Promise<T[]>>;
                }>;
            }>;
        }>;
        toArray: jest.MockedFunction<() => Promise<T[]>>;
    }>;
    insertOne: jest.MockedFunction<(doc: T) => Promise<InsertOneResult<T>>>;
    updateOne: jest.MockedFunction<(filter: Filter<T>, update: UpdateFilter<T>) => Promise<UpdateResult>>;
    deleteOne: jest.MockedFunction<(filter: Filter<T>) => Promise<DeleteResult>>;
    aggregate: jest.MockedFunction<(pipeline: any[]) => {
        toArray: jest.MockedFunction<() => Promise<any[]>>;
    }>;
    countDocuments: jest.MockedFunction<(filter: Filter<T>) => Promise<number>>;
    distinct: jest.MockedFunction<(field: string, filter: Filter<T>) => Promise<any[]>>;
}
interface MockCollections {
    users: jest.Mocked<Collection<UserDocument>> & MockCollectionMethods<UserDocument>;
    recipes: jest.Mocked<Collection<RecipeDocument>> & MockCollectionMethods<RecipeDocument>;
    challenges: jest.Mocked<Collection<Challenge>> & MockCollectionMethods<Challenge>;
    submissions: jest.Mocked<Collection<ChallengeSubmission>> & MockCollectionMethods<ChallengeSubmission>;
    timers: Collection;
    timerGroups: Collection;
}
type DeepPartial<T> = T extends ObjectId ? T : T extends Date ? T : T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;
export declare const mockCollections: MockCollections;
export declare const setupMockData: {
    user: (data?: Partial<Omit<UserDocument, "_id">>) => UserDocument;
    recipe: (data?: Partial<Omit<RecipeDocument, "_id" | "remixedFrom">> & {
        remixedFrom?: {
            recipeId: ObjectId;
            userId: ObjectId;
        };
    }) => RecipeDocument;
};
export declare const clearMockData: () => void;
export declare function createTestData<T extends Document>(collection: string, data: DeepPartial<T>[]): Promise<void>;
export declare function getCollectionData<T extends Document>(collection: string, filter?: Filter<T>, options?: FindOptions<T>): Promise<WithId<T>[]>;
export declare function clearCollection(collection: string): Promise<void>;
export declare function createTestUser(overrides?: DeepPartial<UserDocument>): Promise<UserDocument>;
export { testDb as db };
