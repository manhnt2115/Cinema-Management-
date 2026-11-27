import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME || 'cinema_management';
export const client = new MongoClient(uri);
let connectionPromise;
export async function getDb() {
  connectionPromise ??= client.connect();
  await connectionPromise;
  return client.db(dbName);
}
