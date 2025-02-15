import { MongoClient, Db, Collection, Document } from 'mongodb';

export class DatabaseService {
  private static instance: DatabaseService;
  private client: MongoClient;
  private db: Db | null = null;

  private constructor() {
    this.client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public getCollection<T extends Document>(name: string): Collection<T> {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db.collection<T>(name);
  }

  public getDb(): Db {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db;
  }

  public async connect(): Promise<void> {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(process.env.MONGODB_NAME || 'rezepta');
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.db = null;
    }
  }

  public async isConnected(): Promise<boolean> {
    return this.db !== null;
  }
}
