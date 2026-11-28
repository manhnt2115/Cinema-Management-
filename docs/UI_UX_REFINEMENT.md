# Bàn giao nâng cấp giao diện CINEVUE — 28/11/2026

## 1. Phạm vi và hiện trạng ban đầu

Nhánh triển khai: `feature/cinevue-ui-ux-refinement`, tách từ nhánh làm việc hiện có. Không commit, push, merge hoặc tạo Pull Request trong nhiệm vụ này.

Giữ thương hiệu CINEVUE, logo chữ C, màu chủ đạo, poster, bố cục khách hàng/quản trị, cấu trúc đặt vé và sáu collection hiện tại. Không thay framework, tạo đăng nhập hoặc thay mô hình dữ liệu.

Các vấn đề đã xác định bằng source và trình duyệt:

- Dropdown toàn bộ khách hàng nằm ngay trên header; quản trị xuất hiện trong điều hướng mua vé.
- Thiếu trang lịch chiếu độc lập và hướng dẫn sử dụng.
- Router khai báo chi tiết vé nhưng chưa xử lý màn hình tương ứng.
- Vé chưa được tìm kiếm, phân nhóm theo thời gian, phân trang hoặc in.
- Hủy vé còn dùng `alert` khi có lỗi.
- Công cụ khám phá NoSQL/JSON/pipeline xuất hiện trong giao diện quản trị.
- Danh sách phim, suất, khách hàng kéo dài; phân trang đơn chỉ tải trang đầu và thiếu thao tác chuyển trang.
- Form tạo/sửa bị đóng hoặc mất nội dung khi nhận lỗi; feedback chưa thống nhất.
- Xếp hạng phim theo số vé từng lấy thứ tự API sắp theo giá trị; nhãn chưa phân biệt đơn/vé và thanh toán mô phỏng.
- Thiếu guard cho một số request bất đồng bộ khi đổi route/hồ sơ.

Ảnh đối chiếu phiên bản trước: `../MinhChung/UIUX/before-{home,movies,dashboard,showtimes}.png`. Sau khi thư mục minh chứng ngoài repository bị thay đổi trong phiên làm việc, các ảnh đối chiếu đã được tái chụp từ source nền nguyên vẹn tại commit `c5b7fb9` bằng worktree tạm và API chỉ đọc cùng dữ liệu chính.

## 2. Màn hình khách hàng và chức năng đã triển khai

- Header có Trang chủ, Phim, Lịch chiếu, Vé của tôi, Hướng dẫn; trạng thái trang hiện tại và menu mobile.
- Liên kết quản trị đặt ở footer. Hồ sơ có nút tên khách hàng, modal tìm theo tên/mã, trạng thái đang chọn, danh sách cuộn. Chú thích trung thực nằm trong modal; không có mật khẩu/đăng ký giả.
- Trang chủ giữ poster/banner và thẻ phim; giảm chiều cao banner, thêm lối tắt lịch chiếu.
- Phim có tìm tên, lọc thể loại/trạng thái, sắp tên hai chiều, số kết quả, xóa bộ lọc và empty state. Toàn thẻ phim có thể mở chi tiết bằng chuột hoặc bàn phím.
- Chi tiết phim hiển thị nội dung thực, bộ chọn ngày, phòng, giá và các suất thực; suất không mở bán không thể chọn.
- Lịch chiếu độc lập có ngày, bộ lọc phim, nhóm theo phim, giờ Việt Nam, phòng, giá, khả năng mở bước chọn ghế. Ngày trống có thông báo rõ.
- Chọn ghế giữ sơ đồ 8 cột của phòng hiện tại. Phân biệt trống/đang chọn/đã đặt/đang giữ bằng màu, mã ghế, ký hiệu và nhãn truy cập. Tóm tắt thêm số vé, cập nhật tổng tiền và trạng thái nút tiếp tục.
- Checkout vẫn gửi customerId/showtimeId/seatCodes; tiền do server tính. Nút thanh toán vô hiệu hóa khi gửi; lỗi ghế không khả dụng yêu cầu chọn lại; lỗi mạng được diễn đạt bằng tiếng Việt. Hồ sơ bị khóa trong khi gửi thanh toán.
- Thành công có mã đơn, phim, thời gian, phòng, ghế, số vé, tiền, trạng thái thanh toán và liên kết chi tiết.
- Vé của tôi có nhóm sắp chiếu/lịch sử/đã hủy/tất cả, tìm mã đơn hoặc tên phim, lọc trạng thái, sắp thời gian, phân trang 8 đơn và route chi tiết.
- Chi tiết vé hiển thị giá lịch sử từng ghế, phòng, ngày đặt, thanh toán, thông tin hủy/hoàn tiền nếu có; in bằng trình duyệt, không tạo QR giả.
- Hủy vé có xác nhận nêu mã đơn/phim/thời gian/ghế, nút giữ vé và hủy, toast và tải lại chi tiết sau khi backend thành công.
- Hướng dẫn giải thích đặt vé, xem vé, điều kiện hủy, ghế chọn tạm và thanh toán mô phỏng. Footer chỉ dẫn tới route đã triển khai.

## 3. Quản trị

Khu quản trị nghiệp vụ sử dụng module `admin-business.js`. Module kỹ thuật trước đây `admin.js` vẫn giữ trong source để bảo toàn mã tham khảo, nhưng không được main import và không xuất hiện trong giao diện nghiệp vụ.

- Bảy route rõ ràng: tổng quan, báo cáo, phim, phòng, suất, khách hàng, đơn đặt vé.
- Sidebar giữ màu/phong cách ban đầu; chuyển thành menu đóng/mở trên màn hình nhỏ.
- Phim có poster thu nhỏ đúng phim, thể loại, thời lượng, trạng thái, tìm kiếm, lọc, sắp xếp và phân trang 10 dòng.
- Thêm/sửa phim trong modal, có upload/preview JPEG/PNG/WebP, thu nhỏ và kiểm tra giới hạn hiện hữu trước khi gửi. Lỗi giữ lại nội dung form.
- Suất có tìm phim, phòng, ngày, trạng thái, sắp thời gian, phân trang, xem sơ đồ ghế. Modal tính giờ kết thúc từ thời lượng phim; backend tiếp tục kiểm tra lịch chồng và các tham chiếu.
- Modal đang gửi không đóng bằng nút Hủy, nút đóng hoặc Escape; không mở nhiều modal nội dung đồng thời.
- Phòng là thẻ mở modal lớn, có sơ đồ và lịch sử dụng thực. Không bổ sung tạo/xóa phòng hoặc sửa sơ đồ.
- Khách hàng có tên, mã, email, ngày tạo, số đơn; tìm kiếm, sắp xếp và phân trang. Chi tiết mở lịch sử và từng đơn liên quan.
- Đơn tải dữ liệu ngay, lọc theo đầy đủ mã/khách/phim/suất/trạng thái/khoảng ngày đặt, sắp xếp mới/cũ, phân trang bằng API. Chi tiết là giao diện nghiệp vụ, có in.
- Không thêm quyền hủy cho quản trị hoặc sửa trực tiếp trạng thái ghế/đơn.
- Xóa phim/suất vẫn có xác nhận và thông báo lý do backend từ chối.

## 4. Tổng quan, biểu đồ và dữ liệu

- Sáu KPI tách riêng: đơn, vé xác nhận, giá trị xác nhận, khách hàng, suất, tỷ lệ ghế.
- Xếp hạng phim được sắp thực sự theo số vé, không dùng nhầm thứ tự giá trị.
- Biểu đồ cột ngang cho phim và khung giờ, donut cho trạng thái đơn, đường cho thanh toán theo ngày, thanh tiến độ cho tỷ lệ ghế.
- Biểu đồ SVG/CSS dùng dữ liệu API, có tên, đơn vị, tooltip/nội dung thay thế, chú thích và trạng thái trống.
- Báo cáo chia bốn nhóm: Phim, Thanh toán, Suất chiếu, Đặt vé & khách hàng. Dữ liệu suất phân trang; tổng quan không chứa toàn bộ bảng dài.
- Toàn bộ số liệu lấy trực tiếp MongoDB. Không hard-code KPI, không tạo tỷ lệ tăng trưởng hoặc dữ liệu biểu đồ giả.
- Sáu nhóm thống kê được kiểm chứng độc lập bằng JS từ document QA (không chỉ so sánh pipeline với chính nó).

## 5. API

| API | Thay đổi |
|---|---|
| `GET /api/schedule` | Thêm API chỉ đọc toàn bộ suất, nối tên phim/phòng và tính `bookable` từ trạng thái, thời gian thật |
| `GET /api/admin/customers` | Bổ sung email hiện có trong projection; không thay document |
| `GET /api/admin/bookings` | Thêm `sort=asc/desc`, giữ mặc định mới nhất và cấu trúc phân trang hiện tại |
| API đặt/hủy vé | Chỉ chuẩn hóa một số câu lỗi tiếng Việt; giữ nguyên điều kiện cập nhật, bù ghế và quy tắc nghiệp vụ |

Các API/tài liệu kỹ thuật hiện có vẫn được giữ. Cơ chế giới hạn quản trị local tiếp tục được bảo toàn và không được gọi là xác thực tài khoản.

## 6. Kiểm thử

| Hạng mục | Kết quả |
|---|---|
| Build Vite | Thành công |
| API tích hợp trên QA | 35/35: đặt một/nhiều ghế, tiền, cạnh tranh, bù ghế, hủy đúng/sai/đồng thời, CRUD, lịch chồng, validator/index |
| Playwright + Microsoft Edge | 108/108; không pageerror hoặc alert/confirm/prompt mặc định |
| Responsive | 16 route × 5 kích thước = 80 lượt, không cuộn ngang toàn trang |
| Kích thước | 1920×1080, 1440×900, 1366×768, 768×1024, 390×844 |
| Modal/menu mobile | Có kiểm tra mở menu, kích thước modal, Escape và chi tiết phòng/khách/đơn |
| Thống kê chỉ đọc | Đối chiếu đủ sáu nhóm, KPI, lịch chiếu và sắp xếp; số phép kiểm tra ghế phụ thuộc số suất QA |
| Nhất quán QA sau kiểm thử | Không lỗi tham chiếu, tổng tiền, ghế, chồng lịch hoặc schema |

Kết quả/ảnh/PDF nằm ngoài Git tại `../MinhChung/UIUX/`:

- `browser-results.json`: 108 kiểm tra trình duyệt, `errors: []`.
- `read-model-results.json`: đối chiếu dữ liệu thống kê.
- `after-booking-selected.png`, `after-checkout.png`, `after-ticket-detail.png`, `after-cancel-dialog.png`.
- `after-dashboard-{1920,1440,1366,768,390}.png` và `after-movies-{1920,1440,1366,768,390}.png`.
- `ticket-print.pdf` là bản in từ trình duyệt, không thay đổi đơn.
- Ảnh responsive và giao dịch có thể hiển thị số liệu QA khác database chính; đây là chủ đích để bảo toàn dữ liệu báo cáo.

## 7. Đối chiếu database chính

Database thực tế của API chính: `cinema_management`. URI cấu hình vẫn là MongoDB local. Mọi thao tác ghi trong kiểm thử dùng riêng `cinema_management_test_uiux_20261128`.

| Collection | Trước | Sau |
|---|---:|---:|
| customers | 50 | 50 |
| movies | 12 | 12 |
| rooms | 3 | 3 |
| showtimes | 45 | 45 |
| showtime_seats | 1800 | 1800 |
| bookings | 201 | 201 |

Fingerprint SHA-256 trước và sau:

`33f567c5b2268e2bc68e371f5b0d7792a1456cecf42041882b30ce8b6e4ced24`

`database-before-summary.json` ghi lại count và fingerprint ban đầu đã được xác nhận trong kết quả công cụ trước triển khai; file snapshot đầy đủ ban đầu không còn trong thư mục minh chứng sau thay đổi ngoài repository. `database-after.json` lưu count, hash nội dung BSON dưới Extended JSON xác định, validator/options và danh sách index hiện tại. Fingerprint đầy đủ vẫn trùng giá trị ban đầu đã ghi nhận. Không thay đổi document, mã, enum, BSON, quan hệ, collection, validator hoặc index trên database chính. `db:check` chính trước/sau đều `ok: true`. Không seed lại hoặc bổ sung lịch chính.

## 8. Các file thay đổi

- `backend/src/server.js`, `backend/src/admin.js`: API đọc và ngôn ngữ lỗi.
- `frontend/src/main.js`, `frontend/src/app/router.js`: điều phối route và guard request.
- `frontend/src/components/customer-shell.js`: header, footer, mobile menu, chọn hồ sơ.
- `frontend/src/pages/customer.js`: kế thừa home/chi tiết/chọn ghế/checkout/thành công.
- `frontend/src/pages/customer-extras.js`: phim, lịch, danh sách/chi tiết vé, hướng dẫn.
- `frontend/src/admin-business.js`: giao diện quản trị nghiệp vụ.
- `frontend/src/api/client.js`: gọi API và lỗi mạng dễ hiểu; không retry POST.
- `frontend/src/ui.js`: modal, toast, xác nhận và khóa modal khi gửi.
- `frontend/src/styles/refinement.css`: responsive, bảng, modal, ghế và CSS in.
- `database/scripts/fingerprint.js`, `database/tests/read-models.js`, `database/tests/integration.js`, `frontend/tests/ui-smoke.cjs`: kiểm chứng dữ liệu và trình duyệt. Kiểm thử tích hợp có guard kiểm tra tên database từ API trước khi ghi; kiểm thử UI chặn request nếu web trỏ nhầm API.
- `package.json`, `package-lock.json`: Playwright dev dependency và lệnh kiểm thử.
- `README.md`, tài liệu này: route, chức năng, hướng dẫn kiểm thử và bàn giao.

## 9. Giới hạn và phần không bổ sung

- Không bổ sung đăng nhập/đăng ký, phân quyền giả, QR xác thực, voucher, đồ ăn, điểm hay dữ liệu không được mô hình hỗ trợ.
- Không tạo/sửa/xóa phòng, không sửa trạng thái ghế trực tiếp, không cấp quyền hủy mới cho quản trị.
- Phòng và khách hàng có chức năng tra cứu/chi tiết theo nghiệp vụ hiện hữu, không được quảng bá là CRUD đầy đủ.
- Báo cáo hiện dùng toàn bộ dữ liệu có trong API; chưa thêm bộ lọc thời gian thống kê hoặc xuất CSV. Bộ lọc ngày đặt đơn và ngày chiếu hoạt động riêng theo nghĩa dữ liệu.
- Thanh toán/hoàn tiền vẫn mô phỏng. MongoDB standalone và thao tác bù chưa đảm bảo phục hồi nếu tiến trình chết giữa nhiều lần ghi; không gọi đó là transaction.
- Không kiểm thử lỗi mất điện hoặc tải quy mô lớn. Các kiểm tra layout tự động không chứng minh mọi chuỗi dữ liệu tương lai đều không chồng lấn; đã quan sát ảnh thực ở các kích thước quy định.
- Chưa restore archive hoặc thực nghiệm Mingo/Studio 3T bổ sung trong nhiệm vụ UI này.

## 10. Khởi chạy và Git

`npm ci`, dùng `.env` hiện tại với `MONGODB_DB_NAME=cinema_management`, chạy `npm run dev:api` và `npm run dev:web` ở hai terminal. Mở `http://localhost:5173`; API `http://localhost:3000/api/health` phải trả đúng tên database. Không chạy seed khi dữ liệu đã tồn tại. Hướng dẫn QA và tái lập kiểm thử nằm trong README.

Nhánh chính không bị sửa. Mã nguồn trên nhánh riêng đang ở trạng thái chưa commit, chưa push theo yêu cầu nhiệm vụ. `.env`, backup và ảnh minh chứng không được đưa vào Git.
