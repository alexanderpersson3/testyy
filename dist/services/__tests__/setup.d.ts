import { Db } from 'mongodb';
declare let db: Db;
export declare function createTestData(collection: string, data: any[]): Promise<void>;
export declare function getCollectionData(collection: string): Promise<import("mongodb").WithId<import("bson").Document>[]>;
export declare function clearCollection(collection: string): Promise<void>;
export { db };
