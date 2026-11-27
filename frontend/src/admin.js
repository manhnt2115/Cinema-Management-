import { confirmDialog } from './ui.js';

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const state = { movies: [], rooms: [], customers: [], showtimes: [], bookings: [], analytics: null, reportTab: 'movies', showtimeFilters: { movieId: '', roomId: '', day: '', status: '' }, showtimeSeatCounts: {}, loadingShowtimeId: '', bookingFilters: { bookingId: '', customerId: '', showtimeId: '', status: '', from: '', to: '' }, loading: false, error: '', notice: '', bookingSearched: false, editingMovieId: '', editingShowtimeId: '', page: 'overview', explorer: { bookingFilters: { bookingId: '', customerId: '', showtimeId: '', status: 'ALL', from: '', to: '' }, bookingResults: [], bookingSearched: false, seatShowtimeId: '', seatStatus: 'ALL', seatResults: [], seatSearched: false, aggregation: 'ticketsByMovie', aggregationResult: null, busy: false, error: '' } };
const money = value => new Intl.NumberFormat('vi-VN').format(value || 0) + ' ₫';
const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const formatDate = value => { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; };
const bookingStatusLabel = value => ({ CONFIRMED: 'Đã xác nhận', CANCELLED: 'Đã hủy', PENDING: 'Đang xử lý' }[value] || value || 'Không rõ');
const adminRoutes = { dashboard: 'overview', reports: 'reports', movies: 'movies', rooms: 'rooms', showtimes: 'showtimes', customers: 'customers', bookings: 'bookings', 'data-explorer': 'explorer' };
export function syncAdminRoute(hash = location.hash) { const key = hash.replace(/^#\/admin\/?/, '') || 'dashboard'; state.page = adminRoutes[key] || 'overview'; }
const routeForPage = page => ({ overview: 'dashboard', explorer: 'data-explorer' }[page] || page);

async function request(path, options) {
  const method=(options?.method||'GET').toUpperCase();const attempts=method==='GET'?3:1;
  for(let attempt=1;attempt<=attempts;attempt+=1){try{const response=await fetch(`${API}${path}`,{...options,headers:{...(options?.body?{'Content-Type':'application/json'}:{}),...options?.headers}});const data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(data.error||'Không thể hoàn tất yêu cầu.'),{status:response.status});return data;}catch(error){if(error.status||attempt===attempts)throw error;await new Promise(resolve=>setTimeout(resolve,250*attempt));}}
}
async function reloadAdmin() {
  state.loading = true; state.error = '';
  try {
    const [movies, rooms, customers, showtimes, analytics] = await Promise.all([
      request('/api/admin/movies'), request('/api/admin/rooms'), request('/api/admin/customers'), request('/api/admin/showtimes'), request('/api/admin/analytics')
    ]);
    state.movies = movies; state.rooms = rooms; state.customers = customers; state.showtimes = showtimes; state.analytics = analytics;
  } catch (error) { state.error = error.message; }
  finally { state.loading = false; }
}
function localInputValue(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function renderMovieList() {
  if (state.loading && !state.movies.length) return '<div class="state-card" role="status">Đang tải phim…</div>';
  if (!state.movies.length) return '<div class="state-card">Chưa có phim.</div>';
  return `<div class="admin-record-list">${state.movies.map(movie => `<article class="admin-record"><div><strong>${safe(movie.title)}</strong><small>${safe((movie.genres || []).join(' · '))} · ${safe(movie.durationMinutes)} phút · ${safe(movie.status)}</small><small>${safe(movie._id)}</small></div><div class="admin-record-actions"><button class="text-button" data-edit-movie="${safe(movie._id)}">Sửa</button><button class="text-button danger-text" data-delete-movie="${safe(movie._id)}">Xóa</button></div></article>`).join('')}</div>`;
}
function renderShowtimeList() {
  if (state.loading && !state.showtimes.length) return '<div class="state-card" role="status">Đang tải suất chiếu…</div>';
  if (!state.showtimes.length) return '<div class="state-card">Chưa có suất chiếu.</div>';
  const filters = state.showtimeFilters;
  const items = state.showtimes.filter(show => (!filters.movieId || show.movieId === filters.movieId) && (!filters.roomId || show.roomId === filters.roomId) && (!filters.status || show.status === filters.status) && (!filters.day || new Date(show.startAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }) === filters.day));
  const dayChoices = [...new Set(state.showtimes.map(show => new Date(show.startAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })))].sort();
  const filterBar = `<div class="showtime-filterbar"><label>Phim<select name="movieId"><option value="">Tất cả phim</option>${state.movies.map(movie => `<option value="${safe(movie._id)}" ${filters.movieId === movie._id ? 'selected' : ''}>${safe(movie.title)}</option>`).join('')}</select></label><label>Ngày<select name="day"><option value="">Tất cả ngày</option>${dayChoices.map(day => `<option value="${day}" ${filters.day === day ? 'selected' : ''}>${new Date(`${day}T12:00:00+07:00`).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}</option>`).join('')}</select></label><label>Phòng<select name="roomId"><option value="">Tất cả phòng</option>${state.rooms.map(room => `<option value="${safe(room._id)}" ${filters.roomId === room._id ? 'selected' : ''}>${safe(room.name)}</option>`).join('')}</select></label><label>Trạng thái<select name="status"><option value="">Tất cả trạng thái</option><option value="OPEN" ${filters.status === 'OPEN' ? 'selected' : ''}>Mở bán</option><option value="CLOSED" ${filters.status === 'CLOSED' ? 'selected' : ''}>Đã đóng</option></select></label></div>`;
  if (!items.length) return `${filterBar}<div class="state-card">Không có suất chiếu khớp bộ lọc.</div>`;
  return `${filterBar}<p class="explorer-label">Đang hiển thị ${items.length}/${state.showtimes.length} suất chiếu</p><div class="admin-record-list">${items.map(show => { const counts = state.showtimeSeatCounts[show._id]; const occupancy = counts ? `<small>Ghế: ${counts.AVAILABLE || 0} trống · ${counts.HELD || 0} đang giữ · ${counts.BOOKED || 0} đã đặt</small>` : ''; return `<article class="admin-record"><div><strong>${safe(show.movieTitle || show.movieId)} · ${formatDate(show.startAt)}</strong><small>${safe(show._id)} · ${safe(show.roomName || show.roomId)} · ${money(show.basePriceVnd)} / vé</small><small>Trạng thái ${safe(show.status)}</small>${occupancy}</div><div class="admin-record-actions"><button class="text-button" data-showtime-seats="${safe(show._id)}" ${state.loadingShowtimeId === show._id ? 'disabled' : ''}>${state.loadingShowtimeId === show._id ? 'Đang tải…' : counts ? 'Cập nhật ghế' : 'Tình trạng ghế'}</button><button class="text-button" data-edit-showtime="${safe(show._id)}">Sửa</button><button class="text-button danger-text" data-delete-showtime="${safe(show._id)}">Xóa</button></div></article>`; }).join('')}</div>`;
}
function renderBookings() {
  if (!state.bookingSearched) return '<div class="state-card">Nhập bộ lọc rồi chọn “Tra cứu” để xem booking.</div>';
  if (!state.bookings.length) return '<div class="state-card">Không tìm thấy booking phù hợp.</div>';
  return `<div class="admin-record-list">${state.bookings.map(item => `<article class="admin-record booking-record"><div><strong>${safe(item.movieTitle || item.movieId)} · ${safe(item._id)}</strong><small>Khách ${safe(item.customerId)} · suất ${safe(item.showtimeId)} · ${formatDate(item.startAt)}</small><small>Ghế ${(item.seats || []).map(seat => safe(seat.seatCode)).join(', ') || '—'} · ${bookingStatusLabel(item.status)}</small></div><div class="admin-record-total"><strong>${money(item.totalAmountVnd)}</strong><small>${safe(item.payment?.method || '—')} · ${safe(item.payment?.status || '—')}</small></div></article>`).join('')}</div>`;
}
function analyticsValues(){const a=state.analytics||{};const tickets=(a.ticketsByMovie||[]).reduce((sum,x)=>sum+(x.ticketCount||0),0);const value=(a.revenueByDay||[]).reduce((sum,x)=>sum+(x.totalAmountVnd||0),0);const booked=(a.seatOccupancy||[]).reduce((sum,x)=>sum+(x.bookedCount||0),0);const capacity=(a.seatOccupancy||[]).reduce((sum,x)=>sum+(x.seatCount||0),0);return{...a,tickets,value,booked,capacity};}
function barChart(items,label,value,format=String){const max=Math.max(0,...items.map(value));if(!items.length||!max)return '<div class="state-card">Chưa có dữ liệu để hiển thị.</div>';return `<div class="bar-chart">${items.slice(0,7).map(item=>`<div class="bar-row"><span title="${safe(label(item))}">${safe(label(item))}</span><div class="bar-track"><i style="width:${Math.max(3,value(item)/max*100)}%"></i></div><strong>${safe(format(value(item)))}</strong></div>`).join('')}</div>`;}
function renderDashboard(){if(!state.analytics)return '<div class="state-card">Đang tải thống kê…</div>';const a=analyticsValues();const k=a.kpis||{};const cards=[['Đơn đặt vé',k.bookings||0,'đơn'],['Vé đã xác nhận',a.tickets,'vé'],['Giá trị xác nhận',money(a.value),''],['Khách hàng',k.customers||0,'hồ sơ'],['Phim',k.movies||0,'phim'],['Tỷ lệ ghế đã đặt',a.capacity?`${(a.booked/a.capacity*100).toFixed(1)}%`:'—',`${a.booked}/${a.capacity} ghế`]];return `<div class="metric-grid">${cards.map(([label,value,unit])=>`<article class="metric-card"><small>${label}</small><strong>${value}</strong><span>${unit}</span></article>`).join('')}</div><div class="dashboard-charts"><article class="chart-card"><div class="card-heading"><div><h3>Top phim theo số vé</h3><small>Vé thuộc đơn đã xác nhận</small></div><button class="text-button" data-admin-page="reports">Xem báo cáo</button></div>${barChart(a.ticketsByMovie||[],x=>x.movieTitle,x=>x.ticketCount,x=>`${x} vé`)}</article><article class="chart-card"><div class="card-heading"><div><h3>Trạng thái đơn đặt vé</h3><small>Số đơn theo trạng thái hiện tại</small></div></div>${barChart(a.bookingsByStatus||[],x=>bookingStatusLabel(x._id),x=>x.bookingCount,x=>`${x} đơn`)}</article></div>`;}
function renderAnalytics() {
  if (!state.analytics) return '<div class="state-card" role="status">Đang tải thống kê…</div>';
  const { ticketsByMovie = [], revenueByDay = [], seatOccupancy = [], ticketsByTimeSlot = [], bookingsByStatus = [], topCustomers = [], kpis = {} } = state.analytics;
  const ticketCount = ticketsByMovie.reduce((sum, item) => sum + item.ticketCount, 0);
  const paidTotal = revenueByDay.reduce((sum, item) => sum + item.totalAmountVnd, 0);
  const booked = seatOccupancy.reduce((sum, item) => sum + item.bookedCount, 0);
  const capacity = seatOccupancy.reduce((sum, item) => sum + item.seatCount, 0);
  const table = (label, headers, rows, empty) => `<div class="analytics-table-wrap"><h3>${label}</h3>${rows.length ? `<table class="analytics-table"><thead><tr>${headers.map(item => `<th scope="col">${item}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>` : `<div class="state-card">${empty}</div>`}</div>`;
  return `<div class="analytics-summary"><article><small>KHÁCH / PHIM / SUẤT / BOOKING</small><strong>${kpis.customers||0} / ${kpis.movies||0} / ${kpis.showtimes||0} / ${kpis.bookings||0}</strong></article><article><small>VÉ XÁC NHẬN · GIÁ TRỊ</small><strong>${ticketCount} · ${money(paidTotal)}</strong></article><article><small>GHẾ ĐÃ ĐẶT / TỔNG GHẾ</small><strong>${booked} / ${capacity}</strong><small>${capacity ? `${(booked / capacity * 100).toFixed(1)}% lấp đầy` : 'Chưa có dữ liệu ghế'}</small></article></div><div class="analytics-tables">${table('Vé và giá trị theo phim', ['Phim', 'Số vé', 'Giá trị'], ticketsByMovie.map(item => `<tr><td>${safe(item.movieTitle)}</td><td>${item.ticketCount}</td><td>${money(item.totalAmountVnd)}</td></tr>`), 'Chưa có booking xác nhận.')}${table('Thanh toán mô phỏng theo ngày', ['Ngày', 'Booking', 'Tổng tiền'], revenueByDay.map(item => `<tr><td>${safe(item._id)}</td><td>${item.bookingCount}</td><td>${money(item.totalAmountVnd)}</td></tr>`), 'Chưa có dữ liệu.')}${table('Tỷ lệ ghế theo suất', ['Suất', 'Đã đặt', 'Tổng', 'Tỷ lệ'], seatOccupancy.map(item => `<tr><td>${safe(item.showtimeId)}</td><td>${item.bookedCount}</td><td>${item.seatCount}</td><td>${item.bookedPercent.toFixed(1)}%</td></tr>`), 'Chưa có dữ liệu.')}${table('Vé theo khung giờ', ['Khung giờ','Số vé','Giá trị'],ticketsByTimeSlot.map(x=>`<tr><td>${safe(x._id)}</td><td>${x.ticketCount}</td><td>${money(x.totalAmountVnd)}</td></tr>`),'Chưa có dữ liệu.')}${table('Booking theo trạng thái',['Trạng thái','Booking','Vé','Giá trị'],bookingsByStatus.map(x=>`<tr><td>${safe(x._id)}</td><td>${x.bookingCount}</td><td>${x.ticketCount}</td><td>${money(x.totalAmountVnd)}</td></tr>`),'Chưa có dữ liệu.')}${table('Top khách hàng',['Khách','Booking','Vé','Giá trị'],topCustomers.map(x=>`<tr><td>${safe(x.customerName)} · ${safe(x.customerId)}</td><td>${x.bookingCount}</td><td>${x.ticketCount}</td><td>${money(x.totalAmountVnd)}</td></tr>`),'Chưa có dữ liệu.')}</div>`;
}

function renderReports(){if(!state.analytics)return '<div class="state-card">Đang tải báo cáo…</div>';const a=state.analytics;const tabs=[['movies','Phim'],['payments','Thanh toán'],['showtimes','Suất chiếu'],['customers','Đặt vé & khách hàng']];const table=(headers,rows)=>`<div class="analytics-table-wrap"><div class="analytics-table-scroll"><table class="analytics-table"><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div></div>`;let content='';if(state.reportTab==='movies')content=`${barChart(a.ticketsByMovie||[],x=>x.movieTitle,x=>x.ticketCount,x=>`${x} vé`)}${table(['Phim','Số vé','Giá trị'],(a.ticketsByMovie||[]).map(x=>`<tr><td>${safe(x.movieTitle)}</td><td>${x.ticketCount}</td><td>${money(x.totalAmountVnd)}</td></tr>`))}`;if(state.reportTab==='payments')content=`${barChart(a.revenueByDay||[],x=>x._id,x=>x.totalAmountVnd,money)}${table(['Ngày','Số đơn','Giá trị'],(a.revenueByDay||[]).map(x=>`<tr><td>${safe(x._id)}</td><td>${x.bookingCount}</td><td>${money(x.totalAmountVnd)}</td></tr>`))}`;if(state.reportTab==='showtimes')content=table(['Suất chiếu','Đã đặt','Tổng ghế','Tỷ lệ'],(a.seatOccupancy||[]).map(x=>`<tr><td>${safe(x.showtimeId)}</td><td>${x.bookedCount}</td><td>${x.seatCount}</td><td>${Number(x.bookedPercent||0).toFixed(1)}%</td></tr>`));if(state.reportTab==='customers')content=`${barChart(a.bookingsByStatus||[],x=>bookingStatusLabel(x._id),x=>x.bookingCount,x=>`${x} đơn`)}${table(['Khách hàng','Số đơn','Số vé','Giá trị'],(a.topCustomers||[]).map(x=>`<tr><td>${safe(x.customerName)} · ${safe(x.customerId)}</td><td>${x.bookingCount}</td><td>${x.ticketCount}</td><td>${money(x.totalAmountVnd)}</td></tr>`))}`;return `<div class="report-tabs" role="tablist">${tabs.map(([id,label])=>`<button role="tab" data-report-tab="${id}" aria-selected="${state.reportTab===id}" class="${state.reportTab===id?'active':''}">${label}</button>`).join('')}</div><div class="report-content">${content}</div>`;}

const aggregationInfo = {
  ticketsByMovie: { title: 'Vé và giá trị theo phim', collection: 'bookings', stages: '$match → $unwind → $group → $lookup → $project → $sort', index: 'Không có index status/movieId; xem executionStats trước khi đề xuất index.', field: 'ticketsByMovie' },
  revenueByDay: { title: 'Thanh toán mô phỏng theo ngày', collection: 'bookings', stages: '$match → $group ($dateToString, +07:00) → $sort', index: 'Index booking hiện tại là { customerId: 1, createdAt: -1 }; pipeline tổng hợp vẫn quét nhóm booking phù hợp.', field: 'revenueByDay' },
  seatOccupancy: { title: 'Tỷ lệ ghế BOOKED theo suất', collection: 'showtime_seats', stages: '$group → $project → $sort', index: '{ showtimeId: 1, seatCode: 1 } hỗ trợ lọc từng suất; tổng hợp mọi suất vẫn đọc dữ liệu ghế.', field: 'seatOccupancy' },
  ticketsByTimeSlot: { title: 'Vé theo khung giờ chiếu', collection: 'bookings', stages: '$match → $lookup → $unwind → $hour → $switch → $group', index: 'Dùng tham chiếu showtimeId; thống kê toàn bộ dữ liệu.', field: 'ticketsByTimeSlot' },
  bookingsByStatus: { title: 'Booking theo trạng thái', collection: 'bookings', stages: '$group → $sort', index: 'Thống kê toàn bộ collection bookings.', field: 'bookingsByStatus' },
  topCustomers: { title: 'Top khách hàng', collection: 'bookings', stages: '$match → $group → $lookup → $project → $sort → $limit', index: '{ customerId: 1, createdAt: -1 }.', field: 'topCustomers' }
};

function renderExplorerBookings() {
  const exp = state.explorer;
  if (!exp.bookingSearched) return '<div class="state-card">Chọn bộ lọc rồi chạy truy vấn chỉ đọc.</div>';
  if (!exp.bookingResults.length) return '<div class="state-card">Không tìm thấy booking phù hợp.</div>';
  return `<div class="admin-record-list">${exp.bookingResults.map(item => `<article class="admin-record booking-record"><div><strong>${safe(item.movieTitle || item.movieId)} · ${safe(item._id)}</strong><small>Khách ${safe(item.customerId)} · suất ${safe(item.showtimeId)} · ${formatDate(item.startAt)}</small><small>Ghế ${(item.seats || []).map(seat => safe(seat.seatCode)).join(', ') || '—'} · ${bookingStatusLabel(item.status)}</small></div><div class="admin-record-total"><strong>${money(item.totalAmountVnd)}</strong><small>${safe(item.payment?.method || '—')} · ${safe(item.payment?.status || '—')}</small></div></article>`).join('')}</div>`;
}

function addBookingReferenceFields(form, filters) {
  if (!form || form.querySelector('[name="bookingId"]')) return;
  form.insertAdjacentHTML('afterbegin', `<label>Mã booking<input name="bookingId" value="${safe(filters.bookingId)}" placeholder="BK-…"/></label><label>Mã suất chiếu<input name="showtimeId" value="${safe(filters.showtimeId)}" placeholder="ST001"/></label>`);
}

function renderExplorerSeats() {
  const exp = state.explorer;
  if (!exp.seatSearched) return '<div class="state-card">Chọn suất chiếu và trạng thái ghế rồi chạy truy vấn chỉ đọc.</div>';
  if (!exp.seatResults.length) return '<div class="state-card">Không có ghế khớp bộ lọc.</div>';
  return `<div class="analytics-table-wrap"><div class="analytics-table-scroll"><table class="analytics-table"><thead><tr><th scope="col">Mã ghế</th><th scope="col">Trạng thái</th><th scope="col">Mã booking tham chiếu</th></tr></thead><tbody>${exp.seatResults.map(seat => `<tr><td>${safe(seat.seatCode)}</td><td>${safe(seat.status)}</td><td>${safe(seat.bookingId || '—')}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function renderExplorerAggregation() {
  const exp = state.explorer;
  const info = aggregationInfo[exp.aggregation];
  const result = exp.aggregationResult;
  return `<article class="explorer-aggregation"><div class="explorer-aggregation-heading"><div><p class="eyebrow">AGGREGATION PIPELINE</p><h3>${info.title}</h3></div><button class="primary-button" id="run-explorer-aggregation" ${exp.busy ? 'disabled' : ''}>${exp.busy ? 'Đang chạy…' : 'Chạy aggregation'}</button></div><dl class="explorer-meta"><div><dt>Collection đầu vào</dt><dd><code>${info.collection}</code></dd></div><div><dt>Các stage</dt><dd><code>${info.stages}</code></dd></div><div><dt>Index liên quan</dt><dd>${info.index}</dd></div></dl><p class="explorer-hint">Pipeline đầy đủ để chạy lại trên Mingo nằm trong <code>database/queries/mingo-readonly.md</code>. Kết quả dưới đây lấy qua API backend, không kết nối MongoDB trực tiếp từ frontend.</p>${exp.error ? `<div class="state-card error-card" role="alert">${safe(exp.error)}</div>` : ''}${result ? `<pre class="explorer-json" aria-label="Kết quả aggregation JSON">${safe(JSON.stringify(result, null, 2))}</pre>` : '<div class="state-card">Chưa chạy aggregation trong trang này.</div>'}</article>`;
}

function renderDataExplorer() {
  const exp = state.explorer;
  const bookingFilter = {};
  if (exp.bookingFilters.bookingId) bookingFilter._id = exp.bookingFilters.bookingId;
  if (exp.bookingFilters.customerId) bookingFilter.customerId = exp.bookingFilters.customerId;
  if (exp.bookingFilters.showtimeId) bookingFilter.showtimeId = exp.bookingFilters.showtimeId;
  if (exp.bookingFilters.status) bookingFilter.status = exp.bookingFilters.status;
  if (exp.bookingFilters.from || exp.bookingFilters.to) {
    const from = exp.bookingFilters.from ? new Date(`${exp.bookingFilters.from}T00:00:00`) : null;
    const to = exp.bookingFilters.to ? new Date(`${exp.bookingFilters.to}T00:00:00`) : null;
    if (to) to.setDate(to.getDate() + 1);
    bookingFilter.createdAt = { ...(from ? { $gte: { $date: from.toISOString() } } : {}), ...(to ? { $lt: { $date: to.toISOString() } } : {}) };
  }
  const seatFilter = { ...(exp.seatShowtimeId ? { showtimeId: exp.seatShowtimeId } : {}), ...(exp.seatStatus !== 'ALL' ? { status: exp.seatStatus } : {}) };
  return `<section class="admin-panel explorer-page active"><div class="section-heading"><div><p class="eyebrow">MONGODB · MINGO</p><h2>Khám phá dữ liệu</h2><p class="explorer-intro">Thử bộ lọc trên dữ liệu thật và chạy aggregation đọc qua backend. Đối chiếu cùng filter/pipeline trong Mingo bằng tài liệu hướng dẫn.</p></div><span class="step-label">Chỉ đọc</span></div>${exp.error ? `<div class="notice error" role="alert">${safe(exp.error)}</div>` : ''}<div class="explorer-grid">
    <article class="explorer-card"><div class="section-heading"><div><p class="eyebrow">FIND / FILTER</p><h3>Tra cứu booking</h3></div></div><form id="explorer-booking-form" class="admin-form"><label>Mã khách hàng<input name="customerId" value="${safe(exp.bookingFilters.customerId)}" placeholder="CUS001"/></label><label>Trạng thái<select name="status"><option value="">Tất cả</option><option value="CONFIRMED" ${exp.bookingFilters.status === 'CONFIRMED' ? 'selected' : ''}>Đã xác nhận</option><option value="PENDING" ${exp.bookingFilters.status === 'PENDING' ? 'selected' : ''}>Đang xử lý</option><option value="CANCELLED" ${exp.bookingFilters.status === 'CANCELLED' ? 'selected' : ''}>Đã hủy</option></select></label><label>Từ ngày<input name="from" type="date" value="${safe(exp.bookingFilters.from)}"/></label><label>Đến ngày<input name="to" type="date" value="${safe(exp.bookingFilters.to)}"/></label><div class="form-actions"><button class="primary-button" type="submit" ${exp.busy ? 'disabled' : ''}>${exp.busy ? 'Đang truy vấn…' : 'Chạy bộ lọc'}</button></div></form><p class="explorer-label">Filter tương ứng</p><pre class="explorer-json">${safe(JSON.stringify(bookingFilter, null, 2))}</pre><p class="explorer-hint">Collection <code>bookings</code> · Index hiện có <code>{ customerId: 1, createdAt: -1 }</code>; status không thuộc index.</p>${renderExplorerBookings()}</article>
    <article class="explorer-card"><div class="section-heading"><div><p class="eyebrow">FIND / FILTER</p><h3>Trạng thái ghế</h3></div></div><form id="explorer-seat-form" class="admin-form"><label>Suất chiếu<select name="showtimeId" required><option value="">Chọn suất</option>${state.showtimes.map(show => `<option value="${safe(show._id)}" ${exp.seatShowtimeId === show._id ? 'selected' : ''}>${safe(show.movieTitle || show.movieId)} · ${safe(show._id)} · ${formatDate(show.startAt)}</option>`).join('')}</select></label><label>Trạng thái<select name="status"><option value="ALL" ${exp.seatStatus === 'ALL' ? 'selected' : ''}>Tất cả</option><option value="AVAILABLE" ${exp.seatStatus === 'AVAILABLE' ? 'selected' : ''}>Còn trống</option><option value="HELD" ${exp.seatStatus === 'HELD' ? 'selected' : ''}>Đang giữ</option><option value="BOOKED" ${exp.seatStatus === 'BOOKED' ? 'selected' : ''}>Đã đặt</option></select></label><div class="form-actions"><button class="primary-button" type="submit" ${exp.busy || !state.showtimes.length ? 'disabled' : ''}>${exp.busy ? 'Đang truy vấn…' : 'Lọc trạng thái ghế'}</button></div></form><p class="explorer-label">Filter tương ứng</p><pre class="explorer-json">${safe(JSON.stringify(seatFilter, null, 2))}</pre><p class="explorer-hint">Collection <code>showtime_seats</code> · Unique index <code>{ showtimeId: 1, seatCode: 1 }</code> đảm bảo mã ghế không lặp trong một suất; status được lọc bổ sung.</p>${renderExplorerSeats()}</article>
    <article class="explorer-card explorer-aggregation-card"><div class="section-heading"><div><p class="eyebrow">AGGREGATION BUILDER</p><h3>Phân tích dữ liệu</h3></div></div><label class="explorer-select-label" for="explorer-aggregation">Chọn pipeline</label><select id="explorer-aggregation" class="explorer-select">${Object.entries(aggregationInfo).map(([key, item]) => `<option value="${key}" ${exp.aggregation === key ? 'selected' : ''}>${item.title}</option>`).join('')}</select>${renderExplorerAggregation()}</article>
  </div><div class="admin-warning explorer-readonly"><strong>An toàn dữ liệu</strong><span>Trang này chỉ gọi GET API. Không thao tác insert, update, delete, import hoặc restore.</span></div></section>`;
}

export function renderAdmin() {
  const movie = state.movies.find(item => item._id === state.editingMovieId);
  const showtime = state.showtimes.find(item => item._id === state.editingShowtimeId);
  return `<div class="admin-page"><header class="topbar admin-topbar"><strong class="admin-page-name">Hệ thống quản trị</strong><button class="text-button" id="admin-back">Quay lại website</button></header><main class="admin-main"><div class="admin-warning"><strong>Môi trường minh họa</strong><span>Khu quản trị chỉ dùng nội bộ trên localhost. Hồ sơ khách demo không phải tài khoản đăng nhập.</span></div><nav class="admin-nav" aria-label="Điều hướng quản trị"><div class="admin-nav-brand"><span class="brand-mark">C</span><strong>CINEVUE</strong></div><small>TỔNG QUAN</small>${[['overview','Dashboard'],['reports','Báo cáo thống kê']].map(([page,label]) => `<button type="button" class="admin-nav-link ${state.page === page ? 'active' : ''}" data-admin-page="${page}">${label}</button>`).join('')}<small>QUẢN LÝ NGHIỆP VỤ</small>${[['movies','Phim'],['rooms','Phòng chiếu'],['showtimes','Suất chiếu'],['customers','Khách hàng'],['bookings','Đơn đặt vé']].map(([page,label]) => `<button type="button" class="admin-nav-link ${state.page === page ? 'active' : ''}" data-admin-page="${page}">${label}</button>`).join('')}<small>DỮ LIỆU</small><button type="button" class="admin-nav-link ${state.page === 'explorer' ? 'active' : ''}" data-admin-page="explorer">Khám phá NoSQL</button></nav>${state.error ? `<div class="notice error" role="alert">${safe(state.error)}</div>` : ''}${state.notice ? `<div class="notice success" role="status">${safe(state.notice)}</div>` : ''}${state.loading ? '<div class="admin-loading" role="status">Đang tải dữ liệu quản trị…</div>' : ''}
    <section class="admin-panel ${state.page === 'overview' ? 'active' : ''}"><div class="admin-page-header"><div><p class="eyebrow">TỔNG QUAN</p><h1>Dashboard</h1><p>Theo dõi nhanh hoạt động đặt vé và mức sử dụng ghế.</p></div><button class="outline-button" id="admin-refresh">Làm mới</button></div>${renderDashboard()}</section>
    <section class="admin-panel ${state.page === 'reports' ? 'active' : ''}"><div class="admin-page-header"><div><p class="eyebrow">PHÂN TÍCH</p><h1>Báo cáo thống kê</h1><p>Dữ liệu tổng hợp trực tiếp từ sáu Aggregation Pipeline của MongoDB.</p></div></div>${renderReports()}</section>
    <section class="admin-panel ${state.page === 'movies' ? 'active' : ''}"><div class="section-heading"><div><p class="eyebrow">DANH MỤC</p><h2>Quản lý phim</h2></div><span class="step-label">${state.movies.length} phim</span></div><div class="admin-columns"><form class="admin-form" id="movie-admin-form"><input name="id" type="hidden" value="${safe(movie?._id || '')}"/><label>Tên phim<input name="title" required maxlength="160" value="${safe(movie?.title || '')}"/></label><label>Thể loại, cách nhau bằng dấu phẩy<input name="genres" required value="${safe((movie?.genres || []).join(', '))}" placeholder="Phiêu lưu, Gia đình"/></label><label>Thời lượng (phút)<input name="durationMinutes" type="number" min="1" max="600" required value="${safe(movie?.durationMinutes ?? '')}"/></label><label>Trạng thái<select name="status" required><option value="NOW_SHOWING" ${movie?.status === 'NOW_SHOWING' ? 'selected' : ''}>Đang chiếu</option><option value="COMING_SOON" ${movie?.status === 'COMING_SOON' ? 'selected' : ''}>Sắp chiếu</option></select></label><label class="wide-field">Tóm tắt<textarea name="synopsis" maxlength="2000" rows="3">${safe(movie?.synopsis || '')}</textarea></label><div class="form-actions"><button class="primary-button" type="submit">${movie ? 'Lưu phim' : 'Thêm phim'}</button>${movie ? '<button class="text-button" type="button" id="movie-form-reset">Hủy sửa</button>' : ''}</div></form><div>${renderMovieList()}</div></div></section>
    <section class="admin-panel ${state.page === 'rooms' ? 'active' : ''}"><div class="section-heading"><div><p class="eyebrow">CƠ SỞ VẬT CHẤT</p><h2>Phòng chiếu</h2></div><span class="step-label">Chỉ đọc</span></div><div class="admin-record-list">${state.rooms.map(room=>`<article class="admin-record"><div><strong>${safe(room.name)}</strong><small>${safe(room._id)} · ${room.seatCount} ghế</small><small>${state.showtimes.filter(show=>show.roomId===room._id).length} suất chiếu liên quan</small></div><span class="badge">${room.seatCount} chỗ</span></article>`).join('')}</div></section>
    <section class="admin-panel ${state.page === 'showtimes' ? 'active' : ''}"><div class="section-heading"><div><p class="eyebrow">LỊCH CHIẾU</p><h2>Quản lý suất chiếu</h2></div><span class="step-label">${state.showtimes.length} suất</span></div><div class="admin-columns"><form class="admin-form" id="showtime-admin-form"><input name="id" type="hidden" value="${safe(showtime?._id || '')}"/><label>Phim<select name="movieId" required>${state.movies.map(item => `<option value="${safe(item._id)}" ${item._id === (showtime?.movieId || state.movies[0]?._id) ? 'selected' : ''}>${safe(item.title)}</option>`).join('')}</select></label><label>Phòng<select name="roomId" required ${showtime ? 'disabled' : ''}>${state.rooms.map(room => `<option value="${safe(room._id)}" ${room._id === (showtime?.roomId || state.rooms[0]?._id) ? 'selected' : ''}>${safe(room.name)} · ${safe(room.seatCount)} ghế</option>`).join('')}</select>${showtime ? '<small>Không đổi phòng để giữ nguyên sơ đồ ghế đã tạo.</small>' : ''}</label><label>Bắt đầu<input name="startAt" type="datetime-local" required value="${safe(localInputValue(showtime?.startAt))}"/></label><label>Kết thúc<input name="endAt" type="datetime-local" required value="${safe(localInputValue(showtime?.endAt))}"/></label><label>Giá vé (VND)<input name="basePriceVnd" type="number" min="0" step="1" required value="${safe(showtime?.basePriceVnd ?? '')}"/></label><label>Trạng thái<select name="status"><option value="OPEN" ${!showtime || showtime.status === 'OPEN' ? 'selected' : ''}>Mở bán</option><option value="CLOSED" ${showtime?.status === 'CLOSED' ? 'selected' : ''}>Đóng</option></select></label><div class="form-actions"><button class="primary-button" type="submit">${showtime ? 'Lưu suất chiếu' : 'Tạo suất chiếu'}</button>${showtime ? '<button class="text-button" type="button" id="showtime-form-reset">Hủy sửa</button>' : ''}</div><small class="wide-field">Tạo suất mới đồng thời khởi tạo trạng thái AVAILABLE cho ghế thuộc phòng. Xóa suất đã có ghế/booking sẽ bị từ chối; hãy đóng suất.</small></form><div>${renderShowtimeList()}</div></div></section>
    <section class="admin-panel ${state.page === 'customers' ? 'active' : ''}"><div class="section-heading"><div><p class="eyebrow">KHÁCH HÀNG DEMO</p><h2>Khách hàng</h2></div><span class="step-label">${state.customers.length} hồ sơ</span></div><div class="admin-record-list">${state.customers.map(customer=>`<article class="admin-record"><div><strong>${safe(customer.fullName)}</strong><small>${safe(customer._id)} · đăng ký ${formatDate(customer.createdAt)}</small></div><span class="badge">${customer.bookingCount} booking</span></article>`).join('')}</div></section>
    <section class="admin-panel ${state.page === 'bookings' ? 'active' : ''}"><div class="section-heading"><div><p class="eyebrow">TRA CỨU</p><h2>Booking</h2></div><span class="step-label">Tối đa 100 kết quả</span></div><form class="admin-form booking-search-form" id="booking-search-form"><label>Mã khách<input name="customerId" placeholder="CUS001"/></label><label>Trạng thái<select name="status"><option value="">Tất cả</option><option value="CONFIRMED">Đã xác nhận</option><option value="PENDING">Đang xử lý</option><option value="CANCELLED">Đã hủy</option></select></label><label>Từ ngày<input name="from" type="date"/></label><label>Đến ngày<input name="to" type="date"/></label><div class="form-actions"><button class="primary-button" type="submit">Tra cứu</button></div></form><div id="admin-booking-results">${renderBookings()}</div></section>
    ${state.page === 'explorer' ? renderDataExplorer() : ''}<footer><span>LOCAL DEMO · KHÔNG CÓ XÁC THỰC</span><button class="text-button" id="admin-refresh">Làm mới dữ liệu</button></footer></main></div>`;
}

export async function openAdmin(render) { state.notice = ''; state.loading = true; render(); await reloadAdmin(); render(); }

function inspectDialog(title,subtitle,content){
  document.querySelector('.inspect-dialog')?.remove();
  const dialog=document.createElement('dialog');dialog.className='inspect-dialog';
  dialog.innerHTML=`<section class="inspect-dialog-card"><header class="inspect-dialog-head"><div><p class="eyebrow">CHI TIẾT</p><h2>${safe(title)}</h2><small>${safe(subtitle)}</small></div><button class="inspect-dialog-close" aria-label="Đóng">×</button></header><div>${content}</div></section>`;
  dialog.querySelector('.inspect-dialog-close').onclick=()=>dialog.close();dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
}

async function inspectRoom(room){
  try{const detail=await request(`/api/rooms/${encodeURIComponent(room._id)}`);const future=(detail.showtimes||[]).filter(item=>new Date(item.startAt)>new Date()).slice(0,8);inspectDialog(detail.name,`${detail._id} · ${detail.capacity} ghế`,`<div class="inspect-summary"><div><small>Sức chứa</small><strong>${detail.capacity} ghế</strong></div><div><small>Suất sắp tới</small><strong>${future.length}</strong></div><div><small>Tổng lịch liên quan</small><strong>${(detail.showtimes||[]).length}</strong></div></div><h3>Sơ đồ phòng</h3><div class="inspect-seat-map">${(detail.seats||[]).map(seat=>`<span class="inspect-seat">${safe(seat.code)}</span>`).join('')}</div><h3>Lịch chiếu sắp tới</h3><div class="inspect-list">${future.length?future.map(show=>`<div class="inspect-row"><strong>${safe(state.movies.find(movie=>movie._id===show.movieId)?.title||show.movieId)}</strong><small>${formatDate(show.startAt)}</small></div>`).join(''):'<p>Chưa có suất chiếu sắp tới.</p>'}</div>`);}catch(error){state.error=error.message;}
}

async function inspectCustomer(customer){
  try{const bookings=await request(`/api/customers/${encodeURIComponent(customer._id)}/bookings/details`);const confirmed=bookings.filter(item=>item.status==='CONFIRMED');inspectDialog(customer.fullName,customer._id,`<div class="inspect-summary"><div><small>Tổng đơn</small><strong>${bookings.length}</strong></div><div><small>Đã xác nhận</small><strong>${confirmed.length}</strong></div><div><small>Tổng giá trị</small><strong>${money(confirmed.reduce((sum,item)=>sum+item.totalAmountVnd,0))}</strong></div></div><h3>Lịch sử đặt vé</h3><div class="inspect-list">${bookings.length?bookings.slice(0,12).map(item=>`<div class="inspect-row"><span><strong>${safe(item.movieTitle||item.movieId)}</strong><br><small>${formatDate(item.startAt)} · ${(item.seats||[]).map(seat=>safe(seat.seatCode)).join(', ')}</small></span><span><strong>${money(item.totalAmountVnd)}</strong><br><small>${bookingStatusLabel(item.status)}</small></span></div>`).join(''):'<p>Khách hàng chưa có đơn đặt vé.</p>'}</div>`);}catch(error){state.error=error.message;}
}

function inspectShowtime(showtime,seats){
  const counts=seats.reduce((result,seat)=>{result[seat.status]=(result[seat.status]||0)+1;return result;},{});inspectDialog(showtime.movieTitle||showtime.movieId,`${showtime._id} · ${showtime.roomName||showtime.roomId} · ${formatDate(showtime.startAt)}`,`<div class="inspect-summary"><div><small>Còn trống</small><strong>${counts.AVAILABLE||0}</strong></div><div><small>Đã đặt</small><strong>${counts.BOOKED||0}</strong></div><div><small>Đang giữ</small><strong>${counts.HELD||0}</strong></div></div><h3>Sơ đồ ghế theo suất</h3><div class="inspect-seat-map">${seats.map(seat=>`<span class="inspect-seat ${seat.status.toLowerCase()}" title="${safe(seat.status)}">${safe(seat.seatCode)}</span>`).join('')}</div>`);
}

export function bindAdminEvents(render, goBack) {
  const openDrawer = selector => document.querySelector(selector)?.classList.add('drawer-open');
  const setupDrawer = (formSelector, label) => {
    const form = document.querySelector(formSelector); if (!form) return;
    form.classList.add('admin-drawer');
    const heading = form.closest('.admin-panel')?.querySelector(':scope > .section-heading');
    const open = document.createElement('button'); open.type = 'button'; open.className = 'primary-button'; open.textContent = label;
    open.addEventListener('click', () => openDrawer(formSelector)); heading?.append(open);
    const close = document.createElement('button'); close.type = 'button'; close.className = 'outline-button'; close.textContent = 'Đóng';
    close.addEventListener('click', () => { form.classList.remove('drawer-open'); state.editingMovieId = ''; state.editingShowtimeId = ''; });
    form.querySelector('.form-actions')?.append(close);
  };
  setupDrawer('#movie-admin-form', 'Thêm phim');
  setupDrawer('#showtime-admin-form', 'Tạo suất chiếu');
  const movieForm = document.querySelector('#movie-admin-form');
  if (movieForm) {
    const currentMovie = state.movies.find(item => item._id === state.editingMovieId);
    const synopsisField = movieForm.querySelector('[name="synopsis"]')?.closest('label');
    synopsisField?.insertAdjacentHTML('afterend', `<label class="movie-admin-poster"><img id="movie-poster-preview" alt="Xem trước ảnh phim" src="${safe(currentMovie?.posterImage || '/assets/movie-posters-sprite.png')}"><span>Ảnh áp phích<input id="movie-poster-file" type="file" accept="image/jpeg,image/png,image/webp"><input name="posterImage" type="hidden" value="${safe(currentMovie?.posterImage || '')}"><small>Chọn ảnh dọc. Ảnh được thu nhỏ trước khi lưu và sẽ hiển thị trên trang khách hàng.</small></span></label>`);
    movieForm.querySelector('#movie-poster-file')?.addEventListener('change', event => {
      const file=event.target.files?.[0];if(!file)return;
      if(!/^image\/(jpeg|png|webp)$/.test(file.type)){state.error='Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.';render();return;}
      const reader=new FileReader();reader.onload=()=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');const ratio=Math.min(1,900/image.width,1350/image.height);canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const value=canvas.toDataURL('image/jpeg',.82);movieForm.querySelector('[name="posterImage"]').value=value;movieForm.querySelector('#movie-poster-preview').src=value;};image.src=reader.result;};reader.readAsDataURL(file);
    });
  }
  document.querySelectorAll('[data-edit-movie]').forEach(button=>{const card=button.closest('.admin-record');const movie=state.movies.find(item=>item._id===button.dataset.editMovie);if(!card||!movie)return;card.classList.add('movie-record');card.tabIndex=0;card.insertAdjacentHTML('afterbegin',`<img class="admin-movie-thumb" src="${safe(movie.posterImage||'/assets/movie-posters-sprite.png')}" alt="">`);card.querySelectorAll('small').forEach(label=>{label.textContent=label.textContent.replace('NOW_SHOWING','Đang chiếu').replace('COMING_SOON','Sắp chiếu');});const open=event=>{if(event.target.closest('button'))return;state.editingMovieId=movie._id;render();openDrawer('#movie-admin-form');};card.addEventListener('click',open);card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(event);}});});
  document.querySelectorAll('.admin-record-total small').forEach(label=>{label.classList.add('payment-human');label.textContent=label.textContent.replace('SIMULATED','Thanh toán thử nghiệm').replace('SUCCESS','Thành công').replace('FAILED','Không thành công').replace('PENDING','Đang xử lý');});
  document.querySelector('#admin-back')?.addEventListener('click', goBack);
  if(state.page==='rooms')document.querySelectorAll('.admin-panel.active .admin-record').forEach((card,index)=>{const room=state.rooms[index];if(!room)return;card.classList.add('admin-inspect-card');card.tabIndex=0;card.onclick=()=>inspectRoom(room);card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();inspectRoom(room);}};});
  if(state.page==='customers')document.querySelectorAll('.admin-panel.active .admin-record').forEach((card,index)=>{const customer=state.customers[index];if(!customer)return;card.classList.add('admin-inspect-card');card.tabIndex=0;card.onclick=()=>inspectCustomer(customer);card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();inspectCustomer(customer);}};});
  document.querySelectorAll('[data-admin-page]').forEach(button => button.addEventListener('click', () => { state.page = button.dataset.adminPage; state.error = ''; state.notice = ''; location.hash = `/admin/${routeForPage(state.page)}`; render(); }));
  document.querySelectorAll('[data-report-tab]').forEach(button => button.addEventListener('click', () => { state.reportTab = button.dataset.reportTab; render(); }));
  addBookingReferenceFields(document.querySelector('#booking-search-form'), state.bookingFilters);
  addBookingReferenceFields(document.querySelector('#explorer-booking-form'), state.explorer.bookingFilters);
  document.querySelector('.showtime-filterbar')?.addEventListener('change', event => {
    const root = event.currentTarget;
    state.showtimeFilters = { movieId: root.querySelector('[name="movieId"]').value, day: root.querySelector('[name="day"]').value, roomId: root.querySelector('[name="roomId"]').value, status: root.querySelector('[name="status"]').value };
    render();
  });
  document.querySelectorAll('[data-showtime-seats]').forEach(button => button.addEventListener('click', async () => {
    const showtimeId = button.dataset.showtimeSeats;
    state.loadingShowtimeId = showtimeId; state.error = ''; render();
    try {
      const seats = await request(`/api/showtimes/${encodeURIComponent(showtimeId)}/seats`);
      state.showtimeSeatCounts[showtimeId] = seats.reduce((counts, seat) => { counts[seat.status] = (counts[seat.status] || 0) + 1; return counts; }, {});
      const showtime=state.showtimes.find(item=>item._id===showtimeId);if(showtime)inspectShowtime(showtime,seats);
    } catch (error) { state.error = error.message; }
    finally { state.loadingShowtimeId = ''; render(); }
  }));
  document.querySelectorAll('[data-showtime-seats]').forEach(button=>{if(!button.disabled)button.textContent='Xem sơ đồ ghế';});
  document.querySelector('#admin-refresh')?.addEventListener('click', () => openAdmin(render));
  document.querySelector('#movie-form-reset')?.addEventListener('click', () => { state.editingMovieId = ''; state.notice = ''; render(); });
  document.querySelector('#showtime-form-reset')?.addEventListener('click', () => { state.editingShowtimeId = ''; state.notice = ''; render(); });
  document.querySelectorAll('[data-edit-movie]').forEach(button => button.addEventListener('click', () => { state.editingMovieId = button.dataset.editMovie; state.notice = ''; render(); openDrawer('#movie-admin-form'); }));
  document.querySelectorAll('[data-delete-movie]').forEach(button => button.addEventListener('click', async () => {
    const movie = state.movies.find(item => item._id === button.dataset.deleteMovie);
    if (!movie || !await confirmDialog({title:'Xóa phim?',message:'Chỉ phim chưa được suất chiếu hoặc đơn đặt vé tham chiếu mới có thể xóa.',summary:`${movie.title} · ${movie._id}`,confirmLabel:'Xóa phim'})) return;
    try { await request(`/api/admin/movies/${encodeURIComponent(movie._id)}`, { method: 'DELETE' }); state.notice = 'Đã xóa phim.'; await reloadAdmin(); }
    catch (error) { state.error = error.message; }
    render();
  }));
  document.querySelectorAll('[data-edit-showtime]').forEach(button => button.addEventListener('click', () => { state.editingShowtimeId = button.dataset.editShowtime; state.notice = ''; render(); openDrawer('#showtime-admin-form'); }));
  document.querySelectorAll('[data-delete-showtime]').forEach(button => button.addEventListener('click', async () => {
    const showtime = state.showtimes.find(item => item._id === button.dataset.deleteShowtime);
    if (!showtime || !await confirmDialog({title:'Xóa suất chiếu?',message:'Chỉ suất chưa có dữ liệu ghế hoặc đơn đặt vé mới có thể xóa.',summary:`${showtime.movieTitle||showtime.movieId} · ${showtime._id}`,confirmLabel:'Xóa suất chiếu'})) return;
    try { await request(`/api/admin/showtimes/${encodeURIComponent(showtime._id)}`, { method: 'DELETE' }); state.notice = 'Đã xóa suất chiếu.'; await reloadAdmin(); }
    catch (error) { state.error = error.message; }
    render();
  }));
  document.querySelector('#movie-admin-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const movie = { title: String(data.get('title') || '').trim(), genres: String(data.get('genres') || '').split(',').map(value => value.trim()).filter(Boolean), durationMinutes: Number(data.get('durationMinutes')), status: String(data.get('status')), synopsis: String(data.get('synopsis') || '').trim(), posterImage: String(data.get('posterImage') || '') };
    try {
      const id = String(data.get('id') || '');
      await request(id ? `/api/admin/movies/${encodeURIComponent(id)}` : '/api/admin/movies', { method: id ? 'PUT' : 'POST', body: JSON.stringify(movie) });
      state.editingMovieId = ''; state.notice = id ? 'Đã cập nhật phim.' : 'Đã thêm phim.'; await reloadAdmin();
    } catch (error) { state.error = error.message; }
    render();
  });
  document.querySelector('#showtime-admin-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const id = String(data.get('id') || '');
    const editing = state.showtimes.find(item => item._id === id);
    const showtime = {
      movieId: String(data.get('movieId') || ''),
      roomId: editing?.roomId || String(data.get('roomId') || ''),
      startAt: new Date(String(data.get('startAt'))).toISOString(),
      endAt: new Date(String(data.get('endAt'))).toISOString(),
      basePriceVnd: Number(data.get('basePriceVnd')),
      status: String(data.get('status') || 'OPEN')
    };
    try {
      await request(id ? `/api/admin/showtimes/${encodeURIComponent(id)}` : '/api/admin/showtimes', { method: id ? 'PUT' : 'POST', body: JSON.stringify(showtime) });
      state.editingShowtimeId = ''; state.notice = id ? 'Đã cập nhật suất chiếu.' : 'Đã tạo suất và khởi tạo ghế.'; await reloadAdmin();
    } catch (error) { state.error = error.message; }
    render();
  });
  document.querySelector('#booking-search-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    const bookingId = String(data.get('bookingId') || '').trim();
    const customerId = String(data.get('customerId') || '').trim();
    const showtimeId = String(data.get('showtimeId') || '').trim();
    const status = String(data.get('status') || '');
    const from = String(data.get('from') || '');
    const to = String(data.get('to') || '');
    state.bookingFilters = { bookingId, customerId, showtimeId, status, from, to };
    if (bookingId) params.set('bookingId', bookingId);
    if (customerId) params.set('customerId', customerId);
    if (showtimeId) params.set('showtimeId', showtimeId);
    if (status) params.set('status', status);
    if (from) params.set('from', new Date(`${from}T00:00:00`).toISOString());
    if (to) { const end = new Date(`${to}T00:00:00`); end.setDate(end.getDate() + 1); params.set('to', end.toISOString()); }
    state.loading = true; state.error = ''; render();
    params.set('page','1');params.set('pageSize','12');
    try { const result=await request(`/api/admin/bookings?${params}`);state.bookings=Array.isArray(result)?result:result.items;state.bookingSearched=true; }
    catch (error) { state.error = error.message; }
    finally { state.loading = false; render(); }
  });
  document.querySelector('#explorer-aggregation')?.addEventListener('change', event => { state.explorer.aggregation = event.target.value; state.explorer.aggregationResult = null; state.explorer.error = ''; render(); });
  document.querySelector('#run-explorer-aggregation')?.addEventListener('click', async () => {
    const exp = state.explorer;
    exp.busy = true; exp.error = ''; render();
    try {
      const analytics = await request('/api/admin/analytics');
      state.analytics = analytics;
      exp.aggregationResult = analytics[aggregationInfo[exp.aggregation].field] || [];
    } catch (error) { exp.error = error.message; }
    finally { exp.busy = false; render(); }
  });
  document.querySelector('#explorer-booking-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const exp = state.explorer;
    exp.bookingFilters = { customerId: String(data.get('customerId') || '').trim(), status: String(data.get('status') || ''), from: String(data.get('from') || ''), to: String(data.get('to') || '') };
    const params = new URLSearchParams();
    exp.bookingFilters.bookingId = String(data.get('bookingId') || '').trim();
    exp.bookingFilters.showtimeId = String(data.get('showtimeId') || '').trim();
    if (exp.bookingFilters.bookingId) params.set('bookingId', exp.bookingFilters.bookingId);
    if (exp.bookingFilters.customerId) params.set('customerId', exp.bookingFilters.customerId);
    if (exp.bookingFilters.showtimeId) params.set('showtimeId', exp.bookingFilters.showtimeId);
    if (exp.bookingFilters.status) params.set('status', exp.bookingFilters.status);
    if (exp.bookingFilters.from) params.set('from', new Date(`${exp.bookingFilters.from}T00:00:00`).toISOString());
    if (exp.bookingFilters.to) { const end = new Date(`${exp.bookingFilters.to}T00:00:00`); end.setDate(end.getDate() + 1); params.set('to', end.toISOString()); }
    exp.busy = true; exp.error = ''; render();
    params.set('page','1');params.set('pageSize','12');
    try { const result=await request(`/api/admin/bookings?${params}`);exp.bookingResults=Array.isArray(result)?result:result.items;exp.bookingSearched=true; }
    catch (error) { exp.error = error.message; }
    finally { exp.busy = false; render(); }
  });
  document.querySelector('#explorer-seat-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const exp = state.explorer;
    exp.seatShowtimeId = String(data.get('showtimeId') || '');
    exp.seatStatus = String(data.get('status') || 'ALL');
    exp.busy = true; exp.error = ''; render();
    try {
      const seats = await request(`/api/showtimes/${encodeURIComponent(exp.seatShowtimeId)}/seats`);
      exp.seatResults = exp.seatStatus === 'ALL' ? seats : seats.filter(seat => seat.status === exp.seatStatus);
      exp.seatSearched = true;
    } catch (error) { exp.error = error.message; }
    finally { exp.busy = false; render(); }
  });
  const explorer = document.querySelector('.explorer-grid');
  if (explorer) {
    state.explorer.tab ??= 0;
    const cards = [...explorer.querySelectorAll(':scope > .explorer-card')];
    const labels = ['Tra cứu booking', 'Trạng thái ghế', 'Aggregation'];
    const tabs = document.createElement('div'); tabs.className = 'explorer-tabs';
    cards.forEach((card, index) => { card.classList.toggle('active', index === state.explorer.tab); const button = document.createElement('button'); button.type = 'button'; button.textContent = labels[index]; button.className = index === state.explorer.tab ? 'active' : ''; button.onclick = () => { state.explorer.tab=index;cards.forEach((item, i) => item.classList.toggle('active', i === index)); [...tabs.children].forEach((item, i) => item.classList.toggle('active', i === index)); }; tabs.append(button); });
    explorer.before(tabs);
  }
}
