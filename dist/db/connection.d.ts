import { Db } from 'mongodb';
export declare function connectToDatabase(): Promise<Db>;
export declare function closeDatabase(): Promise<void>;
/** @deprecated Use connectToDatabase() instead */
export declare function getDb(): Db;
//# sourceMappingURL=connection.d.ts.map