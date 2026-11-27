import 'dotenv/config';
import { MongoClient } from 'mongodb';

export const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
export const dbName = process.env.MONGODB_DB_NAME || 'cinema_booking';

export function assertWritableTarget({ allowDemo = false, allowQa = false } = {}) {
  const accepted = (allowDemo && dbName === 'cinema_booking_demo') || (allowQa && dbName.startsWith('cinema_booking_qa_'));
  if (!accepted) throw new Error(`Từ chối ghi vào database "${dbName}". Chỉ chấp nhận cinema_booking_demo hoặc tiền tố cinema_booking_qa_ theo chế độ script.`);
}

export function createClient() { return new MongoClient(uri); }

export async function collectionCounts(db) {
  const names = ['customers', 'movies', 'rooms', 'showtimes', 'showtime_seats', 'bookings'];
  return Object.fromEntries(await Promise.all(names.map(async name => [name, await db.collection(name).countDocuments({})])));
}
