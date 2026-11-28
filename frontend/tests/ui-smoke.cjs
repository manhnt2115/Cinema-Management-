const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(process.env.UI_EVIDENCE_DIR || "../MinhChung/UIUX");
fs.mkdirSync(root, { recursive: true });
let browser;
const suffix = Date.now();
const results = [];
const base = process.env.TEST_WEB_BASE_URL || "http://127.0.0.1:5174/";
const api = process.env.TEST_API_BASE_URL || "http://127.0.0.1:3002";
const record = (name, value = true) => {
  assert(value, name);
  results.push({ name, ok: true });
  console.log("PASS", name);
};
(async () => {
  const health = await fetch(api + "/api/health").then((r) => r.json());
  assert(
    health.database.startsWith("cinema_management_test_"),
    "API phải trỏ vào database kiểm thử.",
  );
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  // Chặn cả request từ web nếu web QA vô tình cấu hình sang API chính.
  await page.route('**/api/**', route => {
    const target = new URL(route.request().url());
    if (!target.pathname.startsWith('/api/')) return route.continue();
    const expected = new URL(api);
    const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
    const hostMatches = target.hostname === expected.hostname || (loopback.has(target.hostname) && loopback.has(expected.hostname));
    if (target.port !== expected.port || !hostMatches) {
      errors.push('Web không trỏ đúng API QA. Request đã bị chặn.');
      return route.abort();
    }
    return route.continue();
  });
  page.on("pageerror", (e) => {
    console.log("PAGEERROR", e.message);
    errors.push(e.message);
  });
  page.on("dialog", async (d) => {
    errors.push("Native dialog: " + d.type());
    await d.dismiss();
  });
  page.on("response", (r) => {
    if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  const open = async (route) => {
    await page.goto(base + route);
    await page.waitForTimeout(700);
    await page.locator("h1").first().waitFor();
  };
  await open("#/");
  await page.screenshot({ path: path.join(root, "after-home.png") });
  await open("#/movies");
  await page.locator("[name=q]").fill("không có phim này");
  await page.waitForTimeout(100);
  record(
    "Tìm phim không có kết quả",
    await page
      .locator("#movie-results")
      .innerText()
      .then((x) => x.includes("Không tìm thấy")),
  );
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await page.waitForTimeout(100);
  record(
    "Xóa bộ lọc phim",
    (await page.locator(".catalog-card").count()) >= 12,
  );
  await page.locator("[name=status]").selectOption("COMING_SOON");
  record(
    "Lọc trạng thái phim",
    (await page.locator(".catalog-card").count()) === 3,
  );
  await page.locator(".profile-button").click();
  await page.locator("#profile-search").fill("46");
  await page.locator("[data-profile=CUS046]").click();
  record(
    "Chọn hồ sơ có tìm kiếm",
    await page
      .locator(".profile-button")
      .innerText()
      .then((x) => x.includes("46")),
  );
  await open("#/schedule");
  await page.locator("#schedule-filters [name=day]").fill("2000-01-01");
  await page.locator("#schedule-filters [name=day]").dispatchEvent("change");
  record(
    "Lịch chiếu không có dữ liệu",
    await page
      .locator("#schedule-results")
      .innerText()
      .then((x) => x.includes("Chưa có suất")),
  );
  const shows = await fetch(api + "/api/schedule").then((r) => r.json());
  const testStart = new Date(
    Math.max(Date.UTC(2099, 0, 1), ...shows.map((s) => Date.parse(s.endAt))) +
      86400000,
  )
    .toISOString()
    .slice(0, 16);
  const show = shows.find((x) => x.bookable && x.roomId === "ROOM001");
  assert(show);
  await open("#/booking/" + encodeURIComponent(show._id));
  const seats = page.locator("[data-seat]:not(:disabled)");
  const codes = [];
  for (let i = 0; i < 2; i++) {
    const s = seats.nth(i);
    codes.push(await s.getAttribute("data-seat"));
    await s.click();
  }
  record(
    "Chọn ghế và số lượng",
    (await page.locator("#chosen-count").innerText()) === "2 vé",
  );
  const expected = new Intl.NumberFormat("vi-VN").format(show.basePriceVnd * 2);
  record(
    "Tính tổng tiền theo suất",
    await page
      .locator("#order-total")
      .innerText()
      .then((x) => x.includes(expected)),
  );
  await page.screenshot({
    path: path.join(root, "after-booking-selected.png"),
  });
  await page.locator("#continue-booking").click();
  await page.locator("#pay-button").waitFor();
  await page.screenshot({ path: path.join(root, "after-checkout.png") });
  await page.locator("#pay-button").dblclick();
  await page.waitForURL("**/#/booking-success");
  await page.getByRole("link", { name: "Chi tiết vé", exact: true }).click();
  await page.locator("#cancel-ticket").waitFor();
  record(
    "Đặt vé, hoàn tất và mở chi tiết",
    await page
      .locator(".ticket-details")
      .innerText()
      .then((x) => codes.every((c) => x.includes(c))),
  );
  await page.screenshot({ path: path.join(root, "after-ticket-detail.png") });
  const id = decodeURIComponent(page.url().split("/").at(-1));
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: path.join(root, "ticket-print.pdf"), format: "A4" });
  await page.emulateMedia({ media: "screen" });
  await page.locator("#cancel-ticket").click();
  await page.locator(".app-dialog").waitFor();
  await page.screenshot({ path: path.join(root, "after-cancel-dialog.png") });
  await page.locator(".app-dialog [value=confirm]").click();
  await page.waitForTimeout(800);
  record(
    "Hủy vé bằng hộp thoại",
    await page
      .locator(".ticket-details")
      .innerText()
      .then((x) => x.includes("Đã hủy")),
  );
  const saved = await fetch(
    api + "/api/customers/CUS046/bookings/details",
  ).then((r) => r.json());
  record(
    "Đơn hủy lưu đúng dữ liệu",
    saved.find((x) => x._id === id)?.status === "CANCELLED",
  );
  const currentSeats = await fetch(
    api + `/api/showtimes/${show._id}/seats`,
  ).then((r) => r.json());
  record(
    "Ghế được giải phóng sau hủy",
    codes.every(
      (code) =>
        currentSeats.find((s) => s.seatCode === code)?.status === "AVAILABLE",
    ),
  );
  await open("#/admin/movies");
  await page.locator("#new-movie").click();
  const form = page.locator("#movie-form");
  await form.locator("[name=title]").fill("Phim kiểm thử giao diện " + suffix);
  await form.locator("[name=genres]").fill("Gia đình");
  await form.locator("[name=durationMinutes]").fill("100");
  await form
    .locator("[name=synopsis]")
    .fill("Nội dung dùng riêng trên database kiểm thử.");
  await form
    .locator("[name=poster]")
    .setInputFiles(path.join(root, "after-home.png"));
  await form.getByRole("button", { name: "Lưu phim" }).click();
  await page.waitForTimeout(800);
  const allMovies = await fetch(api + "/api/admin/movies").then((r) =>
    r.json(),
  );
  const created = allMovies.find(
    (x) => x.title === "Phim kiểm thử giao diện " + suffix,
  );
  record(
    "Thêm phim kèm ảnh",
    !!created?.posterImage?.startsWith("data:image/jpeg"),
  );
  await page
    .locator("#admin-filters [name=q]")
    .fill("Phim kiểm thử giao diện " + suffix);
  await page.waitForTimeout(500);
  await page.locator(`[data-edit-movie="${created._id}"]`).click();
  await page
    .locator("#movie-form [name=title]")
    .fill("Phim giao diện đã sửa " + suffix);
  await page.locator("#movie-form [type=submit]").click();
  await page.waitForTimeout(800);
  record(
    "Sửa phim giữ ảnh",
    await fetch(api + `/api/movies/${created._id}`)
      .then((r) => r.json())
      .then(
        (x) => x.title === "Phim giao diện đã sửa " + suffix && !!x.posterImage,
      ),
  );
  await open("#/admin/showtimes");
  await page.locator("#new-show").click();
  let f = page.locator(".business-form");
  await f.locator("[name=movieId]").selectOption(created._id);
  await f.locator("[name=startAt]").fill(testStart);
  await f.locator("[name=startAt]").dispatchEvent("change");
  await f.locator("[name=basePriceVnd]").fill("95000");
  await f.locator("[type=submit]").click();
  await page.waitForTimeout(800);
  let allShows = await fetch(api + "/api/admin/showtimes").then((r) =>
    r.json(),
  );
  const createdShow = allShows.find((x) => x.movieId === created._id);
  record(
    "Tạo suất tự tính giờ kết thúc",
    !!createdShow &&
      new Date(createdShow.endAt) - new Date(createdShow.startAt) === 6000000,
  );
  await page.locator("#new-show").click();
  f = page.locator(".business-form");
  await f.locator("[name=movieId]").selectOption(created._id);
  await f.locator("[name=startAt]").fill(testStart);
  await f.locator("[name=startAt]").dispatchEvent("change");
  await f.locator("[name=basePriceVnd]").fill("95000");
  await f.locator("[type=submit]").click();
  await page.waitForTimeout(500);
  record(
    "Lịch chồng báo lỗi và giữ nội dung form",
    (await f
      .locator(".inline-error")
      .innerText()
      .then((x) => x.includes("giao thời gian"))) &&
      (await f.locator("[name=basePriceVnd]").inputValue()) === "95000",
  );
  await page.locator(".modal-heading button").click();
  await open("#/admin/customers");
  await page.locator("[data-customer]").first().click();
  record(
    "Chi tiết khách và lịch sử",
    await page
      .locator(".content-dialog")
      .innerText()
      .then((x) => x.includes("đơn đặt vé")),
  );
  await page.keyboard.press("Escape");
  await open("#/admin/rooms");
  await page.locator("[data-room]").first().click();
  await page.locator(".content-dialog .inspect-seat").first().waitFor();
  record(
    "Phòng có sơ đồ và lịch sử dụng",
    (await page.locator(".content-dialog .inspect-seat").count()) === 32,
  );
  await page.keyboard.press("Escape");
  await open("#/admin/bookings");
  const before = await page.locator(".data-table tbody").innerText();
  await page.locator('[data-page="2"]').click();
  await page.waitForTimeout(300);
  record(
    "Phân trang đơn đặt vé",
    (await page.locator(".data-table tbody").innerText()) !== before,
  );
  await page.locator("[data-booking]").first().click();
  record(
    "Chi tiết đơn quản trị",
    await page
      .locator(".content-dialog")
      .innerText()
      .then((x) => x.includes("Thanh toán mô phỏng")),
  );
  await page.keyboard.press("Escape");
  for (const tab of ["movies", "payments", "showtimes", "customers"]) {
    await open("#/admin/reports");
    await page.locator(`[data-tab=${tab}]`).click();
    record(
      "Báo cáo " + tab,
      !!(await page.locator(".report-content").innerText()),
    );
  }
  const defaultTicket = id;
  await page.evaluate(
    ({ show, codes }) =>
      sessionStorage.setItem(
        "cinevue.checkout",
        JSON.stringify({
          customerId: "CUS046",
          showtimeId: show._id,
          seatCodes: codes,
          show,
        }),
      ),
    { show, codes },
  );
  const routes = [
    "#/",
    "#/movies",
    "#/movies/MV002",
    "#/schedule",
    `#/booking/${show._id}`,
    "#/checkout",
    "#/my-tickets",
    `#/my-tickets/${defaultTicket}`,
    "#/help",
    "#/admin/dashboard",
    "#/admin/movies",
    "#/admin/showtimes",
    "#/admin/customers",
    "#/admin/bookings",
    "#/admin/rooms",
    "#/admin/reports",
  ];
  // Tất cả kiểm thử, bao gồm responsive, đều dùng API QA.
  for (const [w, h] of [
    [1920, 1080],
    [1440, 900],
    [1366, 768],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    for (const route of routes) {
      await page.goto(base + route);
      await page.waitForTimeout(200);
      await page.locator("h1").first().waitFor();
      if (route === '#/checkout') await page.locator('#pay-button').waitFor();
      if (route === `#/my-tickets/${defaultTicket}`) await page.locator('.ticket-details').waitFor();
      const size = await page.evaluate(() => ({
        w: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      record(`Responsive ${w} ${route}`, size.scroll <= size.w + 1);
    }
    await page.goto(base + "#/admin/dashboard");
    await page.waitForTimeout(350);
    await page.screenshot({
      path: path.join(root, `after-dashboard-${w}.png`),
    });
    await page.goto(base + "#/movies");
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(root, `after-movies-${w}.png`) });
  }
  await page.locator('.mobile-menu').click();
  record('Menu khách hàng mobile', await page.locator('.site-header').getAttribute('class').then(x=>x.includes('nav-open')));
  await page.locator('.profile-button').click();
  const bounds=await page.locator('.content-dialog').boundingBox();
  record('Modal hồ sơ nằm trong màn hình mobile',bounds.width<=390 && bounds.height<=844);
  await page.keyboard.press('Escape');
  await page.locator('.content-dialog').waitFor({state:'detached'});
  record('Escape đóng modal an toàn',await page.locator('.content-dialog').count()===0);
  await open('#/admin/dashboard');await page.locator('.admin-menu').click();
  record('Menu quản trị mobile',await page.locator('.business-admin').getAttribute('class').then(x=>x.includes('menu-open')));
  console.log("BROWSER_ERRORS", errors);
  fs.writeFileSync(
    path.join(root, "browser-results.json"),
    JSON.stringify({ passed: results.length, errors, results }, null, 2),
  );
  record("Không lỗi JavaScript hoặc native dialog", errors.length === 0);
  await browser.close();
  fs.writeFileSync(
    path.join(root, "browser-results.json"),
    JSON.stringify({ passed: results.length, errors, results }, null, 2),
  );
})().catch(async (error) => {
  await browser?.close();
  fs.writeFileSync(path.join(root, "browser-failure.txt"), error.stack);
  console.error(error);
  process.exit(1);
});
