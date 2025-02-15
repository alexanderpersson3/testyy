import type { Collection } from 'mongodb';
import { Db } from 'mongodb';
export declare function connectToDatabase(): Promise<Db>;
export declare function getCollection<T extends Document>(name: string): Promise<Collection<T>>;
export declare function closeDatabase(): Promise<void>;
export declare function getDb(): Db | null;
