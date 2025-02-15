import { Db } from 'mongodb';
/**
 * Get the database instance
 */
export declare function getDb(): Promise<Db>;
/**
 * Ensure database connection
 */
export declare function ensureConnection(): Promise<void>;
/**
 * Check if database is connected
 */
export declare function isConnected(): Promise<boolean>;
/**
 * Disconnect from database
 */
export declare function disconnect(): Promise<void>;
