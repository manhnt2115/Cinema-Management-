import { randomUUID } from 'node:crypto';
import { getDb } from './db.js';

const movieStatuses = new Set(['NOW_SHOWING', 'COMING_SOON']);
const showtimeStatuses = new Set(['OPEN', 'CLOSED']);
const bookingStatuses = new Set(['PENDING', 'CONFIRMED', 'CANCELLED']);
const allowedAdminOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);

function isLocalRequest(req) {
  const address = String(req.socket.remoteAddress || '').toLowerCase();
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function readMovieInput(body) {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const genres = Array.isArray(body?.genres) ? body.genres.map(value => typeof value === 'string' ? value.trim() : '') : [];
  const durationMinutes = Number(body?.durationMinutes);
  const status = body?.status;
  const synopsis = typeof body?.synopsis === 'string' ? body.synopsis.trim() : '';
  if (!title || title.length > 160) return { error: 'Tên phim là bắt buộc và tối đa 160 ký tự.' };
  if (!genres.length || genres.some(value => !value) || new Set(genres).size !== genres.length) return { error: 'Thể loại phải là danh sách không rỗng, không có mục trống hoặc trùng.' };
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) return { error: 'Thời lượng phải là số nguyên từ 1 đến 600 phút.' };
  if (!movieStatuses.has(status)) return { error: 'Trạng thái phim phải là NOW_SHOWING hoặc COMING_SOON.' };
  if (synopsis.length > 2000) return { error: 'Tóm tắt phim tối đa 2.000 ký tự.' };
  return { value: { title, genres, durationMinutes, status, synopsis } };
}

function readShowtimeInput(body) {
  const movieId = typeof body?.movieId === 'string' ? body.movieId.trim() : '';
  const roomId = typeof body?.roomId === 'string' ? body.roomId.trim() : '';
  const startAt = new Date(body?.startAt);
  const endAt = new Date(body?.endAt);
  const basePriceVnd = Number(body?.basePriceVnd);
  const status = body?.status || 'OPEN';
  if (!movieId || !roomId) return { error: 'movieId và roomId là bắt buộc.' };
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || startAt <= new Date() || endAt <= startAt) return { error: 'Giờ kết thúc phải sau giờ bắt đầu và suất chiếu phải ở tương lai.' };
  if (!Number.isSafeInteger(basePriceVnd) || basePriceVnd < 0) return { error: 'Giá vé phải là số nguyên không âm theo VND.' };
  if (!showtimeStatuses.has(status)) return { error: 'Trạng thái suất chiếu phải là OPEN hoặc CLOSED.' };
  return { value: { movieId, roomId, startAt, endAt, basePriceVnd, status } };
}

async function checkSchedule(db, value, excludingId) {
  const [movie, room] = await Promise.all([
    db.collection('movies').findOne({ _id: value.movieId }, { projection: { _id: 1 } }),
    db.collection('rooms').findOne({ _id: value.roomId }, { projection: { _id: 1, seats: 1 } })
  ]);
  if (!movie) return 'Không tìm thấy phim.';
  if (!room) return 'Không tìm thấy phòng chiếu.';
  const roomSeats = Array.isArray(room.seats) ? room.seats : [];
  const seatCodes = roomSeats.map(seat => seat?.code).filter(code => typeof code === 'string' && code.trim());
  if (!seatCodes.length || seatCodes.length !== roomSeats.length || new Set(seatCodes).size !== seatCodes.length) return 'Sơ đồ ghế phòng không hợp lệ hoặc có mã ghế trùng.';

  const overlap = await db.collection('showtimes').findOne({
    roomId: value.roomId,
    _id: { $ne: excludingId ?? null },
    startAt: { $lt: value.endAt },
    endAt: { $gt: value.startAt }
  }, { projection: { _id: 1 } });
  if (overlap) return 'Phòng đã có suất chiếu giao thời gian này.';
  return null;
}

async function attachShowtimeDetails(db, items) {
  const movieIds = [...new Set(items.map(item => item.movieId).filter(Boolean))];
  const roomIds = [...new Set(items.map(item => item.roomId).filter(Boolean))];
  const showtimeIds = [...new Set(items.map(item => item.showtimeId).filter(Boolean))];
  const [movies, rooms, showtimes] = await Promise.all([
    movieIds.length ? db.collection('movies').find({ _id: { $in: movieIds } }, { projection: { _id: 1, title: 1 } }).toArray() : [],
    roomIds.length ? db.collection('rooms').find({ _id: { $in: roomIds } }, { projection: { _id: 1, name: 1 } }).toArray() : [],
    showtimeIds.length ? db.collection('showtimes').find({ _id: { $in: showtimeIds } }, { projection: { _id: 1, startAt: 1 } }).toArray() : []
  ]);
  const movieTitles = new Map(movies.map(item => [item._id, item.title]));
  const roomNames = new Map(rooms.map(item => [item._id, item.name]));
  const showtimeDates = new Map(showtimes.map(item => [item._id, item.startAt]));
  return items.map(item => ({ ...item, movieTitle: movieTitles.get(item.movieId) || null, roomName: roomNames.get(item.roomId) || null, startAt: item.startAt || showtimeDates.get(item.showtimeId) || null }));
}

export function registerAdminRoutes(app) {
  app.use('/api/admin', (req, res, next) => {
    if (!isLocalRequest(req)) return res.status(403).json({ error: 'Khu quản trị demo chỉ dùng qua kết nối local.' });
    const origin = req.get('origin');
    if (origin && !allowedAdminOrigins.has(origin)) return res.status(403).json({ error: 'Origin không được phép truy cập khu quản trị demo.' });
    next();
  });

  app.get('/api/admin/movies', async (_req, res, next) => {
    try { return res.json(await (await getDb()).collection('movies').find({}).sort({ title: 1 }).toArray()); }
    catch (error) { return next(error); }
  });

  app.get('/api/admin/analytics', async (_req, res, next) => {
    try {
      const db = await getDb();
      const [ticketsByMovie, revenueByDay, seatOccupancy] = await Promise.all([
        db.collection('bookings').aggregate([
          { $match: { status: 'CONFIRMED' } },
          { $unwind: '$seats' },
          { $group: { _id: '$movieId', ticketCount: { $sum: 1 }, totalAmountVnd: { $sum: '$seats.unitPriceVnd' } } },
          { $lookup: { from: 'movies', localField: '_id', foreignField: '_id', as: 'movie' } },
          { $unwind: { path: '$movie', preserveNullAndEmptyArrays: true } },
          { $project: { _id: 0, movieId: '$_id', movieTitle: { $ifNull: ['$movie.title', 'Không rõ phim'] }, ticketCount: 1, totalAmountVnd: 1 } },
          { $sort: { totalAmountVnd: -1 } }
        ]).toArray(),
        db.collection('bookings').aggregate([
          { $match: { status: 'CONFIRMED', 'payment.method': 'SIMULATED', 'payment.status': 'SUCCESS', 'payment.paidAt': { $type: 'date' } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$payment.paidAt', timezone: '+07:00' } }, bookingCount: { $sum: 1 }, totalAmountVnd: { $sum: '$totalAmountVnd' } } },
          { $sort: { _id: 1 } }
        ]).toArray(),
        db.collection('showtime_seats').aggregate([
          { $group: { _id: '$showtimeId', seatCount: { $sum: 1 }, bookedCount: { $sum: { $cond: [{ $eq: ['$status', 'BOOKED'] }, 1, 0] } } } },
          { $project: { _id: 0, showtimeId: '$_id', seatCount: 1, bookedCount: 1, bookedPercent: { $cond: [{ $eq: ['$seatCount', 0] }, 0, { $multiply: [{ $divide: ['$bookedCount', '$seatCount'] }, 100] }] } } },
          { $sort: { showtimeId: 1 } }
        ]).toArray()
      ]);
      return res.json({ ticketsByMovie, revenueByDay, seatOccupancy });
    } catch (error) { return next(error); }
  });

  app.post('/api/admin/movies', async (req, res, next) => {
    const parsed = readMovieInput(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    try {
      const movie = { _id: `MV-${randomUUID()}`, ...parsed.value };
      await (await getDb()).collection('movies').insertOne(movie);
      return res.status(201).json(movie);
    } catch (error) { return next(error); }
  });

  app.put('/api/admin/movies/:id', async (req, res, next) => {
    const parsed = readMovieInput(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    try {
      const movies = (await getDb()).collection('movies');
      const result = await movies.updateOne({ _id: req.params.id }, { $set: parsed.value });
      if (!result.matchedCount) return res.status(404).json({ error: 'Không tìm thấy phim.' });
      return res.json({ _id: req.params.id, ...parsed.value });
    } catch (error) { return next(error); }
  });

  app.delete('/api/admin/movies/:id', async (req, res, next) => {
    try {
      const db = await getDb();
      const movie = await db.collection('movies').findOne({ _id: req.params.id }, { projection: { _id: 1 } });
      if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim.' });
      const [showtimes, bookings] = await Promise.all([
        db.collection('showtimes').countDocuments({ movieId: req.params.id }),
        db.collection('bookings').countDocuments({ movieId: req.params.id })
      ]);
      if (showtimes || bookings) return res.status(409).json({ error: 'Không thể xóa phim đang được suất chiếu hoặc booking tham chiếu.' });
      await db.collection('movies').deleteOne({ _id: req.params.id });
      return res.json({ ok: true, deletedId: req.params.id });
    } catch (error) { return next(error); }
  });

  app.get('/api/admin/rooms', async (_req, res, next) => {
    try {
      const rooms = await (await getDb()).collection('rooms').find({}, { projection: { _id: 1, name: 1, seats: 1 } }).sort({ name: 1 }).toArray();
      return res.json(rooms.map(room => ({ _id: room._id, name: room.name, seatCount: Array.isArray(room.seats) ? room.seats.length : 0 })));
    } catch (error) { return next(error); }
  });

  app.get('/api/admin/showtimes', async (_req, res, next) => {
    try {
      const db = await getDb();
      const items = await db.collection('showtimes').find({}).sort({ startAt: 1 }).toArray();
      return res.json(await attachShowtimeDetails(db, items));
    } catch (error) { return next(error); }
  });

  app.post('/api/admin/showtimes', async (req, res, next) => {
    const parsed = readShowtimeInput(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    try {
      const db = await getDb();
      const problem = await checkSchedule(db, parsed.value);
      if (problem) return res.status(409).json({ error: problem });
      const room = await db.collection('rooms').findOne({ _id: parsed.value.roomId }, { projection: { seats: 1 } });
      const showtime = { _id: `ST-${randomUUID()}`, ...parsed.value };
      let showtimeInserted = false;
      try {
        await db.collection('showtimes').insertOne(showtime);
        showtimeInserted = true;
        const seatDocs = room.seats.map(seat => ({
          _id: `${showtime._id}_${seat.code}`,
          showtimeId: showtime._id,
          seatCode: seat.code,
          status: 'AVAILABLE',
          bookingId: null,
          holdExpiresAt: null
        }));
        await db.collection('showtime_seats').insertMany(seatDocs);
      } catch (error) {
        if (showtimeInserted) {
          try {
            await db.collection('showtime_seats').deleteMany({ showtimeId: showtime._id });
            await db.collection('showtimes').deleteOne({ _id: showtime._id });
          } catch (compensationError) { console.error('Showtime creation compensation failed:', compensationError.message); }
        }
        return next(error);
      }
      return res.status(201).json({ ...showtime, seatCount: room.seats.length });
    } catch (error) { return next(error); }
  });

  app.put('/api/admin/showtimes/:id', async (req, res, next) => {
    const parsed = readShowtimeInput(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    try {
      const db = await getDb();
      const showtimes = db.collection('showtimes');
      const current = await showtimes.findOne({ _id: req.params.id });
      if (!current) return res.status(404).json({ error: 'Không tìm thấy suất chiếu.' });
      if (parsed.value.roomId !== current.roomId) return res.status(400).json({ error: 'Không đổi phòng của suất đã có sơ đồ ghế; hãy tạo suất mới.' });
      const scheduleFieldsChanged = parsed.value.movieId !== current.movieId || parsed.value.startAt.getTime() !== new Date(current.startAt).getTime() || parsed.value.endAt.getTime() !== new Date(current.endAt).getTime();
      if (scheduleFieldsChanged && await db.collection('bookings').countDocuments({ showtimeId: current._id })) {
        return res.status(409).json({ error: 'Không thể đổi phim hoặc thời gian của suất đã có booking.' });
      }
      const problem = await checkSchedule(db, parsed.value, current._id);
      if (problem) return res.status(409).json({ error: problem });
      await showtimes.updateOne({ _id: current._id }, { $set: parsed.value });
      return res.json({ _id: current._id, ...parsed.value });
    } catch (error) { return next(error); }
  });

  app.delete('/api/admin/showtimes/:id', async (req, res, next) => {
    try {
      const db = await getDb();
      const showtime = await db.collection('showtimes').findOne({ _id: req.params.id }, { projection: { _id: 1 } });
      if (!showtime) return res.status(404).json({ error: 'Không tìm thấy suất chiếu.' });
      const [seats, bookings] = await Promise.all([
        db.collection('showtime_seats').countDocuments({ showtimeId: req.params.id }),
        db.collection('bookings').countDocuments({ showtimeId: req.params.id })
      ]);
      if (seats || bookings) return res.status(409).json({ error: 'Suất chiếu đã có dữ liệu ghế hoặc booking; hãy chuyển trạng thái sang CLOSED.' });
      await db.collection('showtimes').deleteOne({ _id: req.params.id });
      return res.json({ ok: true, deletedId: req.params.id });
    } catch (error) { return next(error); }
  });

  app.get('/api/admin/bookings', async (req, res, next) => {
    try {
      const filter = {};
      if (req.query.bookingId) filter._id = String(req.query.bookingId).trim();
      if (req.query.customerId) filter.customerId = String(req.query.customerId).trim();
      if (req.query.showtimeId) filter.showtimeId = String(req.query.showtimeId).trim();
      if (req.query.status) {
        const status = String(req.query.status);
        if (!bookingStatuses.has(status)) return res.status(400).json({ error: 'Trạng thái booking không hợp lệ.' });
        filter.status = status;
      }
      if (req.query.from || req.query.to) {
        const from = req.query.from ? new Date(String(req.query.from)) : null;
        const to = req.query.to ? new Date(String(req.query.to)) : null;
        if ((from && !Number.isFinite(from.getTime())) || (to && !Number.isFinite(to.getTime())) || (from && to && from >= to)) return res.status(400).json({ error: 'Khoảng ngày lọc không hợp lệ.' });
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = from;
        if (to) filter.createdAt.$lt = to;
      }
      const db = await getDb();
      const items = await db.collection('bookings').find(filter).sort({ createdAt: -1 }).limit(100).toArray();
      return res.json(await attachShowtimeDetails(db, items));
    } catch (error) { return next(error); }
  });
}
