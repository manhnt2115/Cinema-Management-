import "./styles/product.css";
import { route, go } from "./app/router.js";
import {
  ensureBase,
  renderHome,
  renderMovie,
  renderBooking,
  renderCheckout,
  renderSuccess,
} from "./pages/customer.js";
import {
  renderMovies,
  renderSchedule,
  renderTickets,
  renderTicket,
  renderHelp,
} from "./pages/customer-extras.js";
import { store } from "./app/store.js";
import { escapeHtml } from "./ui.js";
import "./styles/refinement.css";
import {
  renderAdmin,
  openAdmin,
  bindAdminEvents,
  syncAdminRoute,
} from "./admin-business.js";

const app = document.querySelector("#app");
let adminReady = false;

function stateView(message, kind = "loading-panel") {
  app.innerHTML = `<main class="page-section"><div class="${kind}">${message}</div></main>`;
}

async function render() {
  const token = ++store.request;
  const current = route();
  if (current.name === "admin") {
    store.catalog = [];
    syncAdminRoute();
    app.innerHTML = renderAdmin();
    bindAdminEvents(render, () => go("#/"));
    if (!adminReady) {
      adminReady = true;
      await openAdmin(render);
    }
    return;
  }
  adminReady = false;
  try {
    stateView("Đang chuẩn bị CineVue…");
    await ensureBase();
    if (token !== store.request) return;
    if (current.name === "home") return await renderHome(app, render);
    if (current.name === "movies") return await renderMovies(app, render);
    if (current.name === "movie")
      return await renderMovie(app, current.params.id, render);
    if (current.name === "booking")
      return await renderBooking(app, current.params.id, render);
    if (current.name === "checkout") return await renderCheckout(app, render);
    if (current.name === "booking-success")
      return await renderSuccess(app, render);
    if (current.name === "tickets") return await renderTickets(app, render);
    if (current.name === "ticket")
      return await renderTicket(app, current.params.id, render);
    if (current.name === "schedule") return await renderSchedule(app, render);
    if (current.name === "help") return await renderHelp(app, render);
    stateView(
      '<h1>Không tìm thấy trang</h1><button class="primary-button" id="back-home">Về trang chủ</button>',
      "error-panel",
    );
    document.querySelector("#back-home").onclick = () => go("#/");
  } catch (error) {
    if (token !== store.request) return;
    stateView(
      `<h2>Không thể tải ứng dụng</h2><p>${escapeHtml(error.message)}</p><button class="primary-button" id="retry-app">Thử lại</button>`,
      "error-panel",
    );
    document.querySelector("#retry-app").onclick = () => render();
  }
}

window.addEventListener("hashchange", render);
if (!location.hash) history.replaceState(null, "", "#/");
render();
