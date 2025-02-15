/**
 * Database configuration
 */
export interface DatabaseConfig {
  uri: string;
  name: string;
  options: {
    useNewUrlParser: boolean;
    useUnifiedTopology: boolean;
    maxPoolSize: number;
    serverSelectionTimeoutMS: number;
    socketTimeoutMS: number;
    connectTimeoutMS: number;
  };
}

export const databaseConfig: DatabaseConfig = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  name: process.env.MONGODB_NAME || 'rezepta',
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE || '10', 10),
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
  },
}; 