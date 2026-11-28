import { api } from "../api/client.js";
import { store, posterStyle } from "../app/store.js";
import { shell, bindShell } from "../components/customer-shell.js";
import { confirmDialog, escapeHtml as safe, toast } from "../ui.js";
import { containsText, compareId } from "../app/query.js";

const money = (n) => new Intl.NumberFormat("vi-VN").format(n || 0) + " ₫";
const date = (n) =>
  n
    ? new Date(n).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Chưa có thông tin";
const day = (n) =>
  new Date(n).toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
const label = (n) =>
  ({
    CONFIRMED: "Đã xác nhận",
    CANCELLED: "Đã hủy",
    PENDING: "Đang xử lý",
    SUCCESS: "Thành công",
    FAILED: "Không thành công",
  })[n] || "Chưa xác định";
const badge = (n) =>
  `<span class="status-pill ${n === "CANCELLED" ? "cancelled" : ""}">${label(n)}</span>`;
const loading = (app, active) => {
  app.innerHTML = shell(
    '<section class="page-section page-top"><div class="loading-panel" role="status">Đang tải…</div></section>',
    { active },
  );
};
function fail(app, error, render) {
  app.innerHTML = shell(
    `<section class="page-section page-top"><div class="error-panel"><h1>Không thể tải nội dung</h1><p>${safe(error.message)}</p><button class="primary-button" id="retry-page">Thử lại</button></div></section>`,
  );
  bindShell(render);
  document.querySelector("#retry-page").onclick = render;
}

export function renderMovies(app, render) {
  const genres = [
    ...new Set(store.catalog.flatMap((m) => m.genres || [])),
  ].sort((a, b) => a.localeCompare(b, "vi"));
  app.innerHTML = shell(
    `<section class="page-section page-top"><div class="page-heading"><h1>Phim tại CINEVUE</h1><a href="#/schedule" class="text-button">Xem lịch chiếu →</a></div><form class="filter-toolbar" id="movie-filters"><label>Tìm phim<input name="q" type="search" placeholder="Nhập tên phim"></label><label>Thể loại<select name="genre"><option value="">Tất cả thể loại</option>${genres.map((g) => `<option>${safe(g)}</option>`).join("")}</select></label><label>Trạng thái<select name="status"><option value="">Tất cả</option><option value="NOW_SHOWING">Đang chiếu</option><option value="COMING_SOON">Sắp chiếu</option></select></label><label>Sắp xếp<select name="sort"><option value="asc">Tên A → Z</option><option value="desc">Tên Z → A</option></select></label><button type="reset" class="outline-button">Xóa bộ lọc</button></form><p id="movie-count" aria-live="polite"></p><div id="movie-results"></div></section>`,
    { active: "movies" },
  );
  bindShell(render);
  const form = document.querySelector("#movie-filters");
  const update = () => {
    const f = Object.fromEntries(new FormData(form));
    const movies = store.catalog
      .filter(
        (m) =>
          containsText(m.title, f.q) &&
          (!f.genre || m.genres.includes(f.genre)) &&
          (!f.status || m.status === f.status),
      )
      .sort(
        (a, b) =>
          (f.sort === "asc" ? 1 : -1) * (a.title.localeCompare(b.title, "vi") || compareId(a, b)),
      );
    document.querySelector("#movie-count").textContent =
      `${movies.length} phim phù hợp`;
    document.querySelector("#movie-results").innerHTML = movies.length
      ? `<div class="catalog-grid">${movies.map((m) => `<a class="catalog-card interactive-movie" href="#/movies/${encodeURIComponent(m._id)}" aria-label="Xem ${safe(m.title)}"><div class="catalog-poster" style="${posterStyle(m)}"><span>${m.status === "NOW_SHOWING" ? "Đang chiếu" : "Sắp chiếu"}</span><div class="movie-hover-cue"><strong>Xem chi tiết & lịch chiếu</strong></div></div><div><h3>${safe(m.title)}</h3><p>${safe(m.genres.join(" · "))} · ${m.durationMinutes} phút</p></div></a>`).join("")}</div>`
      : '<div class="empty-panel">Không tìm thấy phim phù hợp. Hãy thử thay đổi hoặc xóa bộ lọc.</div>';
  };
  form.oninput = update;
  form.onchange = update;
  form.onreset = () => setTimeout(update);
  form.onsubmit = (e) => e.preventDefault();
  update();
}

export async function renderSchedule(app, render) {
  const token = store.request;
  loading(app, "schedule");
  bindShell(render);
  try {
    const shows = await api("/api/schedule");
    if (token !== store.request) return;
    const today = day(new Date());
    const futureDays = [
      ...new Set(
        shows.filter((s) => day(s.startAt) >= today).map((s) => day(s.startAt)),
      ),
    ];
    app.innerHTML = shell(
      `<section class="page-section page-top"><div class="page-heading"><div><h1>Lịch chiếu</h1><p>Chọn ngày và phim để tìm suất phù hợp.</p></div></div><form class="filter-toolbar" id="schedule-filters"><label>Ngày chiếu<input type="date" name="day" value="${futureDays[0] || today}"></label><label>Phim<select name="movie"><option value="">Tất cả phim</option>${store.catalog.map((m) => `<option value="${safe(m._id)}">${safe(m.title)}</option>`).join("")}</select></label><button type="reset" class="outline-button">Xóa bộ lọc</button></form><div id="schedule-results"></div></section>`,
      { active: "schedule" },
    );
    bindShell(render);
    const form = document.querySelector("#schedule-filters");
    const update = () => {
      const f = Object.fromEntries(new FormData(form));
      const items = shows.filter(
        (s) => day(s.startAt) === f.day && (!f.movie || s.movieId === f.movie),
      );
      const groups = [...new Set(items.map((s) => s.movieId))];
      document.querySelector("#schedule-results").innerHTML = groups.length
        ? groups
            .map(
              (id) =>
                `<article class="schedule-group"><h2><a href="#/movies/${safe(id)}">${safe(items.find((s) => s.movieId === id).movieTitle)}</a></h2><div class="showtime-list">${items
                  .filter((s) => s.movieId === id)
                  .map(
                    (s) =>
                      `<a class="showtime-card ${s.bookable ? "" : "show-closed"}" ${s.bookable ? `href="#/booking/${safe(s._id)}"` : 'aria-disabled="true"'}><strong>${new Date(s.startAt).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}</strong><span>${safe(s.roomName)}</span><small>${money(s.basePriceVnd)}</small><small>${s.bookable ? "Chọn ghế" : new Date(s.startAt) <= new Date() ? "Đã bắt đầu" : "Chưa mở bán"}</small></a>`,
                  )
                  .join("")}</div></article>`,
            )
            .join("")
        : '<div class="empty-panel">Chưa có suất chiếu trong ngày đã chọn.</div>';
    };
    form.onchange = update;
    form.onreset = () => setTimeout(update);
    form.onsubmit = (e) => e.preventDefault();
    update();
  } catch (e) {
    if (token === store.request) fail(app, e, render);
  }
}

function details(b) {
  return `<div class="ticket-details print-ticket"><div class="page-heading"><h2>${safe(b.movieTitle || b.movieId)}</h2>${badge(b.status)}</div><dl class="detail-grid"><div><dt>Mã đơn đặt vé</dt><dd>${safe(b._id)}</dd></div><div><dt>Ngày giờ chiếu</dt><dd>${date(b.startAt)}</dd></div><div><dt>Phòng chiếu</dt><dd>${safe(b.roomName || b.roomId || "—")}</dd></div><div><dt>Ghế · Số vé</dt><dd>${b.seats.map((s) => safe(s.seatCode)).join(", ")} · ${b.seats.length} vé</dd></div><div><dt>Ngày đặt</dt><dd>${date(b.createdAt)}</dd></div><div><dt>Thanh toán mô phỏng</dt><dd>${label(b.payment?.status)}</dd></div><div><dt>Giá từng vé</dt><dd>${b.seats.map((s) => `${safe(s.seatCode)}: ${money(s.unitPriceVnd)}`).join("<br>")}</dd></div><div><dt>Tổng tiền</dt><dd><strong>${money(b.totalAmountVnd)}</strong></dd></div>${b.cancellation ? `<div><dt>Ngày hủy</dt><dd>${date(b.cancellation.cancelledAt)}</dd></div><div><dt>Hoàn tiền mô phỏng</dt><dd>${label(b.cancellation.refund?.status)}</dd></div>` : ""}</dl></div>`;
}
const canCancel = (b) =>
  b.status === "CONFIRMED" && b.startAt && new Date(b.startAt) > new Date();
async function cancel(b, button, refresh) {
  if (
    !(await confirmDialog({
      title: "Hủy vé " + b.movieTitle,
      message:
        "Các ghế sẽ được trả lại để đặt vé. Hệ thống ghi nhận hoàn tiền mô phỏng, không có giao dịch tài chính thật.",
      summary: `${b._id} · ${date(b.startAt)} · Ghế ${b.seats.map((s) => s.seatCode).join(", ")}`,
      cancelLabel: "Giữ vé",
      confirmLabel: "Xác nhận hủy vé",
    }))
  )
    return;
  button.disabled = true;
  button.textContent = "Đang hủy…";
  try {
    await api(
      `/api/customers/${encodeURIComponent(store.customerId)}/bookings/${encodeURIComponent(b._id)}/cancel`,
      { method: "POST" },
    );
    toast("Đã hủy vé và trả lại ghế.");
    await refresh();
  } catch (e) {
    toast(e.message, "error");
    button.disabled = false;
    button.textContent = "Hủy vé";
  }
}

export async function renderTicket(app, id, render) {
  const token = store.request;
  loading(app, "tickets");
  bindShell(render);
  try {
    const rows = await api(
      `/api/customers/${encodeURIComponent(store.customerId)}/bookings/details`,
    );
    if (token !== store.request) return;
    const b = rows.find((x) => x._id === id);
    if (!b) throw new Error("Không tìm thấy vé trong hồ sơ đang chọn.");
    app.innerHTML = shell(
      `<section class="page-section page-top"><a href="#/my-tickets" class="text-button">← Vé của tôi</a><h1>Chi tiết vé</h1>${details(b)}<div class="success-actions"><button class="outline-button" id="print-ticket">In vé</button>${canCancel(b) ? '<button class="outline-button danger-text" id="cancel-ticket">Hủy vé</button>' : ""}</div></section>`,
      { active: "tickets" },
    );
    bindShell(render);
    document.querySelector("#print-ticket").onclick = () => window.print();
    document
      .querySelector("#cancel-ticket")
      ?.addEventListener("click", (e) =>
        cancel(b, e.currentTarget, () => renderTicket(app, id, render)),
      );
  } catch (e) {
    if (token === store.request) fail(app, e, render);
  }
}

export async function renderTickets(app, render) {
  const token = store.request;
  loading(app, "tickets");
  bindShell(render);
  try {
    const rows = await api(
      `/api/customers/${encodeURIComponent(store.customerId)}/bookings/details`,
    );
    if (token !== store.request) return;
    app.innerHTML = shell(
      `<section class="page-section page-top"><div class="page-heading"><div><h1>Vé của tôi</h1><p>${safe(store.customers.find((c) => c._id === store.customerId)?.fullName)}</p></div></div><form class="filter-toolbar" id="ticket-filters"><label>Tìm vé<input name="q" type="search" placeholder="Mã đơn hoặc tên phim"></label><label>Nhóm vé<select name="group"><option value="upcoming">Vé sắp chiếu</option><option value="history">Lịch sử đặt vé</option><option value="cancelled">Vé đã hủy</option><option value="all">Tất cả vé</option></select></label><label>Trạng thái<select name="status"><option value="">Tất cả trạng thái</option><option value="CONFIRMED">Đã xác nhận</option><option value="CANCELLED">Đã hủy</option><option value="PENDING">Đang xử lý</option></select></label><label>Ngày đặt<select name="sort"><option value="desc">Mới nhất</option><option value="asc">Cũ nhất</option></select></label><button type="reset" class="outline-button">Xóa bộ lọc</button></form><div id="ticket-results" aria-live="polite"></div></section>`,
      { active: "tickets" },
    );
    bindShell(render);
    let page = 1;
    const form = document.querySelector("#ticket-filters");
    const update = () => {
      const f = Object.fromEntries(new FormData(form));
      const items = rows
        .filter(
          (b) =>
            (!f.status || b.status === f.status) &&
            containsText(`${b._id} ${b.movieTitle}`, f.q) &&
            (f.group === "all" ||
              (f.group === "upcoming"
                ? canCancel(b)
                : f.group === "cancelled"
                  ? b.status === "CANCELLED"
                  : b.status !== "CANCELLED" &&
                    new Date(b.startAt) <= new Date())),
        )
        .sort(
          (a, b) =>
            (f.sort === "asc" ? 1 : -1) *
            (new Date(a.createdAt) - new Date(b.createdAt) || compareId(a, b)),
        );
      const pages = Math.max(1, Math.ceil(items.length / 8));
      page = Math.min(page, pages);
      document.querySelector("#ticket-results").innerHTML =
        `<p>${items.length} đơn đặt vé</p>${
          items.length
            ? `<div class="ticket-list">${items
                .slice((page - 1) * 8, page * 8)
                .map(
                  (b) =>
                    `<article class="ticket-summary"><a href="#/my-tickets/${encodeURIComponent(b._id)}"><strong>${safe(b.movieTitle || b.movieId)}</strong><span>${date(b.startAt)} · ${b.seats.length} vé</span><small>${safe(b._id)}</small></a>${badge(b.status)}<strong>${money(b.totalAmountVnd)}</strong><a class="outline-button" href="#/my-tickets/${encodeURIComponent(b._id)}">Chi tiết vé</a></article>`,
                )
                .join(
                  "",
                )}</div><div class="pagination"><button class="outline-button" id="tickets-prev" ${page === 1 ? "disabled" : ""}>Trước</button><span>Trang ${page}/${pages}</span><button class="outline-button" id="tickets-next" ${page === pages ? "disabled" : ""}>Sau</button></div>`
            : '<div class="empty-panel">Không có vé phù hợp với lựa chọn. Bạn có thể chọn nhóm khác hoặc <a href="#/movies">khám phá phim</a>.</div>'
        }`;
      document.querySelector("#tickets-prev")?.addEventListener("click", () => {
        page--;
        update();
      });
      document.querySelector("#tickets-next")?.addEventListener("click", () => {
        page++;
        update();
      });
    };
    form.oninput = () => {
      page = 1;
      update();
    };
    form.onchange = () => {
      page = 1;
      update();
    };
    form.onreset = () =>
      setTimeout(() => {
        page = 1;
        update();
      });
    form.onsubmit = (e) => e.preventDefault();
    update();
  } catch (e) {
    if (token === store.request) fail(app, e, render);
  }
}

export function renderHelp(app, render) {
  app.innerHTML = shell(
    `<section class="page-section page-top help-page"><h1>Hướng dẫn sử dụng</h1><details open><summary>Đặt vé như thế nào?</summary><p>Chọn hồ sơ khách hàng, mở Phim hoặc Lịch chiếu, chọn suất còn mở bán, chọn ghế trống và tiếp tục đến bước kiểm tra đơn. Xác nhận thanh toán mô phỏng để hoàn tất.</p></details><details><summary>Tôi tìm vé đã đặt ở đâu?</summary><p>Mở Vé của tôi với đúng hồ sơ đã sử dụng. Chọn vé sắp chiếu, lịch sử hoặc vé đã hủy. Nhấn vào đơn để xem chi tiết và in vé.</p></details><details><summary>Khi nào có thể hủy vé?</summary><p>Vé đã xác nhận có thể hủy trước giờ chiếu bằng đúng hồ sơ đã đặt. Mở chi tiết vé và chọn Hủy vé. Sau khi máy chủ xác nhận, ghế được trả lại và ghi nhận hoàn tiền mô phỏng.</p></details><details><summary>Ghế đang chọn có được giữ không?</summary><p>Ghế đang chọn chỉ là lựa chọn tạm trên trình duyệt. Nếu người khác đặt trước, hệ thống sẽ yêu cầu bạn chọn lại ghế khi xác nhận.</p></details><details><summary>Thanh toán có trừ tiền thật không?</summary><p>Thanh toán trong ứng dụng là mô phỏng. Không nhập thông tin thẻ hoặc tài khoản ngân hàng.</p></details><a class="primary-button" href="#/schedule">Xem lịch chiếu</a></section>`,
    { active: "help" },
  );
  bindShell(render);
}
