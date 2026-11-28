import { api } from "./api/client.js";
import {
  escapeHtml as safe,
  modal,
  modalBusy,
  confirmDialog,
  toast,
} from "./ui.js";
import { posterStyle } from "./app/store.js";
import { containsText, compareId, latestRequest } from "./app/query.js";
const nextBookingsRequest = latestRequest();
const nextAdminRequest = latestRequest();

const state = {
  movies: [],
  rooms: [],
  customers: [],
  showtimes: [],
  bookings: [],
  analytics: null,
  loading: false,
  error: "",
  page: "dashboard",
  tab: "movies",
  filters: {},
  pages: {},
  bookingTotal: 0,
  bookingPages: 1,
};
const titles = {
  dashboard: "Tổng quan hoạt động",
  reports: "Báo cáo thống kê",
  movies: "Quản lý phim",
  rooms: "Phòng chiếu",
  showtimes: "Suất chiếu",
  customers: "Khách hàng",
  bookings: "Đơn đặt vé",
};
const money = (x) => new Intl.NumberFormat("vi-VN").format(x || 0) + " ₫";
const date = (x) =>
  x
    ? new Date(x).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
const day = (x) =>
  new Date(x).toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
const labels = {
  NOW_SHOWING: "Đang chiếu",
  COMING_SOON: "Sắp chiếu",
  OPEN: "Mở bán",
  CLOSED: "Đã đóng",
  CONFIRMED: "Đã xác nhận",
  CANCELLED: "Đã hủy",
  PENDING: "Đang xử lý",
  SUCCESS: "Thành công",
  FAILED: "Không thành công",
  AVAILABLE: "Còn trống",
  BOOKED: "Đã đặt",
  HELD: "Đang giữ chỗ",
};
const badge = (x) =>
  `<span class="status-badge status-${safe(x)}">${safe(labels[x] || "Chưa xác định")}</span>`;
const options = (items, value, label, selected = "") =>
  items
    .map(
      (x) =>
        `<option value="${safe(value(x))}" ${String(value(x)) === selected ? "selected" : ""}>${safe(label(x))}</option>`,
    )
    .join("");
const empty = (text) => `<div class="empty-panel">${text}</div>`;
const table = (headers, rows) =>
  rows.length
    ? `<div class="data-table-scroll"><table class="data-table"><thead><tr>${headers.map((x) => `<th scope="col">${x}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`
    : empty("Không có dữ liệu phù hợp.");
const action = (attr, id, text, cls = "text-button") =>
  `<button class="${cls}" ${attr}="${safe(id)}">${text}</button>`;

export function syncAdminRoute() {
  const key = location.hash.split("/")[2] || "dashboard";
  state.page = titles[key] ? key : "dashboard";
}
function filterValue(name) {
  return state.filters[state.page]?.[name] || "";
}
function filterField(name, label, control) {
  return `<label>${label}${control}</label>`;
}
function filters(fields) {
  return `<form class="filter-toolbar" id="admin-filters">${fields.join("")}<button type="reset" class="outline-button">Xóa bộ lọc</button></form>`;
}
const searchField = (label = "Tìm kiếm") =>
  filterField(
    "q",
    label,
    `<input type="search" name="q" value="${safe(filterValue("q"))}" placeholder="${label}">`,
  );
const selectField = (name, label, values) =>
  filterField(
    name,
    label,
    `<select name="${name}"><option value="">Tất cả</option>${values.map(([value, text]) => `<option value="${safe(value)}" ${filterValue(name) === value ? "selected" : ""}>${safe(text)}</option>`).join("")}</select>`,
  );
function paginate(items) {
  const page = state.pages[state.page] || 1;
  const totalPages = Math.max(1, Math.ceil(items.length / 10));
  state.pages[state.page] = Math.min(page, totalPages);
  const current = state.pages[state.page];
  return {
    items: items.slice((current - 1) * 10, current * 10),
    footer: pagination(items.length, current, totalPages),
  };
}
function pagination(total, page, pages) {
  const busy = state.page === "bookings" && state.bookingLoading;
  return `<div class="pagination"><span>${total} kết quả · Trang ${page}/${Math.max(1, pages)}</span><button class="outline-button" data-page="${page - 1}" ${busy || page <= 1 ? "disabled" : ""}>Trước</button><button class="outline-button" data-page="${page + 1}" ${busy || page >= pages ? "disabled" : ""}>Sau</button></div>`;
}
function bars(items, label, value, format = String) {
  const max = Math.max(1, ...items.map(value));
  return items.length
    ? `<div class="bar-chart">${items.map((item) => `<div class="bar-row" title="${safe(label(item))}: ${safe(format(value(item)))}"><span>${safe(label(item))}</span><div class="bar-track"><i style="width:${(value(item) / max) * 100}%"></i></div><strong>${safe(format(value(item)))}</strong></div>`).join("")}</div>`
    : empty("Chưa có dữ liệu thống kê.");
}
function donut(items) {
  const total = items.reduce((n, x) => n + x.bookingCount, 0);
  if (!total) return empty("Chưa có đơn đặt vé.");
  let offset = 0;
  const colors = ["#e11d48", "#16a34a", "#d97706"];
  return `<div class="donut-chart"><svg viewBox="0 0 120 120" role="img" aria-label="Phân bố trạng thái đơn đặt vé"><circle cx="60" cy="60" r="44" fill="none" stroke="#eef2f7" stroke-width="16"/>${items
    .map((x, i) => {
      const length = (x.bookingCount / total) * 276.46;
      const result = `<circle cx="60" cy="60" r="44" fill="none" stroke="${colors[i % 3]}" stroke-width="16" stroke-dasharray="${length} ${276.46 - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"><title>${labels[x._id]}: ${x.bookingCount} đơn</title></circle>`;
      offset += length;
      return result;
    })
    .join(
      "",
    )}<text x="60" y="62" text-anchor="middle" font-size="16" fill="currentColor">${total}</text><text x="60" y="78" text-anchor="middle" font-size="9" fill="currentColor">đơn đặt vé</text></svg><ul>${items.map((x, i) => `<li><i style="background:${colors[i % 3]}"></i>${labels[x._id]}: <strong>${x.bookingCount} đơn</strong></li>`).join("")}</ul></div>`;
}
function lineChart(items) {
  if (!items.length) return empty("Chưa có thanh toán trong dữ liệu hiện tại.");
  const max = Math.max(1, ...items.map((x) => x.totalAmountVnd));
  const points = items.map((x, i) => [
    30 + (i * 700) / Math.max(1, items.length - 1),
    175 - (x.totalAmountVnd / max) * 140,
  ]);
  return `<div class="line-chart"><svg viewBox="0 0 760 210" role="img" aria-label="Giá trị thanh toán mô phỏng theo ngày"><line x1="30" y1="180" x2="740" y2="180" stroke="#cbd5e1"/><polyline points="${points.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#e11d48" stroke-width="3"/>${points.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#e11d48"><title>${items[i]._id}: ${money(items[i].totalAmountVnd)}</title></circle>`).join("")}<text x="30" y="205" font-size="11">${safe(items[0]._id)}</text><text x="730" y="205" text-anchor="end" font-size="11">${safe(items.at(-1)._id)}</text></svg><small>Đơn vị: VND · Di chuột vào điểm để xem ngày và giá trị.</small></div>`;
}

function dashboard() {
  const a = state.analytics;
  if (!a) return empty("Đang tải thống kê…");
  const booked = a.seatOccupancy.reduce((n, x) => n + x.bookedCount, 0),
    capacity = a.seatOccupancy.reduce((n, x) => n + x.seatCount, 0);
  const metrics = [
    ["Đơn đặt vé", a.kpis.bookings, "đơn"],
    ["Vé đã xác nhận", a.kpis.confirmedTickets, "vé"],
    [
      "Giá trị đặt vé xác nhận",
      money(a.kpis.confirmedValueVnd),
      "Thanh toán mô phỏng",
    ],
    ["Khách hàng", a.kpis.customers, "hồ sơ"],
    ["Suất chiếu", a.kpis.showtimes, "suất"],
    [
      "Tỷ lệ ghế đã đặt",
      capacity ? `${((booked / capacity) * 100).toFixed(1)}%` : "0%",
      `${booked}/${capacity} ghế`,
    ],
  ];
  return `<div class="metric-grid">${metrics.map(([label, value, unit]) => `<article class="metric-card"><small>${label}</small><strong>${value}</strong><span>${unit}</span></article>`).join("")}</div><div class="dashboard-charts"><article class="chart-card"><div class="card-heading"><h2>Phim theo số vé xác nhận</h2><a class="text-button" href="#/admin/reports">Xem báo cáo</a></div>${bars(
    [...a.ticketsByMovie]
      .sort((x, y) => y.ticketCount - x.ticketCount)
      .slice(0, 7),
    (x) => x.movieTitle,
    (x) => x.ticketCount,
    (n) => `${n} vé`,
  )}</article><article class="chart-card"><h2>Trạng thái đơn đặt vé</h2>${donut(a.bookingsByStatus)}</article></div>`;
}

function movies() {
  const f = state.filters.movies || {};
  const genres = [...new Set(state.movies.flatMap((x) => x.genres))];
  const rows = state.movies
    .filter(
      (x) =>
        (!f.q ||
          containsText(x.title, f.q)) &&
        (!f.status || x.status === f.status) &&
        (!f.genre || x.genres.includes(f.genre)),
    )
    .sort(
      (a, b) =>
        (f.sort === "desc" ? -1 : 1) * (a.title.localeCompare(b.title, "vi") || compareId(a, b)),
    );
  const p = paginate(rows);
  return (
    filters([
      searchField("Tìm tên phim"),
      selectField("status", "Trạng thái", [
        ["NOW_SHOWING", "Đang chiếu"],
        ["COMING_SOON", "Sắp chiếu"],
      ]),
      selectField(
        "genre",
        "Thể loại",
        genres.map((x) => [x, x]),
      ),
      selectField("sort", "Tên phim", [
        ["asc", "A → Z"],
        ["desc", "Z → A"],
      ]),
    ]) +
    table(
      ["Phim", "Thể loại", "Thời lượng", "Trạng thái", "Thao tác"],
      p.items.map(
        (x) =>
          `<tr><td><button class="movie-cell text-button" data-movie-detail="${safe(x._id)}"><span class="mini-poster" style="${posterStyle(x)}"></span><strong>${safe(x.title)}</strong></button></td><td>${safe(x.genres.join(" · "))}</td><td>${x.durationMinutes} phút</td><td>${badge(x.status)}</td><td class="table-actions">${action("data-edit-movie", x._id, "Sửa")}${action("data-delete-movie", x._id, "Xóa", "text-button danger-text")}</td></tr>`,
      ),
    ) +
    p.footer
  );
}
function showtimes() {
  const f = state.filters.showtimes || {};
  const rows = state.showtimes
    .filter(
      (x) =>
        (!f.q ||
          containsText(x.movieTitle, f.q)) &&
        (!f.room || x.roomId === f.room) &&
        (!f.day || day(x.startAt) === f.day) &&
        (!f.status || x.status === f.status),
    )
    .sort(
      (a, b) =>
        (f.sort === "desc" ? -1 : 1) *
        (new Date(a.startAt) - new Date(b.startAt) || compareId(a, b)),
    );
  const p = paginate(rows);
  return (
    filters([
      searchField("Tìm phim"),
      selectField(
        "room",
        "Phòng",
        state.rooms.map((r) => [r._id, r.name]),
      ),
      filterField(
        "day",
        "Ngày chiếu",
        `<input type="date" name="day" value="${safe(f.day || "")}">`,
      ),
      selectField("status", "Trạng thái", [
        ["OPEN", "Mở bán"],
        ["CLOSED", "Đã đóng"],
      ]),
      selectField("sort", "Thời gian", [
        ["asc", "Sớm nhất"],
        ["desc", "Muộn nhất"],
      ]),
    ]) +
    table(
      [
        "Phim / Phòng",
        "Bắt đầu",
        "Kết thúc",
        "Giá vé",
        "Trạng thái",
        "Thao tác",
      ],
      p.items.map(
        (x) =>
          `<tr><td><strong>${safe(x.movieTitle)}</strong><small>${safe(x.roomName)}</small></td><td>${date(x.startAt)}</td><td>${date(x.endAt)}</td><td class="numeric">${money(x.basePriceVnd)}</td><td>${badge(x.status)}${new Date(x.startAt) <= new Date() ? "<small>Đã bắt đầu</small>" : ""}</td><td class="table-actions">${action("data-show-detail", x._id, "Xem ghế")}${action("data-edit-show", x._id, "Sửa")}${action("data-delete-show", x._id, "Xóa", "text-button danger-text")}</td></tr>`,
      ),
    ) +
    p.footer
  );
}
function customers() {
  const f = state.filters.customers || {};
  const rows = state.customers
    .filter(
      (c) =>
        !f.q ||
        containsText(`${c._id} ${c.fullName} ${c.email || ""}`, f.q),
    )
    .sort((a, b) =>
      f.sort === "count"
        ? b.bookingCount - a.bookingCount || compareId(a, b)
        : a.fullName.localeCompare(b.fullName, "vi") || compareId(a, b),
    );
  const p = paginate(rows);
  return (
    filters([
      searchField("Tên, mã hoặc email"),
      selectField("sort", "Sắp xếp", [
        ["name", "Tên A → Z"],
        ["count", "Nhiều đơn nhất"],
      ]),
    ]) +
    table(
      ["Khách hàng", "Email", "Ngày tạo", "Số đơn", "Thao tác"],
      p.items.map(
        (c) =>
          `<tr><td><strong>${safe(c.fullName)}</strong><small>${safe(c._id)}</small></td><td>${safe(c.email || "—")}</td><td>${date(c.createdAt)}</td><td class="numeric">${c.bookingCount}</td><td>${action("data-customer", c._id, "Xem chi tiết")}</td></tr>`,
      ),
    ) +
    p.footer
  );
}
function rooms() {
  return `<div class="room-grid">${state.rooms.map((r) => `<button class="room-card" data-room="${safe(r._id)}"><h2>${safe(r.name)}</h2><p>${safe(r._id)}</p><strong>${r.seatCount} ghế</strong><p>${state.showtimes.filter((s) => s.roomId === r._id).length} suất chiếu</p><span>Xem sơ đồ & lịch sử dụng →</span></button>`).join("")}</div>`;
}
function bookings() {
  const f = state.filters.bookings || {};
  return (
    filters([
      filterField(
        "bookingId",
        "Mã đơn",
        `<input name="bookingId" value="${safe(f.bookingId || "")}" placeholder="Nhập đầy đủ mã đơn">`,
      ),
      selectField(
        "customerId",
        "Khách hàng",
        state.customers.map((x) => [x._id, x.fullName]),
      ),
      selectField(
        "movieId",
        "Phim",
        state.movies.map((x) => [x._id, x.title]),
      ),
      selectField(
        "showtimeId",
        "Suất chiếu",
        state.showtimes.map((x) => [
          x._id,
          `${x.movieTitle} · ${date(x.startAt)}`,
        ]),
      ),
      selectField("status", "Trạng thái", [
        ["CONFIRMED", "Đã xác nhận"],
        ["CANCELLED", "Đã hủy"],
        ["PENDING", "Đang xử lý"],
      ]),
      filterField(
        "from",
        "Ngày đặt từ",
        `<input name="from" type="date" value="${safe(f.from || "")}">`,
      ),
      filterField(
        "to",
        "Đến ngày",
        `<input name="to" type="date" value="${safe(f.to || "")}">`,
      ),
      selectField("sort", "Ngày đặt", [
        ["desc", "Mới nhất"],
        ["asc", "Cũ nhất"],
      ]),
    ]) +
    (state.bookingLoading ? empty("Đang tải đơn đặt vé…") : state.bookingError ? empty(safe(state.bookingError)) : table(
      [
        "Đơn / Khách hàng",
        "Phim / Suất chiếu",
        "Số vé",
        "Tổng tiền",
        "Trạng thái",
        "Thanh toán",
        "Thao tác",
      ],
      state.bookings.map(
        (b) =>
          `<tr><td><strong>${safe(b._id)}</strong><small>${safe(state.customers.find((c) => c._id === b.customerId)?.fullName || b.customerId)}</small></td><td>${safe(b.movieTitle)}<small>${date(b.startAt)}</small></td><td class="numeric">${b.seats.length}</td><td class="numeric">${money(b.totalAmountVnd)}</td><td>${badge(b.status)}</td><td>${badge(b.payment?.status)}</td><td>${action("data-booking", b._id, "Chi tiết")}</td></tr>`,
      ),
    )) +
    pagination(
      state.bookingTotal,
      state.pages.bookings || 1,
      state.bookingPages,
    )
  );
}
function reports() {
  const a = state.analytics;
  if (!a) return empty("Đang tải báo cáo…");
  let content = "";
  if (state.tab === "movies")
    content = `<h2>Số vé đã xác nhận theo phim</h2>${bars(
      [...a.ticketsByMovie].sort((a, b) => b.ticketCount - a.ticketCount),
      (x) => x.movieTitle,
      (x) => x.ticketCount,
      (n) => `${n} vé`,
    )}${table(
      ["Phim", "Số vé", "Giá trị xác nhận"],
      a.ticketsByMovie.map(
        (x) =>
          `<tr><td>${safe(x.movieTitle)}</td><td class="numeric">${x.ticketCount}</td><td class="numeric">${money(x.totalAmountVnd)}</td></tr>`,
      ),
    )}<h2>Vé theo khung giờ chiếu Việt Nam</h2>${bars(
      a.ticketsByTimeSlot,
      (x) => x._id,
      (x) => x.ticketCount,
      (n) => `${n} vé`,
    )}`;
  if (state.tab === "payments")
    content = `<h2>Thanh toán mô phỏng theo ngày</h2>${lineChart(a.revenueByDay)}${table(
      ["Ngày thanh toán", "Số đơn", "Giá trị"],
      a.revenueByDay.map(
        (x) =>
          `<tr><td>${safe(x._id)}</td><td class="numeric">${x.bookingCount}</td><td class="numeric">${money(x.totalAmountVnd)}</td></tr>`,
      ),
    )}`;
  if (state.tab === "showtimes") {
    const p = paginate(a.seatOccupancy);
    content = `<h2>Tỷ lệ ghế đã đặt theo suất</h2>${table(
      ["Phim / Suất", "Đã đặt / Tổng ghế", "Tỷ lệ"],
      p.items.map((x) => {
        const s = state.showtimes.find((s) => s._id === x.showtimeId);
        return `<tr><td>${safe(s?.movieTitle || x.showtimeId)}<small>${date(s?.startAt)}</small></td><td class="numeric">${x.bookedCount} / ${x.seatCount}</td><td><progress value="${x.bookedCount}" max="${x.seatCount}" aria-label="Tỷ lệ ghế đã đặt"></progress> ${Number(x.bookedPercent).toFixed(1)}%</td></tr>`;
      }),
    )}${p.footer}`;
  }
  if (state.tab === "customers")
    content = `<h2>Trạng thái đơn đặt vé</h2>${donut(a.bookingsByStatus)}<h2>Khách hàng có nhiều đơn xác nhận</h2>${table(
      ["Khách hàng", "Số đơn", "Số vé", "Giá trị"],
      a.topCustomers.map(
        (x) =>
          `<tr><td>${safe(x.customerName)}</td><td class="numeric">${x.bookingCount}</td><td class="numeric">${x.ticketCount}</td><td class="numeric">${money(x.totalAmountVnd)}</td></tr>`,
      ),
    )}`;
  return `<div class="report-tabs" role="tablist">${[
    ["movies", "Phim"],
    ["payments", "Thanh toán"],
    ["showtimes", "Suất chiếu"],
    ["customers", "Đặt vé & khách hàng"],
  ]
    .map(
      ([id, label]) =>
        `<button role="tab" data-tab="${id}" aria-selected="${state.tab === id}" class="${state.tab === id ? "active" : ""}">${label}</button>`,
    )
    .join("")}</div><article class="report-content">${content}</article>`;
}

export function renderAdmin() {
  const renderers = {
    dashboard,
    reports,
    movies,
    rooms,
    showtimes,
    customers,
    bookings,
  };
  return `<div class="admin-page business-admin"><header class="topbar admin-topbar"><button class="outline-button admin-menu" aria-label="Mở menu quản trị">☰</button><strong>Hệ thống quản trị</strong><a class="text-button" href="#/">Quay lại website</a></header><nav class="admin-nav" aria-label="Điều hướng quản trị"><a href="#/admin/dashboard" class="admin-nav-brand"><span class="brand-mark">C</span><strong>CINEVUE</strong></a>${Object.entries(
    titles,
  )
    .map(
      ([id, label]) =>
        `<a class="admin-nav-link ${state.page === id ? "active" : ""}" href="#/admin/${id}">${label}</a>`,
    )
    .join(
      "",
    )}<small>Truy cập nội bộ trên máy này</small></nav><main class="admin-main"><header class="admin-page-header"><div><h1>${titles[state.page]}</h1><p>${state.page === "reports" ? "Giá trị thanh toán được ghi nhận trong môi trường mô phỏng." : "Theo dõi và quản lý hoạt động rạp chiếu phim."}</p></div><div class="table-actions">${state.page === "movies" ? '<button class="primary-button" id="new-movie">Thêm phim</button>' : state.page === "showtimes" ? '<button class="primary-button" id="new-show">Tạo suất chiếu</button>' : ""}<button class="outline-button" id="admin-refresh" ${state.loading ? "disabled" : ""}>Làm mới</button></div></header>${state.error ? `<div class="error-panel" role="alert">${safe(state.error)} <button class="outline-button" id="admin-retry">Thử lại</button></div>` : ""}${state.loading ? '<div class="loading-panel" role="status">Đang tải dữ liệu…</div>' : `<section class="admin-content">${renderers[state.page]()}</section>`}</main></div>`;
}
async function loadBookings() {
  const isCurrent = nextBookingsRequest();
  const f = { ...state.filters.bookings };
  state.bookingLoading = true;
  state.bookingError = "";
  const params = new URLSearchParams({
    page: String(state.pages.bookings || 1),
    pageSize: "10",
  });
  for (const key of [
    "bookingId",
    "customerId",
    "movieId",
    "showtimeId",
    "status",
    "sort",
  ])
    if (f[key]) params.set(key, f[key]);
  if (f.from) params.set("from", `${f.from}T00:00:00+07:00`);
  if (f.to) {
    const end = new Date(`${f.to}T00:00:00+07:00`);
    end.setUTCDate(end.getUTCDate() + 1);
    params.set("to", end.toISOString());
  }
  try {
    let result = await api(`/api/admin/bookings?${params}`);
    if (!isCurrent()) return;
    const last = Math.max(1, result.totalPages);
    if (Number(params.get("page")) > last) {
      params.set("page", String(last));
      result = await api(`/api/admin/bookings?${params}`);
      if (!isCurrent()) return;
    }
    state.pages.bookings = result.page;
    state.bookings = result.items;
    state.bookingTotal = result.total;
    state.bookingPages = Math.max(1, result.totalPages);
  } catch (e) {
    if (isCurrent()) {
      state.bookings = []; state.bookingError = e.message;
      state.bookingTotal = 0; state.bookingPages = 1; state.pages.bookings = 1;
    }
  } finally {
    if (isCurrent()) state.bookingLoading = false;
  }
}
export async function openAdmin(render) {
  const isCurrent = nextAdminRequest();
  state.loading = true;
  state.error = "";
  render();
  try {
    const [movies, rooms, customers, showtimes, analytics] = await Promise.all(
      ["/movies", "/rooms", "/customers", "/showtimes", "/analytics"].map((p) =>
        api("/api/admin" + p),
      ),
    );
    if (!isCurrent()) return;
    Object.assign(state, { movies, rooms, customers, showtimes, analytics });
    await loadBookings();
  } catch (e) {
    if (isCurrent()) state.error = e.message;
  } finally {
    if (isCurrent()) { state.loading = false; render(); }
  }
}

function detailBooking(b) {
  const customer = state.customers.find((x) => x._id === b.customerId);
  const d = modal(
    "Chi tiết đơn đặt vé",
    `<div class="print-ticket"><h2>${safe(b.movieTitle)}</h2><dl class="detail-grid">${[
      ["Mã đơn", b._id],
      ["Khách hàng", customer?.fullName || b.customerId],
      ["Suất chiếu", date(b.startAt)],
      ["Ghế", b.seats.map((x) => x.seatCode).join(", ")],
      ["Số vé", b.seats.length],
      ["Tổng tiền", money(b.totalAmountVnd)],
      ["Trạng thái đơn", labels[b.status]],
      ["Thanh toán mô phỏng", labels[b.payment?.status]],
      ["Ngày đặt", date(b.createdAt)],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${safe(v)}</dd></div>`)
      .join(
        "",
      )}</dl></div><button class="outline-button" id="print-order">In chi tiết đơn</button>`,
  );
  d.querySelector("#print-order").onclick = () => window.print();
}
async function detailRoom(id) {
  try {
    const r = await api(`/api/rooms/${encodeURIComponent(id)}`);
    modal(
      r.name,
      `<p>${safe(r._id)} · ${r.capacity} ghế</p><div class="cinema-screen">MÀN HÌNH</div><div class="inspect-seat-map">${r.seats.map((s) => `<span class="inspect-seat">${safe(s.code)}</span>`).join("")}</div><h3>Lịch sử dụng phòng</h3>${table(
        ["Phim", "Bắt đầu", "Kết thúc"],
        r.showtimes.map(
          (s) =>
            `<tr><td>${safe(state.movies.find((m) => m._id === s.movieId)?.title || s.movieId)}</td><td>${date(s.startAt)}</td><td>${date(s.endAt)}</td></tr>`,
        ),
      )}`,
    );
  } catch (e) {
    toast(e.message, "error");
  }
}
async function detailShow(id) {
  try {
    const s = state.showtimes.find((x) => x._id === id),
      seats = await api(`/api/showtimes/${encodeURIComponent(id)}/seats`);
    modal(
      "Sơ đồ ghế · " + s.movieTitle,
      `<p>${safe(s.roomName)} · ${date(s.startAt)} · ${money(s.basePriceVnd)}</p><p>Còn trống: ${seats.filter((x) => x.status === "AVAILABLE").length} · Đang giữ: ${seats.filter((x) => x.status === "HELD").length} · Đã đặt: ${seats.filter((x) => x.status === "BOOKED").length}</p><div class="cinema-screen">MÀN HÌNH</div><div class="inspect-seat-map">${seats.map((x) => `<span class="inspect-seat ${x.status.toLowerCase()}" title="${labels[x.status]}" aria-label="Ghế ${safe(x.seatCode)}: ${labels[x.status]}">${safe(x.seatCode)}<small>${x.status === "BOOKED" ? "×" : x.status === "HELD" ? "◷" : "○"}</small></span>`).join("")}</div><p>Sơ đồ chỉ hiển thị trạng thái. Trạng thái ghế được cập nhật thông qua quy trình đặt và hủy vé.</p>`,
    );
  } catch (e) {
    toast(e.message, "error");
  }
}
async function detailCustomer(id) {
  try {
    const c = state.customers.find((x) => x._id === id),
      rows = await api(
        `/api/customers/${encodeURIComponent(id)}/bookings/details`,
      );
    const d = modal(
      c.fullName,
      `<p>${safe(c._id)} · ${safe(c.email || "")} · Tạo ${date(c.createdAt)}</p><h3>${rows.length} đơn đặt vé</h3><div class="inspect-list">${rows.length ? rows.map((b) => `<button class="profile-option" data-order-id="${safe(b._id)}"><strong>${safe(b.movieTitle)}</strong><small>${date(b.startAt)} · ${labels[b.status]} · ${money(b.totalAmountVnd)}</small></button>`).join("") : empty("Khách hàng chưa có đơn đặt vé.")}</div>`,
    );
    d.querySelectorAll("[data-order-id]").forEach(
      (button) =>
        (button.onclick = () => {
          const b = rows.find((x) => x._id === button.dataset.orderId);
          d.close();
          detailBooking(b);
        }),
    );
  } catch (e) {
    toast(e.message, "error");
  }
}
function movieDetail(id) {
  const m = state.movies.find((x) => x._id === id);
  modal(
    m.title,
    `<div class="movie-modal"><div class="detail-poster" style="${posterStyle(m)}"></div><div>${badge(m.status)}<p>${safe(m.genres.join(" · "))} · ${m.durationMinutes} phút</p><p>${safe(m.synopsis)}</p><a href="#/movies/${safe(m._id)}" class="outline-button" id="public-movie">Xem trang phim</a></div></div>`,
  ).querySelector("#public-movie").onclick = () =>
    document.querySelector(".content-dialog").close();
}

function movieForm(id, render) {
  const m = state.movies.find((x) => x._id === id);
  const d = modal(
    m ? "Sửa phim" : "Thêm phim",
    `<form class="business-form" id="movie-form"><label>Tên phim<input name="title" required maxlength="160" value="${safe(m?.title || "")}"></label><label>Thể loại, cách nhau bằng dấu phẩy<input name="genres" required value="${safe(m?.genres.join(", ") || "")}"></label><label>Thời lượng (phút)<input name="durationMinutes" type="number" required min="1" max="600" value="${m?.durationMinutes || ""}"></label><label>Trạng thái<select name="status"><option value="NOW_SHOWING">Đang chiếu</option><option value="COMING_SOON" ${m?.status === "COMING_SOON" ? "selected" : ""}>Sắp chiếu</option></select></label><label class="wide-field">Nội dung phim<textarea name="synopsis" maxlength="2000" rows="4">${safe(m?.synopsis || "")}</textarea></label><label class="wide-field">Ảnh áp phích<input name="poster" type="file" accept="image/jpeg,image/png,image/webp"><small>JPEG, PNG hoặc WebP. Ảnh được thu nhỏ trước khi lưu.</small><div class="poster-preview mini-poster" style="${posterStyle(m || { _id: "MV001" })}"></div></label><p class="inline-error wide-field" role="alert"></p><div class="form-actions"><button class="primary-button" type="submit">Lưu phim</button><button type="button" class="outline-button" data-dismiss>Hủy</button></div></form>`,
  );
  let poster = m?.posterImage || "",
    imageReady = Promise.resolve();
  const form = d.querySelector("form");
  form.querySelector("[data-dismiss]").onclick = () => d.close();
  const error = form.querySelector(".inline-error");
  form.elements.poster.onchange = () => {
    const file = form.elements.poster.files[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      error.textContent = "Chọn ảnh JPEG, PNG hoặc WebP.";
      form.elements.poster.value = "";
      return;
    }
    imageReady = new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file),
        img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, 900 / img.width, 1350 / img.height),
          canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas
          .getContext("2d")
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL("image/jpeg", 0.8);
        URL.revokeObjectURL(url);
        if (data.length > 1500000) {
          error.textContent = "Ảnh quá lớn. Vui lòng chọn ảnh khác.";
          reject(new Error(error.textContent));
          return;
        }
        poster = data;
        form.querySelector(".poster-preview").style.cssText =
          `background-image:url('${data}');background-size:cover;background-position:center`;
        error.textContent = "";
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        error.textContent = "Không thể đọc ảnh.";
        reject(new Error(error.textContent));
      };
      img.src = url;
    });
    imageReady.catch(() => {});
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    modalBusy(d, true);
    try {
      await imageReady;
      const f = Object.fromEntries(new FormData(form));
      await api(
        id
          ? `/api/admin/movies/${encodeURIComponent(id)}`
          : "/api/admin/movies",
        {
          method: id ? "PUT" : "POST",
          body: JSON.stringify({
            title: f.title.trim(),
            genres: f.genres.split(",").map((x) => x.trim()),
            durationMinutes: Number(f.durationMinutes),
            status: f.status,
            synopsis: f.synopsis,
            posterImage: poster,
          }),
        },
      );
      d.close();
      toast("Đã lưu phim.");
      await openAdmin(render);
    } catch (e) {
      error.textContent = e.message;
    } finally {
      button.disabled = false;
      modalBusy(d, false);
    }
  };
}
function showForm(id, render) {
  const s = state.showtimes.find((x) => x._id === id),
    local = (x) => {
      const d = new Date(x);
      return Number.isFinite(d.getTime())
        ? new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
        : "";
    };
  const d = modal(
    s ? "Sửa suất chiếu" : "Tạo suất chiếu",
    `<form class="business-form"><label>Phim<select name="movieId">${options(
      state.movies,
      (x) => x._id,
      (x) => x.title,
      s?.movieId,
    )}</select></label><label>Phòng<select name="roomId" ${s ? "disabled" : ""}>${options(
      state.rooms,
      (x) => x._id,
      (x) => `${x.name} · ${x.seatCount} ghế`,
      s?.roomId,
    )}</select></label><label>Bắt đầu<input name="startAt" type="datetime-local" required value="${local(s?.startAt)}"></label><label>Kết thúc<input name="endAt" type="datetime-local" required readonly value="${local(s?.endAt)}"><small>Tính theo thời lượng phim.</small></label><label>Giá vé (VND)<input name="basePriceVnd" type="number" min="0" step="1" required value="${s?.basePriceVnd ?? ""}"></label><label>Trạng thái<select name="status"><option value="OPEN">Mở bán</option><option value="CLOSED" ${s?.status === "CLOSED" ? "selected" : ""}>Đã đóng</option></select></label><p class="wide-field">Giữ nguyên phòng của suất hiện có. Suất đã có đơn đặt vé được bảo toàn phim và thời gian.</p><p class="inline-error wide-field" role="alert"></p><div class="form-actions"><button class="primary-button" type="submit">Lưu suất chiếu</button><button type="button" class="outline-button" data-dismiss>Hủy</button></div></form>`,
  );
  const form = d.querySelector("form");
  form.querySelector("[data-dismiss]").onclick = () => d.close();
  const update = () => {
    const movie = state.movies.find(
        (x) => x._id === form.elements.movieId.value,
      ),
      at = new Date(form.elements.startAt.value);
    if (movie && Number.isFinite(at.getTime()))
      form.elements.endAt.value = local(
        new Date(at.getTime() + movie.durationMinutes * 60000),
      );
  };
  form.elements.startAt.onchange = update;
  form.elements.movieId.onchange = update;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    modalBusy(d, true);
    try {
      const f = Object.fromEntries(new FormData(form));
      await api(
        id
          ? `/api/admin/showtimes/${encodeURIComponent(id)}`
          : "/api/admin/showtimes",
        {
          method: id ? "PUT" : "POST",
          body: JSON.stringify({
            ...f,
            roomId: s?.roomId || f.roomId,
            startAt: new Date(f.startAt).toISOString(),
            endAt: new Date(f.endAt).toISOString(),
            basePriceVnd: Number(f.basePriceVnd),
          }),
        },
      );
      d.close();
      toast("Đã lưu suất chiếu.");
      await openAdmin(render);
    } catch (e) {
      form.querySelector(".inline-error").textContent = e.message;
    } finally {
      button.disabled = false;
      modalBusy(d, false);
    }
  };
}

export function bindAdminEvents(render) {
  document
    .querySelector(".admin-menu")
    ?.addEventListener("click", () =>
      document.querySelector(".business-admin").classList.toggle("menu-open"),
    );
  for (const id of ["admin-refresh", "admin-retry"])
    document
      .getElementById(id)
      ?.addEventListener("click", () => openAdmin(render));
  document
    .querySelector("#new-movie")
    ?.addEventListener("click", () => movieForm("", render));
  document
    .querySelector("#new-show")
    ?.addEventListener("click", () => showForm("", render));
  const form = document.querySelector("#admin-filters");
  if (form) {
    let timer;
    const update = async () => {
      if (!form.isConnected) return;
      const page = state.page;
      state.filters[page] = Object.fromEntries(new FormData(form));
      state.pages[page] = 1;
      if (page === "bookings") {
        try {
          const pending = loadBookings();
          render();
          await pending;
        } catch (e) {
          toast(e.message, "error");
        }
      }
      if (state.page === page) {
        const focus = document.activeElement?.name,
          position = document.activeElement?.selectionStart;
        render();
        const input = document.querySelector(
          `#admin-filters [name="${focus}"]`,
        );
        input?.focus();
        if (position != null && input?.setSelectionRange)
          input.setSelectionRange(position, position);
      }
    };
    form.oninput = (e) => {
      clearTimeout(timer);
      if (e.target.tagName === "INPUT" && e.target.type === "search")
        timer = setTimeout(update, 250);
    };
    form.onchange = (e) => {
      if (e.target.type === "search") return;
      clearTimeout(timer);
      timer = setTimeout(update, 0);
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      clearTimeout(timer);
      update();
    };
    form.onreset = (event) => {
      event.preventDefault();
      // Re-rendered controls have the active filter as their HTML defaults.
      // Native reset would restore that same filter instead of clearing it.
      for (const control of form.querySelectorAll("input, select")) control.value = "";
      clearTimeout(timer);
      update();
    };
  }
  document.querySelectorAll("[data-page]").forEach(
    (b) =>
      (b.onclick = async () => {
        state.pages[state.page] = Number(b.dataset.page);
        if (state.page === "bookings") {
          try {
            const pending = loadBookings();
            render();
            await pending;
          } catch (e) {
            toast(e.message, "error");
          }
        }
        render();
      }),
  );
  document.querySelectorAll("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        state.tab = b.dataset.tab;
        state.pages.reports = 1;
        render();
      }),
  );
  const bind = (attr, handler) =>
    document
      .querySelectorAll(`[${attr}]`)
      .forEach((b) => (b.onclick = () => handler(b.getAttribute(attr), b)));
  bind("data-movie-detail", movieDetail);
  bind("data-edit-movie", (id) => movieForm(id, render));
  bind("data-edit-show", (id) => showForm(id, render));
  bind("data-room", detailRoom);
  bind("data-show-detail", detailShow);
  bind("data-customer", detailCustomer);
  bind("data-booking", (id) =>
    detailBooking(state.bookings.find((x) => x._id === id)),
  );
  const remove = async (type, id, button) => {
    const item = state[type].find((x) => x._id === id);
    if (
      !(await confirmDialog({
        title: type === "movies" ? "Xóa phim" : "Xóa suất chiếu",
        message:
          type === "movies"
            ? "Chỉ có thể xóa phim chưa được sử dụng trong suất chiếu hoặc đơn đặt vé."
            : "Chỉ có thể xóa suất chưa có dữ liệu ghế hoặc đơn đặt vé. Suất đã sử dụng nên được đóng bán.",
        summary: item.title || `${item.movieTitle} · ${date(item.startAt)}`,
        confirmLabel: "Xác nhận xóa",
      }))
    )
      return;
    button.disabled = true;
    try {
      await api(`/api/admin/${type}/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      toast("Đã xóa.");
      await openAdmin(render);
    } catch (e) {
      toast(e.message, "error");
      button.disabled = false;
    }
  };
  bind("data-delete-movie", (id, b) => remove("movies", id, b));
  bind("data-delete-show", (id, b) => remove("showtimes", id, b));
}
