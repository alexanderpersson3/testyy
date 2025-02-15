import { MongoClient, Db } from 'mongodb';

let client: MongoClient | undefined;
let db: Db | undefined;

export async function connectDb(): Promise<Db> {
  if (db) return db;

  try {
    client = await MongoClient.connect(process.env.MONGODB_URI!);
    db = client.db(process.env.MONGODB_DB);
    console.log('Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

export async function getDb(): Promise<Db> {
  if (!db) {
    db = await connectDb();
    if (!db) {
      throw new Error("Failed to connect to the database.");
    }
  }
  return db;
}

export { client };