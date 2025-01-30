import { Db, MongoClient } from 'mongodb';

declare module '../../db.js' {
  export function getDb(): Promise<Db>;
  export function connectToDatabase(): Promise<Db>;
  export function closeDatabase(): Promise<void>;
}

export {}; 
