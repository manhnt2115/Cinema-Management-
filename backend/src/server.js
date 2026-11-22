import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { randomBytes } from 'node:crypto';
import { getDb } from './db.js';
import { registerAdminRoutes } from './admin.js';

const app = express();
app.use(cors());
app.use(express.json());

function createBookingId() {
  const date = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = randomBytes(6).toString('hex').toUpperCase();
  return `BK-${date}-${suffix}`;
}
app.get('/api/health', async (_req, res) => {
  try { const db = await getDb(); await db.command({ ping: 1 }); res.json({ ok: true, database: db.databaseName }); }
  catch { res.status(503).json({ ok: false, error: 'Không kết nối được MongoDB' }); }
});
app.get('/api/movies', async (_req, res, next) => {
  try { res.json(await (await getDb()).collection('movies').find({ status: 'NOW_SHOWING' }).sort({ title: 1 }).toArray()); }
  catch (e) { next(e); }
});
app.get('/api/movies/:id/showtimes', async (req, res, next) => {
  try { res.json(await (await getDb()).collection('showtimes').find({ movieId: req.params.id, status: 'OPEN', startAt: { $gte: new Date() } }).sort({ startAt: 1 }).toArray()); }
  catch (e) { next(e); }
});
app.get('/api/showtimes/:id/seats', async (req, res, next) => {
  try { res.json(await (await getDb()).collection('showtime_seats').find({ showtimeId: req.params.id }).sort({ seatCode: 1 }).toArray()); }
  catch (e) { next(e); }
});
app.post('/api/bookings', async (req, res, next) => {
  const { customerId, showtimeId, seatCodes } = req.body ?? {};
  if (typeof customerId !== 'string' || !customerId.trim() || typeof showtimeId !== 'string' || !showtimeId.trim()) {
    return res.status(400).json({ error: 'customerId và showtimeId là bắt buộc.' });
  }
  if (!Array.isArray(seatCodes) || seatCodes.length === 0 || seatCodes.some(code => typeof code !== 'string' || !code.trim())) {
    return res.status(400).json({ error: 'seatCodes phải là danh sách mã ghế không rỗng.' });
  }
  if (new Set(seatCodes).size !== seatCodes.length) return res.status(400).json({ error: 'Danh sách seatCodes không được chứa mã ghế trùng.' });

  const db = await getDb();
  const customers = db.collection('customers');
  const showtimes = db.collection('showtimes');
  const rooms = db.collection('rooms');
  const seats = db.collection('showtime_seats');
  const bookings = db.collection('bookings');
  const customer = await customers.findOne({ _id: customerId });
  if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng.' });
  const showtime = await showtimes.findOne({ _id: showtimeId });
  if (!showtime) return res.status(404).json({ error: 'Không tìm thấy suất chiếu.' });
  const startAt = new Date(showtime.startAt);
  const endAt = new Date(showtime.endAt);
  if (showtime.status !== 'OPEN') return res.status(409).json({ error: 'Suất chiếu hiện không mở bán.' });
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt || startAt <= new Date()) {
    return res.status(409).json({ error: 'Thời gian suất chiếu không hợp lệ hoặc đã bắt đầu.' });
  }
  if (typeof showtime.basePriceVnd !== 'number' || !Number.isFinite(showtime.basePriceVnd) || showtime.basePriceVnd < 0) {
    return res.status(500).json({ error: 'Suất chiếu chưa có giá vé hợp lệ.' });
  }
  const room = await rooms.findOne({ _id: showtime.roomId });
  if (!room) return res.status(409).json({ error: 'Phòng chiếu của suất chiếu không tồn tại.' });
  const requestedSeats = new Set(seatCodes);
  const roomSeats = Array.isArray(room.seats) ? room.seats : [];
  if ([...requestedSeats].some(code => !roomSeats.some(seat => seat.code === code))) {
    return res.status(400).json({ error: 'Một hoặc nhiều ghế không thuộc sơ đồ phòng của suất chiếu.' });
  }
  const seatDocs = await seats.find({ showtimeId, seatCode: { $in: seatCodes } }).toArray();
  if (seatDocs.length !== seatCodes.length) return res.status(404).json({ error: 'Không tìm thấy trạng thái của một hoặc nhiều ghế trong suất chiếu.' });
  if (seatDocs.some(seat => !['AVAILABLE', 'HELD', 'BOOKED'].includes(seat.status))) {
    return res.status(409).json({ error: 'Dữ liệu trạng thái của ghế không hợp lệ.' });
  }

  const bookingId = createBookingId();
  const heldCodes = [];
  let bookingInserted = false;
  const compensate = async () => {
    await seats.updateMany(
      { showtimeId, seatCode: { $in: seatCodes }, bookingId, status: { $in: ['HELD', 'BOOKED'] } },
      { $set: { status: 'AVAILABLE', bookingId: null, holdExpiresAt: null } }
    );
    if (bookingInserted) {
      await bookings.updateOne({ _id: bookingId, status: { $in: ['PENDING', 'CONFIRMED'] } },
        { $set: { status: 'CANCELLED', 'payment.status': 'FAILED', 'payment.failedAt': new Date() } });
    }
  };

  try {
    for (const seatCode of seatCodes) {
      const result = await seats.updateOne(
        { showtimeId, seatCode, status: 'AVAILABLE', bookingId: null },
        { $set: { status: 'HELD', bookingId, holdExpiresAt: null } }
      );
      if (result.modifiedCount !== 1) {
        await compensate();
        return res.status(409).json({ error: `Ghế ${seatCode} không còn khả dụng; không tạo booking thành công.` });
      }
      heldCodes.push(seatCode);
    }

    const bookingSeats = seatCodes.map(seatCode => ({ seatCode, unitPriceVnd: showtime.basePriceVnd }));
    const booking = {
      _id: bookingId, customerId, showtimeId, movieId: showtime.movieId,
      seats: bookingSeats,
      totalAmountVnd: showtime.basePriceVnd * seatCodes.length,
      status: 'PENDING',
      payment: { method: 'SIMULATED', status: 'PENDING', paidAt: null },
      createdAt: new Date()
    };
    await bookings.insertOne(booking);
    bookingInserted = true;

    for (const seatCode of heldCodes) {
      const result = await seats.updateOne(
        { showtimeId, seatCode, status: 'HELD', bookingId },
        { $set: { status: 'BOOKED', holdExpiresAt: null } }
      );
      if (result.modifiedCount !== 1) throw new Error(`Không thể xác nhận ghế ${seatCode}.`);
    }

    const paidAt = new Date();
    const finalization = await bookings.updateOne(
      { _id: bookingId, status: 'PENDING', 'payment.status': 'PENDING' },
      { $set: { status: 'CONFIRMED', 'payment.status': 'SUCCESS', 'payment.paidAt': paidAt } }
    );
    if (finalization.modifiedCount !== 1) throw new Error('Không thể xác nhận booking và thanh toán mô phỏng.');

    return res.status(201).json({ ...booking, status: 'CONFIRMED', payment: { method: 'SIMULATED', status: 'SUCCESS', paidAt } });
  } catch (error) {
    try { await compensate(); }
    catch (compensationError) { console.error('Booking compensation failed:', compensationError.message); }
    return next(error);
  }
});
app.get('/api/customers/:customerId/bookings/details', async (req, res, next) => {
  try {
    const db = await getDb();
    const customerId = req.params.customerId;
    if (!await db.collection('customers').findOne({ _id: customerId }, { projection: { _id: 1 } })) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng.' });
    }
    const bookings = await db.collection('bookings').find({ customerId }).sort({ createdAt: -1 }).toArray();
    const movieIds = [...new Set(bookings.map(booking => booking.movieId).filter(Boolean))];
    const showtimeIds = [...new Set(bookings.map(booking => booking.showtimeId).filter(Boolean))];
    const [movies, showtimes] = await Promise.all([
      movieIds.length ? db.collection('movies').find({ _id: { $in: movieIds } }, { projection: { _id: 1, title: 1 } }).toArray() : [],
      showtimeIds.length ? db.collection('showtimes').find({ _id: { $in: showtimeIds } }, { projection: { _id: 1, startAt: 1 } }).toArray() : []
    ]);
    const movieTitles = new Map(movies.map(movie => [movie._id, movie.title]));
    const showtimeDates = new Map(showtimes.map(showtime => [showtime._id, showtime.startAt]));
    return res.json(bookings.map(booking => ({
      ...booking,
      movieTitle: movieTitles.get(booking.movieId) || null,
      startAt: showtimeDates.get(booking.showtimeId) || null
    })));
  } catch (error) { return next(error); }
});

app.get('/api/customers/:customerId/bookings', async (req, res, next) => {
  try {
    const db = await getDb();
    if (!await db.collection('customers').findOne({ _id: req.params.customerId }, { projection: { _id: 1 } })) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng.' });
    }
    const items = await db.collection('bookings').find({ customerId: req.params.customerId }).sort({ createdAt: -1 }).toArray();
    return res.json(items);
  } catch (error) { return next(error); }
});
registerAdminRoutes(app);
app.use((err, _req, res, _next) => { console.error(err.message); res.status(500).json({ error: 'Đã xảy ra lỗi máy chủ.' }); });
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
