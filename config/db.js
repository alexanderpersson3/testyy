import { MongoClient } from 'mongodb';

let client;
let db;

export async function connectDb() {
  if (db) return db;

  try {
    client = await MongoClient.connect(process.env.MONGODB_URI);
    db = client.db(process.env.MONGODB_DB);
    console.log('Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export async function closeDb() {
  if (client) {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

export async function getDb() {
  if (!db) {
    await connectDb();
  }
  return db;
}

export { client }; 