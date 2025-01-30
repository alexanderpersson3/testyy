import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectToDatabase, disconnect } from '../db/index.js';

let mongoServer;
let dbConnection;

const setupMockDb = async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  
  const { db } = await connectToDatabase();
  dbConnection = db;
  return db;
};

const closeMockDb = async () => {
  await disconnect().catch(console.error);
  await mongoServer.stop();
};

const clearCollections = async () => {
  await Promise.all([
    dbConnection.collection('ingredients').deleteMany({}),
    dbConnection.collection('products').deleteMany({})
  ]);
};

export { 
  setupMockDb,
  closeMockDb,
  clearCollections as clearMockDb,
  dbConnection as getDb
};
