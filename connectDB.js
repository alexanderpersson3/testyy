require('dotenv').config();
const MongoClient = require("mongodb").MongoClient;

let _connection = undefined;
let _db = undefined;

module.exports = {
  connectToDb: async () => {
    if (!_connection) {
      _connection = await MongoClient.connect(process.env.MONGODB_URI);
      _db = await _connection.db(process.env.MONGODB_DB);
    }
    return _db;
  },
  closeConnection: () => {
    if (_connection) {
      _connection.close();
    }
  },
};