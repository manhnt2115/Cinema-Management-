import 'dotenv/config';
import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
const dbName = 'cinema_booking';
const now = new Date();

const customers = [
  { _id: 'CUS001', fullName: 'Khách Demo', email: 'demo@example.test' },
  { _id: 'CUS002', fullName: 'Khách Demo 02', email: 'demo02@example.test' },
  { _id: 'CUS003', fullName: 'Khách Demo 03', email: 'demo03@example.test' },
  { _id: 'CUS004', fullName: 'Khách Demo 04', email: 'demo04@example.test' },
  { _id: 'CUS005', fullName: 'Khách Demo 05', email: 'demo05@example.test' },
  { _id: 'CUS006', fullName: 'Khách Demo 06', email: 'demo06@example.test' }
];

const movies = [
  { _id: 'MV001', title: 'Hành Trình Ánh Sao', genres: ['Phiêu lưu', 'Gia đình'], durationMinutes: 112, status: 'NOW_SHOWING', synopsis: 'Một chuyến phiêu lưu dành cho cả gia đình.' },
  { _id: 'MV002', title: 'Bí Mật Thành Phố', genres: ['Tâm lý', 'Bí ẩn'], durationMinutes: 124, status: 'NOW_SHOWING', synopsis: 'Một vụ mất tích làm đảo lộn thành phố.' },
  { _id: 'MV003', title: 'Ngày Mai Rực Rỡ', genres: ['Hài', 'Tình cảm'], durationMinutes: 98, status: 'COMING_SOON', synopsis: 'Cuộc gặp gỡ tình cờ mở ra khởi đầu mới.' },
  { _id: 'MV004', title: 'Vùng Trời Lặng Gió', genres: ['Phiêu lưu', 'Tâm lý'], durationMinutes: 106, status: 'NOW_SHOWING', synopsis: 'Một hành trình khám phá vùng đất chưa được ghi dấu.' },
  { _id: 'MV005', title: 'Chuyến Tàu Cuối Tuần', genres: ['Hài', 'Gia đình'], durationMinutes: 101, status: 'NOW_SHOWING', synopsis: 'Những vị khách xa lạ cùng chia sẻ một chuyến tàu đáng nhớ.' },
  { _id: 'MV006', title: 'Hồ Sơ Mùa Mưa', genres: ['Bí ẩn', 'Tâm lý'], durationMinutes: 118, status: 'NOW_SHOWING', synopsis: 'Một hồ sơ cũ hé lộ nhiều bí mật chưa được giải đáp.' }
];

function makeSeats(rowCount, columnCount = 8) {
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const row = String.fromCharCode(65 + rowIndex);
    return Array.from({ length: columnCount }, (_, columnIndex) => ({
      code: `${row}${columnIndex + 1}`,
      row,
      number: columnIndex + 1,
      type: rowIndex >= rowCount - 1 ? 'PREMIUM' : 'STANDARD'
    }));
  }).flat();
}

const rooms = [
  { _id: 'ROOM001', name: 'Phòng 1', seats: makeSeats(5) },
  { _id: 'ROOM002', name: 'Phòng 2', seats: makeSeats(4) }
];

const showtimePlans = [
  { _id: 'ST002', movieId: 'MV002', roomId: 'ROOM001', price: 85000, bookings: [
    { _id: 'BK-DEMO-001', customerId: 'CUS002', seatCodes: ['A1', 'A2'], status: 'CONFIRMED', daysAgo: 4 },
    { _id: 'BK-DEMO-002', customerId: 'CUS003', seatCodes: ['B3', 'B4'], status: 'CONFIRMED', daysAgo: 2 }
  ] },
  { _id: 'ST003', movieId: 'MV004', roomId: 'ROOM002', price: 80000, bookings: [
    { _id: 'BK-DEMO-003', customerId: 'CUS002', seatCodes: ['A2', 'A3'], status: 'CONFIRMED', daysAgo: 3 },
    { _id: 'BK-DEMO-004', customerId: 'CUS004', seatCodes: ['D7'], status: 'CONFIRMED', daysAgo: 1 }
  ] },
  { _id: 'ST004', movieId: 'MV005', roomId: 'ROOM001', price: 95000, bookings: [
    { _id: 'BK-DEMO-005', customerId: 'CUS005', seatCodes: ['C3', 'C4', 'C5'], status: 'CONFIRMED', daysAgo: 1 }
  ] },
  { _id: 'ST005', movieId: 'MV001', roomId: 'ROOM002', price: 90000, bookings: [
    { _id: 'BK-DEMO-006', customerId: 'CUS003', seatCodes: ['B1', 'B2'], status: 'CONFIRMED', daysAgo: 2 },
    { _id: 'BK-DEMO-007', customerId: 'CUS006', seatCodes: ['C5', 'C6'], status: 'CANCELLED', daysAgo: 5 }
  ] },
  { _id: 'ST006', movieId: 'MV006', roomId: 'ROOM001', price: 80000, bookings: [] }
];

async function insertIfMissing(collection, document, insertedByCollection) {
  const result = await collection.updateOne(
    { _id: document._id },
    { $setOnInsert: document },
    { upsert: true }
  );
  if (result.upsertedCount) insertedByCollection[collection.collectionName] = (insertedByCollection[collection.collectionName] || 0) + 1;
}

async function nextAvailableSlot(showtimes, roomId, durationMinutes) {
  let startAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  startAt.setMinutes(0, 0, 0);
  const endAt = () => new Date(startAt.getTime() + durationMinutes * 60 * 1000);

  for (let attempts = 0; attempts < 100; attempts++) {
    const candidateEnd = endAt();
    const conflict = await showtimes.findOne({
      roomId,
      startAt: { $lt: candidateEnd },
      endAt: { $gt: startAt }
    }, { projection: { endAt: 1 } });
    if (!conflict) return { startAt, endAt: candidateEnd };
    startAt = new Date(new Date(conflict.endAt).getTime() + 30 * 60 * 1000);
  }
  throw new Error(`Không tìm được giờ trống an toàn cho phòng ${roomId}.`);
}

function makeBooking(plan, showtime, bookingPlan) {
  const seats = bookingPlan.seatCodes.map(seatCode => ({ seatCode, unitPriceVnd: showtime.basePriceVnd }));
  const isConfirmed = bookingPlan.status === 'CONFIRMED';
  const createdAt = new Date(now.getTime() - bookingPlan.daysAgo * 24 * 60 * 60 * 1000);
  return {
    _id: bookingPlan._id,
    customerId: bookingPlan.customerId,
    showtimeId: plan._id,
    movieId: plan.movieId,
    seats,
    totalAmountVnd: seats.reduce((sum, seat) => sum + seat.unitPriceVnd, 0),
    status: bookingPlan.status,
    payment: { method: 'SIMULATED', status: isConfirmed ? 'SUCCESS' : 'FAILED', paidAt: isConfirmed ? createdAt : null },
    createdAt
  };
}

const inserted = {};

try {
  await client.connect();
  const db = client.db(dbName);
  const customersCollection = db.collection('customers');
  const moviesCollection = db.collection('movies');
  const roomsCollection = db.collection('rooms');
  const showtimesCollection = db.collection('showtimes');
  const seatsCollection = db.collection('showtime_seats');
  const bookingsCollection = db.collection('bookings');

  // Each write is an insert-only upsert by fixed demo ID. Existing documents are never updated or deleted.
  for (const customer of customers) await insertIfMissing(customersCollection, { ...customer, createdAt: now }, inserted);
  for (const movie of movies) await insertIfMissing(moviesCollection, movie, inserted);
  for (const room of rooms) await insertIfMissing(roomsCollection, room, inserted);

  for (const plan of showtimePlans) {
    const movie = movies.find(item => item._id === plan.movieId);
    const room = rooms.find(item => item._id === plan.roomId);
    if (!movie || !room) throw new Error(`Thiếu movie/room tham chiếu cho ${plan._id}.`);
    const existingShowtime = await showtimesCollection.findOne({ _id: plan._id });
    const slot = existingShowtime || await nextAvailableSlot(showtimesCollection, plan.roomId, movie.durationMinutes);
    const showtime = existingShowtime || {
      _id: plan._id,
      movieId: plan.movieId,
      roomId: plan.roomId,
      startAt: slot.startAt,
      endAt: slot.endAt,
      basePriceVnd: plan.price,
      status: 'OPEN'
    };
    await insertIfMissing(showtimesCollection, showtime, inserted);

    const bookingsBySeat = new Map();
    for (const booking of plan.bookings) {
      if (booking.status === 'CONFIRMED') {
        for (const seatCode of booking.seatCodes) {
          if (!room.seats.some(seat => seat.code === seatCode) || bookingsBySeat.has(seatCode)) {
            throw new Error(`Ghế không hợp lệ hoặc bị gán trùng trong ${plan._id}: ${seatCode}.`);
          }
          bookingsBySeat.set(seatCode, booking._id);
        }
      }
    }

    for (const seat of room.seats) {
      const bookingId = bookingsBySeat.get(seat.code) || null;
      await insertIfMissing(seatsCollection, {
        _id: `${plan._id}_${seat.code}`,
        showtimeId: plan._id,
        seatCode: seat.code,
        status: bookingId ? 'BOOKED' : 'AVAILABLE',
        bookingId,
        holdExpiresAt: null
      }, inserted);
    }

    for (const bookingPlan of plan.bookings) {
      if (!bookingPlan.seatCodes.every(seatCode => room.seats.some(seat => seat.code === seatCode))) {
        throw new Error(`Booking ${bookingPlan._id} tham chiếu ghế ngoài sơ đồ phòng.`);
      }
      await insertIfMissing(bookingsCollection, makeBooking(plan, showtime, bookingPlan), inserted);
    }
  }

  await customersCollection.createIndex({ email: 1 }, { unique: true });
  await showtimesCollection.createIndex({ movieId: 1, startAt: 1 });
  await bookingsCollection.createIndex({ customerId: 1, createdAt: -1 });
  await seatsCollection.createIndex({ showtimeId: 1, seatCode: 1 }, { unique: true });

  const counts = {};
  for (const name of ['customers', 'movies', 'rooms', 'showtimes', 'showtime_seats', 'bookings']) {
    counts[name] = await db.collection(name).countDocuments({});
  }
  console.log(JSON.stringify({ database: dbName, inserted, counts, message: 'Existing documents were preserved; only missing demo IDs were inserted.' }, null, 2));
} finally {
  await client.close();
}
