import 'dotenv/config';
import { MongoClient, Db } from 'mongodb';

let _connection: MongoClient | undefined;
let _db: Db | undefined;

export const connectToDb = async (): Promise<Db> => {
  if (!_connection) {
    _connection = await MongoClient.connect(process.env.MONGODB_URI!);
    _db = await _connection.db(process.env.MONGODB_DB);
  }
  return _db!;
};

export const closeConnection = (): void => {
  if (_connection) {
    _connection.close();
  }
};