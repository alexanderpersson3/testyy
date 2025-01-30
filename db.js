import { MongoClient } from 'mongodb';

let client;
let db;

export async function connectToDatabase() {
  if (db) return db;

  try {
    client = await MongoClient.connect(process.env.MONGODB_URI);
    db = client.db();
    console.log('Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export async function closeDatabase() {
  if (client) {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

export { client, db }; 