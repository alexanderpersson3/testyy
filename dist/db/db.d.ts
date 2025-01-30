import { MongoClient, Db } from 'mongodb';
declare let client: MongoClient | undefined;
declare let db: Db | undefined;
export declare function connectToDatabase(): Promise<Db>;
export declare function closeDatabase(): Promise<void>;
export { client, db };
//# sourceMappingURL=db.d.ts.map