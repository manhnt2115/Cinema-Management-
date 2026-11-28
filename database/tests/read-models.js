import "dotenv/config";
import assert from "node:assert/strict";
import { MongoClient } from "mongodb";

const database = process.env.MONGODB_DB_NAME;
const base = process.env.TEST_API_BASE_URL || "http://127.0.0.1:3002";
assert(
  database?.startsWith("cinema_management_test_"),
  "Chỉ kiểm thử trên database QA.",
);
const client = new MongoClient(
  process.env.MONGODB_URI || "mongodb://localhost:27017",
);
const checks = [];
async function get(route) {
  const response = await fetch(base + route);
  assert.equal(response.status, 200, route);
  return response.json();
}
function equal(name, actual, expected) {
  assert.deepEqual(actual, expected, name);
  checks.push(name);
}
try {
  await client.connect();
  const db = client.db(database);
  equal(
    "API trỏ đúng database QA",
    (await get("/api/health")).database,
    database,
  );
  const [bookings, movies, seats, shows, customers, report] = await Promise.all(
    [
      ...["bookings", "movies", "showtime_seats", "showtimes", "customers"].map(
        (name) => db.collection(name).find({}).toArray(),
      ),
      get("/api/admin/analytics"),
    ],
  );
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED");
  const movieGroups = new Map();
  const dayGroups = new Map();
  const timeGroups = new Map();
  const customerGroups = new Map();
  const statusGroups = new Map();
  const add = (map, key, b) => {
    const item = map.get(key) || {
      bookingCount: 0,
      ticketCount: 0,
      totalAmountVnd: 0,
    };
    item.bookingCount++;
    item.ticketCount += b.seats.length;
    item.totalAmountVnd += b.totalAmountVnd;
    map.set(key, item);
  };
  for (const b of bookings) add(statusGroups, b.status, b);
  for (const b of confirmed) {
    add(movieGroups, b.movieId, b);
    add(customerGroups, b.customerId, b);
    if (b.payment.status === "SUCCESS" && b.payment.paidAt) {
      const key = new Date(b.payment.paidAt.getTime() + 7 * 3600000)
        .toISOString()
        .slice(0, 10);
      add(dayGroups, key, b);
    }
    const show = shows.find((s) => s._id === b.showtimeId);
    const hour = new Date(show.startAt.getTime() + 7 * 3600000).getUTCHours();
    add(
      timeGroups,
      hour < 12
        ? "Sáng"
        : hour < 17
          ? "Trưa/Chiều"
          : hour < 21
            ? "Tối"
            : "Khuya",
      b,
    );
  }
  equal(
    "Số vé và giá trị theo phim",
    [...report.ticketsByMovie].sort((a, b) =>
      a.movieId.localeCompare(b.movieId),
    ),
    [...movieGroups]
      .map(([movieId, x]) => ({
        movieId,
        movieTitle: movies.find((m) => m._id === movieId).title,
        ticketCount: x.ticketCount,
        totalAmountVnd: x.totalAmountVnd,
      }))
      .sort((a, b) => a.movieId.localeCompare(b.movieId)),
  );
  equal(
    "Thanh toán theo ngày Việt Nam",
    report.revenueByDay,
    [...dayGroups]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_id, x]) => ({
        _id,
        bookingCount: x.bookingCount,
        totalAmountVnd: x.totalAmountVnd,
      })),
  );
  for (const row of report.seatOccupancy) {
    const all = seats.filter((s) => s.showtimeId === row.showtimeId),
      booked = all.filter((s) => s.status === "BOOKED").length;
    equal(
      "Ghế " + row.showtimeId,
      [row.seatCount, row.bookedCount],
      [all.length, booked],
    );
    assert(Math.abs(row.bookedPercent - (booked / all.length) * 100) < 1e-9);
  }
  equal(
    "Vé theo khung giờ",
    report.ticketsByTimeSlot,
    [...timeGroups]
      .map(([_id, x]) => ({
        _id,
        ticketCount: x.ticketCount,
        totalAmountVnd: x.totalAmountVnd,
      }))
      .sort(
        (a, b) => b.ticketCount - a.ticketCount || a._id.localeCompare(b._id),
      ),
  );
  equal(
    "Đơn theo trạng thái",
    report.bookingsByStatus,
    [...statusGroups]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_id, x]) => ({ _id, ...x })),
  );
  equal(
    "Khách hàng đặt nhiều",
    report.topCustomers,
    [...customerGroups]
      .map(([customerId, x]) => ({
        customerId,
        customerName: customers.find((c) => c._id === customerId).fullName,
        ...x,
      }))
      .sort(
        (a, b) =>
          b.bookingCount - a.bookingCount ||
          b.ticketCount - a.ticketCount ||
          a.customerId.localeCompare(b.customerId),
      )
      .slice(0, 10),
  );
  equal(
    "KPI xác nhận",
    [report.kpis.confirmedTickets, report.kpis.confirmedValueVnd],
    [
      confirmed.reduce((n, b) => n + b.seats.length, 0),
      confirmed.reduce((n, b) => n + b.totalAmountVnd, 0),
    ],
  );
  const schedule = await get("/api/schedule");
  equal("Lịch chiếu đủ dữ liệu thật", schedule.length, shows.length);
  for (const s of schedule) {
    assert.equal(s.movieTitle, movies.find((m) => m._id === s.movieId).title);
    assert.equal(
      s.bookable,
      s.status === "OPEN" &&
        s.movieStatus === "NOW_SHOWING" &&
        new Date(s.startAt) > new Date(),
    );
  }
  const newest = await get("/api/admin/bookings?page=1&pageSize=7&sort=desc");
  const oldest = await get("/api/admin/bookings?page=1&pageSize=7&sort=asc");
  assert(
    new Date(newest.items[0].createdAt) >= new Date(oldest.items[0].createdAt),
  );
  checks.push("Sắp xếp đơn và lịch chiếu hợp lệ");
  console.log(
    JSON.stringify({ database, passed: checks.length, checks }, null, 2),
  );
} finally {
  await client.close();
}
