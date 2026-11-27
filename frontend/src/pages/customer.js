import {api} from '../api/client.js';
import {store,posterStyle} from '../app/store.js';
import {shell,bindShell} from '../components/customer-shell.js';
import {go} from '../app/router.js';
import {confirmDialog} from '../ui.js';

const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>new Intl.NumberFormat('vi-VN').format(value||0)+' ₫';
const dateTime=value=>new Date(value).toLocaleString('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const selectionKey='cinevue.checkout';
const resultKey='cinevue.lastBooking';

function cards(items){
  return `<div class="catalog-grid">${items.map(movie=>`<article class="catalog-card interactive-movie" tabindex="0" role="link" data-movie-card="${movie._id}" aria-label="Mở ${safe(movie.title)}"><div class="catalog-poster" style="${posterStyle(movie)}"><span>${movie.status==='COMING_SOON'?'Sắp chiếu':'Đang chiếu'}</span><div class="movie-hover-cue"><strong>${movie.status==='NOW_SHOWING'?'Xem lịch chiếu':'Xem thông tin'}</strong><small>Nhấn để mở →</small></div></div><div><h3>${safe(movie.title)}</h3><p>${safe((movie.genres||[]).join(' · '))} · ${movie.durationMinutes} phút</p></div></article>`).join('')}</div>`;
}

function bindCards(){
  document.querySelectorAll('[data-movie-card]').forEach(card=>{const open=()=>go(`#/movies/${card.dataset.movieCard}`);card.onclick=open;card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}};});
}

function showError(app,error,render){
  app.innerHTML=shell(`<section class="page-section page-top"><div class="error-panel"><h2>Không thể hoàn tất yêu cầu</h2><p>${safe(error.message)}</p><button class="primary-button" data-go="#/movies">Xem phim khác</button></div></section>`);
  bindShell(render);
}

export async function ensureBase(){
  if(store.catalog.length)return;
  const [customers,catalog,movies]=await Promise.all([api('/api/customers'),api('/api/catalog/movies'),api('/api/movies')]);
  store.customers=customers;store.catalog=catalog;store.movies=movies;
  if(!customers.some(customer=>customer._id===store.customerId)&&customers[0])store.customerId=customers[0]._id;
}

export function renderHome(app,render){
  const upcoming=store.catalog.filter(movie=>movie.status==='COMING_SOON').slice(0,4);
  app.innerHTML=shell(`<section class="product-hero"><div><p class="eyebrow">CINEVUE</p><h1>Chọn câu chuyện.<br>Giữ chỗ ngồi.</h1><p>Khám phá phim đang chiếu và hoàn tất vé trong một quy trình rõ ràng.</p><button class="primary-button" data-go="#/movies">Khám phá phim</button></div></section><section class="page-section"><div class="page-heading"><div><p class="eyebrow">ĐANG CHIẾU</p><h2>Phim nổi bật</h2></div><button class="text-button" data-go="#/movies">Xem tất cả</button></div>${cards(store.movies.slice(0,4))}</section>${upcoming.length?`<section class="page-section muted-section"><div class="page-heading"><div><p class="eyebrow">SẮP RA MẮT</p><h2>Đón chờ tại CineVue</h2></div></div>${cards(upcoming)}</section>`:''}`);
  bindShell(render);bindCards();
}

export function renderMovies(app,render){
  app.innerHTML=shell(`<section class="page-section page-top"><div class="page-heading"><div><p class="eyebrow">DANH MỤC PHIM</p><h1>Chọn phim bạn muốn xem</h1><p>Tìm theo tên hoặc thể loại, sau đó mở lịch chiếu của phim.</p></div></div><div class="catalog-toolbar"><input id="catalog-search" type="search" placeholder="Tìm tên phim hoặc thể loại"><select id="catalog-status"><option value="">Tất cả trạng thái</option><option value="NOW_SHOWING">Đang chiếu</option><option value="COMING_SOON">Sắp chiếu</option></select></div><div id="catalog-results">${cards(store.catalog)}</div></section>`,{active:'movies'});
  bindShell(render);
  const update=()=>{
    const query=document.querySelector('#catalog-search').value.toLowerCase();
    const status=document.querySelector('#catalog-status').value;
    const items=store.catalog.filter(movie=>(!query||`${movie.title} ${(movie.genres||[]).join(' ')}`.toLowerCase().includes(query))&&(!status||movie.status===status));
    document.querySelector('#catalog-results').innerHTML=items.length?cards(items):'<div class="empty-panel">Không tìm thấy phim phù hợp. Hãy thay đổi bộ lọc.</div>';
    bindCards();
  };
  document.querySelector('#catalog-search').oninput=update;
  document.querySelector('#catalog-status').onchange=update;
  bindCards();
}

export async function renderMovie(app,id,render){
  const token=++store.request;
  app.innerHTML=shell('<section class="page-section page-top"><div class="loading-panel">Đang tải thông tin phim…</div></section>',{active:'movies'});bindShell(render);
  try{
    const [movie,shows]=await Promise.all([api(`/api/movies/${encodeURIComponent(id)}`),api(`/api/movies/${encodeURIComponent(id)}/showtimes`)]);
    if(token!==store.request)return;
    app.innerHTML=shell(`<section class="movie-detail page-section page-top"><div class="detail-poster" style="${posterStyle(movie)}"></div><div><button class="text-button" data-go="#/movies">← Danh sách phim</button><p class="eyebrow">${movie.status==='COMING_SOON'?'SẮP CHIẾU':'ĐANG CHIẾU'}</p><h1>${safe(movie.title)}</h1><p class="detail-meta">${safe((movie.genres||[]).join(' · '))} · ${movie.durationMinutes} phút</p><p class="detail-copy">${safe(movie.synopsis||'Thông tin nội dung đang được cập nhật.')}</p><h2>Lịch chiếu</h2>${shows.length?`<div class="showtime-list">${shows.map(show=>`<button class="showtime-card" data-show="${show._id}"><span>${new Date(show.startAt).toLocaleDateString('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit'})}</span><strong>${new Date(show.startAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</strong><small>${money(show.basePriceVnd)}</small></button>`).join('')}</div>`:'<div class="empty-panel">Phim chưa có suất chiếu đang mở.</div>'}</div></section>`,{active:'movies'});
    bindShell(render);
    document.querySelectorAll('[data-show]').forEach(button=>button.onclick=()=>go(`#/booking/${button.dataset.show}`));
  }catch(error){showError(app,error,render);}
}

export async function renderBooking(app,id,render){
  app.innerHTML=shell('<section class="page-section page-top"><div class="loading-panel">Đang tải sơ đồ ghế…</div></section>',{active:'movies'});bindShell(render);
  try{
    const [show,seats]=await Promise.all([api(`/api/showtimes/${encodeURIComponent(id)}`),api(`/api/showtimes/${encodeURIComponent(id)}/seats`)]);
    const selected=new Set();
    app.innerHTML=shell(`<section class="page-section page-top"><button class="text-button" data-go="#/movies/${show.movie._id}">← Đổi suất chiếu</button><div class="booking-head"><div><p class="eyebrow">CHỌN GHẾ</p><h1>${safe(show.movie.title)}</h1><p>${dateTime(show.startAt)} · ${safe(show.room.name||show.room._id)}</p></div><div class="stepper"><b>1</b><span>Chọn ghế</span><i></i><b>2</b><span>Thanh toán</span></div></div><div class="booking-layout"><div class="seat-panel"><div class="cinema-screen">MÀN HÌNH</div><div class="seat-map">${seats.map(seat=>`<button class="seat ${seat.status!=='AVAILABLE'?'unavailable':''}" data-seat="${safe(seat.seatCode)}" ${seat.status!=='AVAILABLE'?'disabled':''} aria-label="Ghế ${safe(seat.seatCode)}">${safe(seat.seatCode)}</button>`).join('')}</div><div class="seat-legend"><span><i class="available"></i>Còn trống</span><span><i class="chosen"></i>Đang chọn</span><span><i class="sold"></i>Đã bán</span></div></div><aside class="order-card"><p class="eyebrow">TÓM TẮT</p><h2>Đơn đặt vé</h2><dl><div><dt>Phim</dt><dd>${safe(show.movie.title)}</dd></div><div><dt>Suất</dt><dd>${dateTime(show.startAt)}</dd></div><div><dt>Phòng</dt><dd>${safe(show.room.name||show.room._id)}</dd></div><div><dt>Ghế</dt><dd id="chosen-seats">Chưa chọn</dd></div><div><dt>Đơn giá</dt><dd>${money(show.basePriceVnd)}</dd></div><div class="order-total"><dt>Tổng cộng</dt><dd id="order-total">0 ₫</dd></div></dl><p class="inline-error" id="seat-error"></p><button class="primary-button full-button" id="continue-booking" disabled>Tiếp tục thanh toán</button></aside></div></section>`,{active:'movies'});
    bindShell(render);
    const update=()=>{
      document.querySelector('#chosen-seats').textContent=[...selected].join(', ')||'Chưa chọn';
      document.querySelector('#order-total').textContent=money(selected.size*show.basePriceVnd);
      document.querySelector('#continue-booking').disabled=!selected.size;
    };
    document.querySelectorAll('[data-seat]:not(:disabled)').forEach(button=>button.onclick=()=>{
      selected.has(button.dataset.seat)?selected.delete(button.dataset.seat):selected.add(button.dataset.seat);
      button.classList.toggle('selected',selected.has(button.dataset.seat));update();
    });
    document.querySelector('#continue-booking').onclick=()=>{
      sessionStorage.setItem(selectionKey,JSON.stringify({customerId:store.customerId,showtimeId:show._id,seatCodes:[...selected],show}));
      go('#/checkout');
    };
  }catch(error){showError(app,error,render);}
}

export async function renderCheckout(app,render){
  const draft=JSON.parse(sessionStorage.getItem(selectionKey)||'null');
  if(!draft?.seatCodes?.length||draft.customerId!==store.customerId){
    app.innerHTML=shell('<section class="page-section page-top"><div class="empty-panel"><h1>Chưa có ghế được chọn</h1><p>Hãy chọn phim, suất chiếu và ghế trước khi thanh toán.</p><button class="primary-button" data-go="#/movies">Chọn phim</button></div></section>',{active:'movies'});bindShell(render);return;
  }
  const show=await api(`/api/showtimes/${encodeURIComponent(draft.showtimeId)}`);
  const customer=store.customers.find(item=>item._id===store.customerId);
  const total=draft.seatCodes.length*show.basePriceVnd;
  app.innerHTML=shell(`<section class="page-section page-top checkout-page"><button class="text-button" data-go="#/booking/${show._id}">← Chọn lại ghế</button><div class="booking-head"><div><p class="eyebrow">THANH TOÁN</p><h1>Xác nhận đơn đặt vé</h1><p>Kiểm tra thông tin trước khi hoàn tất.</p></div><div class="stepper"><b class="done">✓</b><span>Chọn ghế</span><i></i><b>2</b><span>Thanh toán</span></div></div><div class="checkout-layout"><div class="checkout-card"><h2>Thông tin vé</h2><dl><div><dt>Khách hàng</dt><dd>${safe(customer?.fullName)} · ${safe(store.customerId)}</dd></div><div><dt>Phim</dt><dd>${safe(show.movie.title)}</dd></div><div><dt>Thời gian</dt><dd>${dateTime(show.startAt)}</dd></div><div><dt>Phòng</dt><dd>${safe(show.room.name||show.room._id)}</dd></div><div><dt>Ghế</dt><dd>${draft.seatCodes.map(safe).join(', ')}</dd></div></dl></div><aside class="order-card"><p class="eyebrow">THANH TOÁN MÔ PHỎNG</p><h2>${money(total)}</h2><p>Hệ thống sẽ xác nhận thanh toán và khóa các ghế đã chọn trong một thao tác.</p><p class="inline-error" id="checkout-error"></p><button class="primary-button full-button" id="pay-button">Thanh toán & nhận vé</button><small>Không phát sinh giao dịch tài chính thật.</small></aside></div></section>`,{active:'movies'});
  bindShell(render);
  document.querySelector('#pay-button').onclick=async event=>{
    const button=event.currentTarget;button.disabled=true;button.textContent='Đang xác nhận…';
    try{
      const booking=await api('/api/bookings',{method:'POST',body:JSON.stringify({customerId:store.customerId,showtimeId:show._id,seatCodes:draft.seatCodes})});
      sessionStorage.setItem(resultKey,JSON.stringify({...booking,movieTitle:show.movie.title,startAt:show.startAt,roomId:show.room.name||show.room._id}));
      sessionStorage.removeItem(selectionKey);go('#/booking-success');
    }catch(error){document.querySelector('#checkout-error').textContent=error.message;button.disabled=false;button.textContent='Thử thanh toán lại';}
  };
}

export function renderSuccess(app,render){
  const booking=JSON.parse(sessionStorage.getItem(resultKey)||'null');
  if(!booking){go('#/my-tickets');return;}
  app.innerHTML=shell(`<section class="page-section page-top success-page"><div class="success-mark">✓</div><p class="eyebrow">ĐẶT VÉ THÀNH CÔNG</p><h1>Hẹn gặp bạn tại rạp!</h1><p>Vé đã được xác nhận và lưu trong mục Vé của tôi.</p><article class="ticket-card featured"><div><small>MÃ ĐẶT VÉ</small><strong>${safe(booking._id)}</strong></div><div><small>PHIM</small><strong>${safe(booking.movieTitle)}</strong></div><div><small>SUẤT CHIẾU</small><strong>${dateTime(booking.startAt)}</strong></div><div><small>GHẾ</small><strong>${booking.seats.map(seat=>safe(seat.seatCode)).join(', ')}</strong></div><div><small>TỔNG TIỀN</small><strong>${money(booking.totalAmountVnd)}</strong></div></article><div class="success-actions"><button class="primary-button" data-go="#/my-tickets">Xem vé của tôi</button><button class="outline-button" data-go="#/movies">Tiếp tục xem phim</button></div></section>`,{active:'tickets'});bindShell(render);
}

export async function renderTickets(app,render){
  app.innerHTML=shell('<section class="page-section page-top"><div class="loading-panel">Đang tải vé của bạn…</div></section>',{active:'tickets'});bindShell(render);
  try{
    const bookings=await api(`/api/customers/${encodeURIComponent(store.customerId)}/bookings/details`);
    app.innerHTML=shell(`<section class="page-section page-top"><div class="page-heading"><div><p class="eyebrow">TÀI KHOẢN DEMO</p><h1>Vé của tôi</h1><p>${safe(store.customers.find(item=>item._id===store.customerId)?.fullName)} · ${safe(store.customerId)}</p></div></div>${bookings.length?`<div class="ticket-list">${bookings.map(booking=>`<article class="ticket-card"><div class="ticket-status ${booking.status.toLowerCase()}">${booking.status==='CONFIRMED'?'Đã xác nhận':'Đã hủy'}</div><div><small>PHIM</small><strong>${safe(booking.movieTitle||booking.movieId)}</strong><span>${booking.startAt?dateTime(booking.startAt):'Không còn dữ liệu suất chiếu'}</span></div><div><small>PHÒNG / GHẾ</small><strong>${safe(booking.roomId||'—')} · ${(booking.seats||[]).map(seat=>safe(seat.seatCode)).join(', ')}</strong><span>${safe(booking._id)}</span></div><div><small>TỔNG TIỀN</small><strong>${money(booking.totalAmountVnd)}</strong>${booking.status==='CONFIRMED'&&new Date(booking.startAt)>new Date()?`<button class="text-button danger-text" data-cancel="${booking._id}">Hủy vé</button>`:''}</div></article>`).join('')}</div>`:'<div class="empty-panel"><h2>Bạn chưa có vé nào</h2><p>Chọn một bộ phim và suất chiếu phù hợp để bắt đầu.</p><button class="primary-button" data-go="#/movies">Khám phá phim</button></div>'}</section>`,{active:'tickets'});
    bindShell(render);
    document.querySelectorAll('[data-cancel]').forEach(button=>button.onclick=async()=>{
      const accepted=await confirmDialog({title:'Hủy vé đã đặt?',message:'Ghế sẽ được trả lại sơ đồ và hoàn tiền mô phỏng sẽ được ghi nhận.',summary:`Mã vé: ${button.dataset.cancel}`,confirmLabel:'Xác nhận hủy'});
      if(!accepted)return;
      try{await api(`/api/customers/${encodeURIComponent(store.customerId)}/bookings/${encodeURIComponent(button.dataset.cancel)}/cancel`,{method:'POST'});renderTickets(app,render);}catch(error){alert(error.message);}
    });
  }catch(error){showError(app,error,render);}
}
