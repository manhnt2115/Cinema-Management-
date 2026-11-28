import { go } from "../app/router.js";
import { store } from "../app/store.js";
import { escapeHtml as safe, modal } from "../ui.js";

export function shell(content, { active = "" } = {}) {
  if (!active && (location.hash === "#/" || !location.hash)) active = "home";
  const customer = store.customers.find(
    (item) => item._id === store.customerId,
  );
  const links = [
    ["home", "#/", "Trang chủ"],
    ["movies", "#/movies", "Phim"],
    ["schedule", "#/schedule", "Lịch chiếu"],
    ["tickets", "#/my-tickets", "Vé của tôi"],
    ["help", "#/help", "Hướng dẫn"],
  ];
  return `<header class="site-header"><a class="site-brand" href="#/"><span>C</span><strong>CINEVUE<small>RẠP PHIM TRỰC TUYẾN</small></strong></a><button class="outline-button mobile-menu" aria-label="Mở điều hướng" aria-expanded="false">☰</button><nav aria-label="Điều hướng chính">${links.map(([id, href, label]) => `<a href="${href}" ${active === id ? 'aria-current="page"' : ""}>${label}</a>`).join("")}</nav><button class="profile-button outline-button" title="Đổi hồ sơ khách hàng"><span aria-hidden="true">◉</span><span>${safe(customer?.fullName || "Chọn hồ sơ")}</span></button></header><main class="site-main">${content}</main><footer class="site-footer"><strong>CINEVUE</strong><a href="#/help">Hướng dẫn đặt và hủy vé</a><a href="#/schedule">Lịch chiếu</a><a href="#/admin/dashboard">Khu quản trị nội bộ</a></footer>`;
}

export function bindShell(render) {
  document
    .querySelectorAll("[data-go]")
    .forEach((item) => (item.onclick = () => go(item.dataset.go)));
  document.querySelector(".mobile-menu")?.addEventListener("click", (event) => {
    const open = document
      .querySelector(".site-header")
      .classList.toggle("nav-open");
    event.currentTarget.setAttribute("aria-expanded", String(open));
  });
  document.querySelector(".profile-button")?.addEventListener("click", () => {
    const dialog = modal(
      "Chọn hồ sơ khách hàng",
      `<p>Chọn hồ sơ để đặt và xem vé trong môi trường minh họa. Đây không phải đăng nhập tài khoản.</p><label class="field-label">Tìm hồ sơ<input type="search" id="profile-search" placeholder="Nhập họ tên hoặc mã khách hàng"></label><div class="profile-list"></div>`,
    );
    const update = () => {
      const query = dialog
        .querySelector("input")
        .value.trim()
        .toLocaleLowerCase("vi");
      const items = store.customers.filter((c) =>
        `${c.fullName} ${c._id}`.toLocaleLowerCase("vi").includes(query),
      );
      dialog.querySelector(".profile-list").innerHTML = items.length
        ? items
            .map(
              (c) =>
                `<button class="profile-option ${c._id === store.customerId ? "selected" : ""}" data-profile="${safe(c._id)}"><strong>${safe(c.fullName)}</strong><small>${c._id === store.customerId ? "Đang sử dụng" : "Chọn hồ sơ"}</small></button>`,
            )
            .join("")
        : "<p>Không tìm thấy hồ sơ phù hợp.</p>";
      dialog.querySelectorAll("[data-profile]").forEach(
        (button) =>
          (button.onclick = () => {
            store.customerId = button.dataset.profile;
            store.request++;
            dialog.close();
            render();
          }),
      );
    };
    dialog.querySelector("input").oninput = update;
    update();
    dialog.querySelector("input").focus();
  });
}
