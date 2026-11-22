import './style.css';
import { bindAdminEvents, openAdmin, renderAdmin } from './admin.js';

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const CUSTOMER_ID = 'CUS001';
const state = {
  movies: [], movieQuery: '', selectedGenre: '', selectedMovie: null,
  showtimes: [], selectedDay: '', selectedShowtime: null, seats: [], chosen: new Set(),
  history: [], historyStatus: 'ALL', historyLoaded: false,
  loadingMovies: false, loadingShowtimes: false, loadingSeats: false, loadingHistory: false, submittingBooking: false,
  movieError: '', showtimeError: '', seatError: '', historyError: '', notice: null, adminMode: false
};
const app = document.querySelector('#app');
const money = value => new Intl.NumberFormat('vi-VN').format(value || 0) + ' ₫';
const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

async function request(path, options) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { ...(options?.body ? { 'Content-Type': 'application/json' } : {}), ...options?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error || 'Không thể hoàn tất yêu cầu.'); error.status = response.status; throw error; }
  return data;
}
function dayKey(date) {
  const value = new Date(date);
  if (!Number.isFinite(value.getTime())) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
function formatDateTime(date) {
  const value = new Date(date);
  return Number.isFinite(value.getTime()) ? value.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Chưa có thông tin suất chiếu';
}
const bookingStatusLabel = status => ({ CONFIRMED: 'Đã xác nhận', CANCELLED: 'Đã hủy', PENDING: 'Đang xử lý' }[status] || status || 'Không rõ');

function filteredMovies() {
  const query = state.movieQuery.trim().toLocaleLowerCase('vi');
  return state.movies.filter(movie => {
    const matchesText = !query || `${movie.title || ''} ${(movie.genres || []).join(' ')}`.toLocaleLowerCase('vi').includes(query);
    const matchesGenre = !state.selectedGenre || (movie.genres || []).includes(state.selectedGenre);
    return matchesText && matchesGenre;
  });
}
function renderMovies() {
  if (state.loadingMovies && !state.movies.length) return '<div class="state-card" role="status">Đang tải danh sách phim…</div>';
  if (state.movieError && !state.movies.length) return `<div class="state-card error-card" role="alert">${safe(state.movieError)} <button class="text-button" id="movies-retry">Thử lại</button></div>`;
  if (!state.movies.length) return '<div class="state-card">Hiện chưa có phim đang chiếu.</div>';
  const movies = filteredMovies();
  if (!movies.length) return '<div class="state-card">Không tìm thấy phim phù hợp. Hãy đổi từ khóa hoặc thể loại.</div>';
  return `<div class="movie-grid">${movies.map((movie, index) => `<button class="movie-card ${state.selectedMovie?._id === movie._id ? 'active' : ''}" data-movie="${safe(movie._id)}" aria-pressed="${state.selectedMovie?._id === movie._id}"><span class="movie-number">${String(index + 1).padStart(2, '0')}</span><span class="movie-art art-${index % 4}"><span class="art-shape"></span><span class="art-word">${safe((movie.title || '').split(' ').slice(0, 2).join('\n'))}</span></span><span class="movie-info"><strong>${safe(movie.title)}</strong><small>${safe((movie.genres || []).join(' · '))} <span>·</span> ${safe(movie.durationMinutes)} phút</small></span><span class="card-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>`;
}
function availableDays() {
  return [...new Set(state.showtimes.map(show => dayKey(show.startAt)).filter(Boolean))].sort();
}
function renderShowtimes() {
  if (state.loadingShowtimes && !state.showtimes.length) return '<div class="state-card" role="status">Đang tải suất chiếu…</div>';
  if (state.showtimeError && !state.showtimes.length) return `<div class="state-card error-card" role="alert">${safe(state.showtimeError)} <button class="text-button" id="showtimes-retry">Thử lại</button></div>`;
  if (!state.showtimes.length) return '<div class="state-card">Phim này chưa có suất chiếu đang mở.</div>';
  const days = availableDays();
  const shows = state.showtimes.filter(show => !state.selectedDay || dayKey(show.startAt) === state.selectedDay);
  if (!shows.length) return '<div class="state-card">Ngày này chưa có suất chiếu. Hãy chọn ngày khác.</div>';
  return `<div class="showtime-list">${shows.map(show => `<button class="showtime-card ${state.selectedShowtime?._id === show._id ? 'active' : ''}" data-show="${safe(show._id)}" aria-pressed="${state.selectedShowtime?._id === show._id}"><span class="showtime-date">${new Date(show.startAt).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span><strong>${new Date(show.startAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</strong><small>${money(show.basePriceVnd)} / vé</small></button>`).join('')}</div>`;
}
function renderSeats() {
  if (state.loadingSeats && !state.seats.length) return '<div class="state-card" role="status">Đang tải sơ đồ ghế…</div>';
  if (state.seatError) return `<div class="state-card error-card" role="alert">${safe(state.seatError)} <button class="text-button" id="seats-retry">Tải lại sơ đồ ghế</button></div>`;
  if (!state.seats.length) return '<div class="state-card">Suất chiếu chưa có dữ liệu ghế.</div>';
  const currentPrice = state.selectedShowtime?.basePriceVnd || 0;
  return `<div class="seat-legend"><span><i class="legend available"></i>Còn trống</span><span><i class="legend chosen"></i>Đang chọn</span><span><i class="legend held"></i>Đang giữ</span><span><i class="legend booked"></i>Đã đặt</span></div><div class="seat-map">${state.seats.map(seat => { const status = seat.status || 'UNAVAILABLE'; const chosen = state.chosen.has(seat.seatCode); const disabled = status !== 'AVAILABLE' || state.loadingSeats; return `<button class="seat ${status.toLowerCase()} ${chosen ? 'chosen' : ''}" data-seat="${safe(seat.seatCode)}" ${disabled ? 'disabled' : ''} aria-label="Ghế ${safe(seat.seatCode)} — ${safe(status)}" aria-pressed="${chosen}">${safe(seat.seatCode)}</button>`; }).join('')}</div><div class="seat-foot"><span>Giá vé đồng nhất theo suất chiếu</span><span>${money(currentPrice)} / ghế</span></div>`;
}
function renderHistory() {
  if (state.loadingHistory && !state.historyLoaded) return '<div class="state-card" role="status">Đang tải lịch sử đặt vé…</div>';
  if (state.historyError && !state.historyLoaded) return `<div class="state-card error-card" role="alert">${safe(state.historyError)} <button class="text-button" id="history-retry">Thử lại</button></div>`;
  const statuses = [...new Set(state.history.map(item => item.status).filter(Boolean))];
  const entries = state.history.filter(item => state.historyStatus === 'ALL' || item.status === state.historyStatus);
  const filters = `<div class="history-controls"><label for="history-status">Trạng thái booking</label><select id="history-status"><option value="ALL">Tất cả trạng thái</option>${statuses.map(status => `<option value="${safe(status)}" ${state.historyStatus === status ? 'selected' : ''}>${safe(bookingStatusLabel(status))}</option>`).join('')}</select></div>`;
  if (!state.history.length) return `${filters}<div class="state-card">Chưa có lịch sử đặt vé.</div>`;
  if (!entries.length) return `${filters}<div class="state-card">Không có booking ở trạng thái này.</div>`;
  return `${filters}<div class="history-list">${entries.map(item => `<article class="history-card"><div class="history-icon" aria-hidden="true">${item.status === 'CONFIRMED' ? '✓' : '–'}</div><div class="history-main"><strong>${safe(item.movieTitle || item.movieId || 'Vé xem phim')}</strong><small>${safe(item._id)} · ${formatDateTime(item.createdAt)}</small><small>Suất chiếu: ${formatDateTime(item.startAt)} · ${safe(item.showtimeId)}</small><small>Ghế ${safe((item.seats || []).map(seat => seat.seatCode).join(', ') || '—')}</small><small class="history-prices">${(item.seats || []).map(seat => `${safe(seat.seatCode)}: ${money(seat.unitPriceVnd)}`).join(' · ')}</small></div><div class="history-side"><span class="status-pill ${safe(item.status).toLowerCase()}">${safe(bookingStatusLabel(item.status))}</span><strong>${money(item.totalAmountVnd)}</strong><small>Tổng tiền</small></div></article>`).join('')}</div>`;
}

function render() {
  if (state.adminMode) {
    app.innerHTML = renderAdmin();
    bindAdminEvents(render, () => { state.adminMode = false; render(); });
    return;
  }
  const currentPrice = state.selectedShowtime?.basePriceVnd || 0;
  const selectedTotal = currentPrice * state.chosen.size;
  const genres = [...new Set(state.movies.flatMap(movie => movie.genres || []))].sort((a, b) => a.localeCompare(b, 'vi'));
  const days = availableDays();
  app.innerHTML = `
    <header class="topbar"><a class="brand" href="#top" aria-label="Rạp Phim, về đầu trang"><span class="brand-mark">R</span><span>RẠP PHIM<span class="brand-sub">ĐẶT VÉ TRỰC TUYẾN</span></span></a><div class="topbar-actions"><button class="history-link" id="history-open">Lịch sử đặt vé <span aria-hidden="true">↗</span></button><button class="history-link admin-link" id="admin-open">Quản trị demo <span aria-hidden="true">↗</span></button></div></header>
    <main id="top">
      <section class="hero"><div class="hero-copy"><p class="eyebrow"><span class="live-dot"></span> TRẢI NGHIỆM ĐIỆN ẢNH</p><h1><span class="hero-line">Một câu chuyện.</span><br/><em class="hero-line">Một chỗ ngồi.</em></h1><p class="hero-text">Chọn phim yêu thích, tìm suất chiếu phù hợp và giữ chỗ chỉ trong vài bước.</p><a class="hero-cta" href="#movies">Khám phá phim <span aria-hidden="true">↓</span></a></div><div class="hero-art" aria-hidden="true"><div class="reel reel-one"></div><div class="reel reel-two"></div><div class="hero-orbit"></div><div class="hero-ticket">TONIGHT<br/><b>IS YOURS</b></div></div><div class="hero-index">01 <span>/</span> 03</div></section>
      ${state.notice ? `<div class="notice ${state.notice.type}" role="status"><span>${safe(state.notice.message)}</span><button id="notice-close" aria-label="Đóng thông báo">×</button></div>` : ''}
      <section class="booking-section" id="movies"><div class="section-heading"><div><p class="eyebrow">CHỌN TÁC PHẨM</p><h2>Đang chiếu <span class="heading-dot">.</span></h2></div><span class="step-label">01 — 03</span></div><div class="catalog-filters"><div class="filter-field"><label for="movie-search">Tìm phim</label><input id="movie-search" type="search" value="${safe(state.movieQuery)}" placeholder="Nhập tên phim hoặc thể loại" autocomplete="off" aria-controls="movie-results" /></div><div class="filter-field"><label for="movie-genre">Thể loại</label><select id="movie-genre"><option value="">Tất cả thể loại</option>${genres.map(genre => `<option value="${safe(genre)}" ${state.selectedGenre === genre ? 'selected' : ''}>${safe(genre)}</option>`).join('')}</select></div></div><div id="movie-results" aria-live="polite">${renderMovies()}</div></section>
      ${state.selectedMovie ? `<section class="booking-section showtime-section"><div class="section-heading"><div><p class="eyebrow">CHỌN THỜI GIAN</p><h2>Suất chiếu</h2></div><span class="step-label">02 — 03</span></div>${state.showtimes.length > 0 ? `<div class="filter-field day-filter"><label for="showtime-day">Ngày chiếu</label><select id="showtime-day" ${days.length < 2 ? 'disabled' : ''}><option value="">Tất cả ngày</option>${days.map(day => `<option value="${day}" ${state.selectedDay === day ? 'selected' : ''}>${new Date(`${day}T12:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long' })}</option>`).join('')}</select>${days.length < 2 ? '<small>Dữ liệu hiện có một ngày chiếu</small>' : ''}</div>` : ''}<div id="showtime-results" aria-live="polite">${renderShowtimes()}</div></section>` : ''}
      ${state.selectedShowtime ? `<section class="booking-section seat-section"><div class="section-heading"><div><p class="eyebrow">CHỌN VỊ TRÍ</p><h2>Chọn ghế</h2></div><span class="step-label">03 — 03</span></div><div class="screen-wrap"><div class="screen"></div><span>MÀN HÌNH</span></div><div id="seat-results" aria-live="polite">${renderSeats()}</div></section><section class="checkout-bar"><div><small>GHẾ ĐÃ CHỌN</small><strong>${state.chosen.size ? safe([...state.chosen].join(', ')) : 'Chưa chọn ghế'}</strong></div><div class="checkout-total"><small>TẠM TÍNH</small><strong>${money(selectedTotal)}</strong></div><button class="primary-button" id="book-now" ${!state.chosen.size || state.loadingSeats || state.submittingBooking ? 'disabled' : ''}>${state.submittingBooking ? 'Đang xử lý…' : 'Đặt vé'} <span aria-hidden="true">→</span></button></section>` : ''}
      <section class="history-section" id="history"><div class="section-heading"><div><p class="eyebrow">TÀI KHOẢN DEMO</p><h2>Vé của bạn</h2></div><button class="text-button" id="history-refresh" ${state.loadingHistory ? 'disabled' : ''}>${state.loadingHistory ? 'Đang tải…' : 'Làm mới ↻'}</button></div><div id="history-results">${renderHistory()}</div></section>
      <footer><span>RẠP PHIM</span><span>ĐỒ ÁN CƠ SỞ DỮ LIỆU NoSQL · THANH TOÁN MÔ PHỎNG</span></footer>
    </main>
    ${state.notice?.type === 'success' ? `<div class="success-toast" role="alert"><span class="toast-check">✓</span><div><strong>Đặt vé thành công</strong><small>${safe(state.notice.message)}</small></div><button id="toast-close" aria-label="Đóng">×</button></div>` : ''}`;
  bindEvents();
}

function bindMovieButtons() { document.querySelectorAll('[data-movie]').forEach(button => button.onclick = () => selectMovie(button.dataset.movie)); }
function bindShowtimeButtons() { document.querySelectorAll('[data-show]').forEach(button => button.onclick = () => selectShowtime(button.dataset.show)); }
function bindEvents() {
  const search = document.querySelector('#movie-search');
  search?.addEventListener('input', () => { state.movieQuery = search.value; const results = document.querySelector('#movie-results'); if (results) results.innerHTML = renderMovies(); bindMovieButtons(); });
  document.querySelector('#movie-genre')?.addEventListener('change', event => { state.selectedGenre = event.target.value; const results = document.querySelector('#movie-results'); if (results) results.innerHTML = renderMovies(); bindMovieButtons(); });
  document.querySelector('#movies-retry')?.addEventListener('click', loadMovies);
  document.querySelector('#showtime-day')?.addEventListener('change', event => { state.selectedDay = event.target.value; const results = document.querySelector('#showtime-results'); if (results) results.innerHTML = renderShowtimes(); bindShowtimeButtons(); });
  document.querySelector('#showtimes-retry')?.addEventListener('click', () => state.selectedMovie && selectMovie(state.selectedMovie._id));
  bindMovieButtons(); bindShowtimeButtons();
  document.querySelectorAll('[data-seat]').forEach(button => button.onclick = () => { const code = button.dataset.seat; state.chosen.has(code) ? state.chosen.delete(code) : state.chosen.add(code); render(); });
  document.querySelector('#seats-retry')?.addEventListener('click', refreshSeats);
  document.querySelector('#book-now')?.addEventListener('click', submitBooking);
  document.querySelector('#history-open')?.addEventListener('click', () => document.querySelector('#history').scrollIntoView({ behavior: 'smooth' }));
  document.querySelector('#admin-open')?.addEventListener('click', () => { state.adminMode = true; openAdmin(render); });
  document.querySelector('#history-refresh')?.addEventListener('click', loadHistory);
  document.querySelector('#history-retry')?.addEventListener('click', loadHistory);
  document.querySelector('#history-status')?.addEventListener('change', event => { state.historyStatus = event.target.value; const results = document.querySelector('#history-results'); if (results) results.innerHTML = renderHistory(); bindHistoryFilter(); });
  document.querySelector('#notice-close')?.addEventListener('click', () => { state.notice = null; render(); });
  document.querySelector('#toast-close')?.addEventListener('click', () => { state.notice = null; render(); });
}
function bindHistoryFilter() { document.querySelector('#history-status')?.addEventListener('change', event => { state.historyStatus = event.target.value; const results = document.querySelector('#history-results'); if (results) results.innerHTML = renderHistory(); bindHistoryFilter(); }); }

async function loadMovies() {
  state.loadingMovies = true; state.movieError = ''; render();
  try { state.movies = await request('/api/movies'); }
  catch (error) { state.movieError = `${error.message} Kiểm tra backend tại ${API}.`; }
  finally { state.loadingMovies = false; render(); }
}
async function selectMovie(id) {
  state.selectedMovie = state.movies.find(movie => movie._id === id) || null;
  state.selectedShowtime = null; state.showtimes = []; state.seats = []; state.chosen.clear(); state.selectedDay = ''; state.showtimeError = ''; state.notice = null;
  state.loadingShowtimes = true; render();
  try { state.showtimes = await request(`/api/movies/${encodeURIComponent(id)}/showtimes`); }
  catch (error) { state.showtimeError = error.message; }
  finally { state.loadingShowtimes = false; render(); }
}
async function selectShowtime(id) {
  state.selectedShowtime = state.showtimes.find(show => show._id === id) || null;
  state.seats = []; state.chosen.clear(); state.seatError = ''; state.notice = null;
  state.loadingSeats = true; render();
  try { state.seats = await request(`/api/showtimes/${encodeURIComponent(id)}/seats`); }
  catch (error) { state.seatError = error.message; }
  finally { state.loadingSeats = false; render(); }
}
async function refreshSeats() {
  if (!state.selectedShowtime) return;
  state.loadingSeats = true; state.seatError = ''; render();
  try { state.seats = await request(`/api/showtimes/${encodeURIComponent(state.selectedShowtime._id)}/seats`); }
  catch (error) { state.seatError = error.message; }
  finally { state.loadingSeats = false; render(); }
}
async function submitBooking() {
  if (!state.selectedShowtime || !state.chosen.size || state.loadingSeats || state.submittingBooking) return;
  state.submittingBooking = true; state.notice = null; render();
  try {
    const booking = await request('/api/bookings', { method: 'POST', body: JSON.stringify({ customerId: CUSTOMER_ID, showtimeId: state.selectedShowtime._id, seatCodes: [...state.chosen] }) });
    state.chosen.clear(); state.notice = { type: 'success', message: `${booking._id} · ${booking.seats.map(seat => seat.seatCode).join(', ')} · ${money(booking.totalAmountVnd)} · thanh toán mô phỏng` };
    await Promise.all([refreshSeats(), loadHistoryData()]);
  } catch (error) {
    state.notice = { type: 'error', message: error.message };
    if (error.status === 409) { state.chosen.clear(); try { await refreshSeats(); } catch { /* giữ thông báo lỗi gốc */ } }
  } finally { state.submittingBooking = false; render(); }
}
async function loadHistoryData() { state.history = await request(`/api/customers/${encodeURIComponent(CUSTOMER_ID)}/bookings/details`); state.historyLoaded = true; }
async function loadHistory() {
  state.loadingHistory = true; state.historyError = ''; render();
  try { await loadHistoryData(); }
  catch (error) { state.historyError = error.message; }
  finally { state.loadingHistory = false; render(); }
}

render();
await Promise.all([loadMovies(), loadHistory()]);
