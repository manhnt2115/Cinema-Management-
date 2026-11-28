# Cinema Booking – Đồ án NoSQL

Ứng dụng minh họa đặt vé phim dùng MongoDB. Backend Node.js/Express chọn database bằng `MONGODB_DB_NAME` (mặc định `cinema_management`); Mingo/Compass dùng để duyệt và kiểm chứng document thật. Môi trường thực nghiệm ngày 27/11/2026 dùng MongoDB 8.3.8 standalone nên luồng nhiều document không dùng transaction.

## Yêu cầu môi trường

- Windows PowerShell.
- Node.js 22.x và npm 10.x. Phiên bản đã nghiệm thu: Node.js 22.22.3, npm 10.9.8.
- MongoDB Server 8.x chạy tại `mongodb://127.0.0.1:27017`. Phiên bản đã nghiệm thu: 8.3.8 standalone.
- MongoDB Database Tools nếu muốn backup/restore một file native bằng `mongodump` và `mongorestore`.
- Mingo hoặc Studio 3T là tùy chọn, chỉ dùng để duyệt và kiểm chứng dữ liệu.

Kiểm tra môi trường trên Windows:

```powershell
node --version
npm --version
Get-Service MongoDB
Get-NetTCPConnection -LocalPort 27017 -State Listen
```

Nếu dịch vụ MongoDB đã cài nhưng chưa chạy, mở PowerShell với quyền phù hợp và dùng `Start-Service MongoDB`.

## Cài đặt từ source code

Mở PowerShell tại thư mục repository rồi chạy:

```powershell
npm ci
Copy-Item .env.example .env # chỉ khi .env chưa tồn tại
```

`.env.example` mặc định cấu hình:

```dotenv
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=cinema_management
PORT=3000
```

Không commit `.env`. Backend luôn đọc database từ `MONGODB_DB_NAME`; tên chính thức của dự án là `cinema_management`. Database kiểm thử tạm thời phải có tiền tố `cinema_management_test_` và phải xóa sau nghiệm thu.

## Chuẩn bị dữ liệu

Chọn **một trong hai** phương án dưới đây. Không chạy seed sau khi đã restore và không restore vào database đã có dữ liệu.

### Phương án A – tạo dữ liệu mới bằng seed

Dùng cho máy mới hoặc khi không có file backup. Database `cinema_management` phải chưa tồn tại hoặc cả sáu collection phải rỗng:

```powershell
$env:MONGODB_DB_NAME = 'cinema_management'
$env:SEED_REFERENCE_AT = '2026-11-27T03:00:00.000Z'
npm run seed:demo
npm run db:check
```

Seed hoàn thiện dùng PRNG seed `20261128`, tạo 50 khách, 12 phim, 3 phòng (32/40/48 ghế), 45 suất, 1.800 document ghế và 200 booking (170 CONFIRMED, 30 CANCELLED). Có 331 ghế BOOKED và 1.469 ghế AVAILABLE. Sáu collection đều có JSON Schema validator `strict/error`. Script từ chối chạy lại trên database không rỗng để tránh ghi đè.

`npm run seed` chỉ là seed nhỏ tương thích phiên bản cũ; không dùng lệnh này để dựng bộ dữ liệu hoàn thiện. Khi cần bổ sung lịch tương lai mà không sửa lịch/booking cũ, dùng `npm run seed:future` sau khi đã xác minh đúng database.

### Phương án B – phục hồi đúng dữ liệu đã chốt từ một file

File chính thức là `CinemaManagement_FullBackup_2026-11-27.archive.gz`. File này không nằm trong Git repository; cần sao chép riêng vào máy. MongoDB Database Tools phải cung cấp lệnh `mongorestore`.

```powershell
$archive = 'D:\DuongDan\CinemaManagement_FullBackup_2026-11-27.archive.gz'
mongorestore --uri='mongodb://127.0.0.1:27017' --archive=$archive --gzip --dryRun
mongorestore --uri='mongodb://127.0.0.1:27017' --archive=$archive --gzip
$env:MONGODB_DB_NAME = 'cinema_management'
npm run db:check
```

`--dryRun` chỉ kiểm tra nội dung archive. Lệnh restore tiếp theo thực sự ghi dữ liệu; chỉ chạy khi `cinema_management` chưa tồn tại. Không thêm `--drop` nếu chưa chủ động xác nhận xóa dữ liệu cũ.

### Tạo backup native một file

```powershell
$backup = 'D:\Backup\CinemaManagement_FullBackup_2026-11-27.archive.gz'
mongodump --uri='mongodb://127.0.0.1:27017' --db='cinema_management' --archive=$backup --gzip
mongorestore --uri='mongodb://127.0.0.1:27017' --archive=$backup --gzip --dryRun
```

Archive native chứa document, metadata collection, validator và index. Script `npm run db:backup` vẫn tạo bản Extended JSON tách theo collection để kiểm tra hoặc lưu trữ bổ sung; nó không thay thế archive native một file.

## Chạy API và frontend

Terminal thứ nhất, tại thư mục repository:

```powershell
npm run dev:api
```

Kiểm tra API và database đang phục vụ:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
```

Kết quả đúng phải có `"ok": true` và `"database": "cinema_management"`.

Terminal thứ hai:

```powershell
npm run dev:web
```

Mở `http://localhost:5173`. Frontend gọi API tại `http://localhost:3000`. Nếu backend dùng địa chỉ khác, sao chép `frontend/.env.example` thành `frontend/.env`, cập nhật `VITE_API_BASE_URL` rồi khởi động lại Vite.

Kịch bản kiểm tra end-to-end: chọn hồ sơ demo, chọn phim và suất tương lai, chọn ghế AVAILABLE, hoàn tất thanh toán mô phỏng, sau đó mở **Vé của tôi** để xác nhận booking xuất hiện. Trong Mingo mở `cinema_management` để đối chiếu `bookings` và `showtime_seats`.

### Lỗi khởi chạy thường gặp

- `ECONNREFUSED 127.0.0.1:27017`: MongoDB Server chưa chạy hoặc URI sai.
- `EADDRINUSE` ở cổng `3000`/`5173`: đã có API/Vite khác đang chạy; dừng đúng tiến trình cũ hoặc đổi cổng và cập nhật `VITE_API_BASE_URL`.
- Không nhận diện `mongodump`/`mongorestore`: kiểm tra bằng `Get-Command mongorestore`; thêm thư mục `MongoDB\Tools\100\bin` vào `PATH` hoặc gọi trực tiếp đường dẫn đầy đủ tới file `.exe`.
- Seed báo database không rỗng: không chạy lại; dùng dữ liệu hiện có, chọn database kiểm thử mới hoặc chủ động backup trước khi xóa.
- Web mở được nhưng không có dữ liệu: kiểm tra `/api/health`, `.env`, `frontend/.env` và khởi động lại cả API lẫn Vite sau khi đổi biến môi trường.

Để QA validator, chọn một tên database mới, rỗng và có tiền tố bắt buộc:

```powershell
$env:MONGODB_DB_NAME = 'cinema_management_test_validators_<hau_to_rieng>'
npm run db:test-validators
```

Không chạy script ghi trực tiếp trên `cinema_management` ngoài quy trình đã xác nhận. Chi tiết mô hình, validator và index nằm tại [`database/DATA_MODEL.md`](database/DATA_MODEL.md).

## API

### Đọc dữ liệu

- `GET /api/health`
- `GET /api/movies` – phim có `status: NOW_SHOWING`
- `GET /api/movies/:id/showtimes` – suất mở bán trong tương lai
- `GET /api/showtimes/:id/seats` – trạng thái ghế theo suất
- `GET /api/customers/:customerId/bookings` – lịch sử, mới nhất trước
- `GET /api/customers/:customerId/bookings/details` – lịch sử kèm `movieTitle` và `startAt`, lấy bằng tra cứu read-only từ `movies`/`showtimes`. Route lịch sử cũ giữ nguyên response.
- `GET /api/customers`, `GET /api/customers/:id` – dữ liệu tối thiểu cho bộ chọn khách demo; đây không phải đăng nhập hoặc xác thực.
- `GET /api/rooms/:id` – chi tiết phòng, sức chứa, sơ đồ ghế và các suất thuộc phòng.

Ví dụ minh họa cấu trúc response từ route lịch sử chi tiết:

```json
{
  "_id": "BK-DEMO-EXAMPLE",
  "movieId": "MV001",
  "movieTitle": "Hành Trình Ánh Sao",
  "showtimeId": "ST001",
  "startAt": "2026-11-22T06:00:00.000Z",
  "seats": [{ "seatCode": "A1", "unitPriceVnd": 90000 }],
  "totalAmountVnd": 90000,
  "status": "CONFIRMED"
}
```

Frontend khách hàng có tìm phim theo tên/thể loại dựa trên dữ liệu API, chọn suất theo ngày (bộ lọc tự vô hiệu hóa khi API chỉ trả một ngày), chọn ghế còn trống, xem tạm tính và lọc lịch sử theo trạng thái. Lịch sử hiển thị suất, ghế, giá tại thời điểm booking và tổng tiền.

### Khu quản trị demo local

Khu quản trị nội bộ mở từ liên kết ở footer hoặc `#/admin/dashboard`, gồm Tổng quan, Báo cáo thống kê, Phim, Phòng chiếu, Suất chiếu, Khách hàng và Đơn đặt vé. Các danh sách có tìm kiếm, bộ lọc, phân trang và chi tiết phù hợp từng nghiệp vụ. Thêm/sửa phim và suất chiếu sử dụng modal; phòng và khách hàng chỉ được tra cứu theo phạm vi backend hiện có. Công cụ truy vấn kỹ thuật đã được gỡ khỏi giao diện; tài liệu và pipeline nghiên cứu vẫn được giữ trong `database/`. API `/api/admin/*` tiếp tục giới hạn kết nối loopback và các Origin frontend local đã cho phép trong backend; đây không phải hệ thống xác thực tài khoản. Không mở API quản trị ra Internet.

- `GET /api/admin/movies`, `GET /api/admin/rooms`, `GET /api/admin/showtimes`
- `GET /api/admin/analytics` – đọc sáu aggregation: vé/giá trị theo phim, thanh toán theo ngày, tỷ lệ ghế, vé theo khung giờ, booking theo trạng thái và top khách hàng; kèm KPI lấy từ backend.
- `POST /api/admin/movies`, `PUT /api/admin/movies/:id`, `DELETE /api/admin/movies/:id`
- `POST /api/admin/showtimes`, `PUT /api/admin/showtimes/:id`, `DELETE /api/admin/showtimes/:id`
- `GET /api/admin/bookings?bookingId=BK-...&customerId=CUS001&showtimeId=ST001&status=CONFIRMED&from=...&to=...` – mọi bộ lọc tùy chọn; `bookingId` khớp chính xác `_id`; tối đa 100 kết quả.
- `GET /api/admin/customers?q=...` – tìm khách và số booking. Tra cứu booking hỗ trợ thêm `movieId`, `page`, `pageSize`; khi có `page`, response gồm `items`, `total` và `totalPages`.

API kiểm tra trường phim, tham chiếu phim/phòng, thời gian suất và lịch chiếu chồng nhau. Tạo suất chiếu khởi tạo các document `showtime_seats` ở trạng thái `AVAILABLE`. Nếu khởi tạo dở, backend cố gắng xóa các document thuộc đúng mã suất vừa tạo rồi xóa suất đó. MongoDB standalone không bảo đảm atomicity đa document nếu tiến trình dừng đột ngột. Không đổi phòng của suất đã có sơ đồ ghế; không đổi phim/giờ của suất đã có booking; không xóa phim đang được tham chiếu; không xóa suất đã có ghế/booking, hãy đóng suất thay thế.

Các API ghi quản trị đã được triển khai trong mã. Không dùng chúng trên database lịch sử khi kiểm thử; các bài kiểm thử ghi phải chọn database QA riêng.

Trang quản trị demo có thêm phần **Tổng quan dữ liệu**. Phần này chỉ đọc MongoDB bằng aggregation, không ghi dữ liệu. Các pipeline trong endpoint `/api/admin/analytics` được ghi riêng tại [`database/queries/mingo-readonly.md`](database/queries/mingo-readonly.md) để nhóm chạy đối chiếu trên Mingo. Kết quả hiển thị phản ánh database tại thời điểm gọi API; thanh toán chỉ là mô phỏng.

### Tạo booking và thanh toán mô phỏng

`POST /api/bookings`

Hủy booking demo dùng `POST /api/customers/:customerId/bookings/:bookingId/cancel`. Chỉ booking CONFIRMED của đúng khách và suất chưa bắt đầu được hủy. Payment thành công ban đầu được giữ làm lịch sử; `cancellation` ghi thời điểm và hoàn tiền mô phỏng. Ghế chỉ được giải phóng khi vẫn ở trạng thái BOOKED và thuộc đúng `bookingId`.

Request chỉ nhận mã khách hàng, suất chiếu và danh sách ghế; các trường giá gửi thêm từ client không được dùng.

```json
{
  "customerId": "CUS001",
  "showtimeId": "ST001",
  "seatCodes": ["A4", "A5"]
}
```

Backend xác thực khách hàng, suất chiếu, phòng, sơ đồ và trạng thái ghế; tính tiền bằng `showtimes.basePriceVnd`; giữ ghế bằng cập nhật có điều kiện `status: AVAILABLE`; ghi document booking theo schema hiện có; xác nhận ghế `BOOKED` và thanh toán `SIMULATED/SUCCESS`.

Response `201` gồm `_id` mới theo dạng `BK-YYYYMMDD-<12 ký tự hex>` (ngày Việt Nam và hậu tố ngẫu nhiên), `customerId`, `showtimeId`, `movieId`, `seats` (mỗi ghế có `unitPriceVnd`), `totalAmountVnd`, `status: CONFIRMED`, `payment` và `createdAt`. Mã booking lịch sử như `BK001`, `BK-DEMO-*` và các mã UUID cũ được giữ nguyên để tránh làm gãy tham chiếu.

Một booking nhiều ghế sẽ có cùng `bookingId` trên các document tương ứng trong `showtime_seats`. Đây là tham chiếu hợp lệ đến một document trong `bookings`, không phải booking bị nhân đôi. Kiểm tra hiện tại không thấy hai document booking có cùng `_id`.

Mã lỗi chính: `400` dữ liệu thiếu/sai hoặc ghế trùng/ngoài phòng; `404` khách, suất hoặc trạng thái ghế không tồn tại; `409` suất đóng/đã bắt đầu hoặc ghế không còn AVAILABLE; `500` lỗi hệ thống. Lỗi không trả URI hay stack trace về client.

## Kiểm tra bằng Mingo

Kết nối Mingo tới `mongodb://localhost:27017`, mở database `cinema_management`, sau đó:

1. Xem `showtime_seats` trước khi tạo booking.
2. Gửi `POST /api/bookings` bằng Postman/curl với ghế AVAILABLE.
3. Mở `bookings` và kiểm tra tổng tiền, trạng thái thanh toán; mở `showtime_seats` và kiểm tra các ghế thuộc booking đã thành `BOOKED`.
4. Gọi `GET /api/customers/CUS001/bookings` để xem lịch sử.
5. Thử đặt lại ghế đã BOOKED và xác nhận API trả `409`.

Các bộ lọc và pipeline aggregation chỉ đọc được chuẩn bị tại [`database/queries/mingo-readonly.md`](database/queries/mingo-readonly.md). Backup native của `cinema_management` đã được tạo và kiểm tra bằng `mongorestore --dryRun`; các thao tác ghi thử, import hoặc restore thử nghiệm vẫn phải dùng database kiểm thử riêng.

## Nhất quán dữ liệu và giới hạn

### Kiểm thử tích hợp trên QA

Không chạy kiểm thử ghi trên `cinema_management`. Tạo một database kiểm thử tạm thời, chạy backend ở cổng riêng rồi kiểm thử:

```powershell
$env:MONGODB_DB_NAME = 'cinema_management_test_integration_<hau_to_rieng>'
$env:SEED_REFERENCE_AT = (Get-Date).ToUniversalTime().ToString('o')
npm run seed:demo
$env:PORT = '3002'
npm run dev:api
```

Trong terminal khác:

```powershell
$env:MONGODB_DB_NAME = 'cinema_management_test_integration_<hau_to_rieng>'
$env:TEST_API_BASE_URL = 'http://127.0.0.1:3002'
npm run test:integration
npm run db:check
```

Endpoint analytics trả sáu nhóm MongoDB pipeline: vé/giá trị theo phim, thanh toán theo ngày, tỷ lệ ghế theo suất, vé theo khung giờ Việt Nam, booking theo trạng thái và top khách hàng. Pipeline đầy đủ nằm trong tài liệu Mingo; việc gọi API không thay thế thực nghiệm trực tiếp trong Mingo/Studio 3T.

MongoDB standalone không cung cấp transaction đa document. Backend giữ ghế tuần tự bằng điều kiện trạng thái, và khi phát hiện lỗi sẽ hoàn tác các ghế còn gắn đúng mã booking bằng điều kiện khớp suất, ghế, trạng thái và bookingId. Nếu đã tạo booking, thao tác bù chuyển booking sang `CANCELLED` và thanh toán `FAILED`, không xóa document. Cơ chế bù khôi phục được lỗi phát hiện trong lúc chạy nhưng không bảo đảm nguyên tử khi tiến trình/máy chủ dừng đột ngột. Đây là thanh toán mô phỏng, không có cổng thanh toán thật.

## Mô hình dữ liệu NoSQL

- `rooms.seats` nhúng sơ đồ ghế tĩnh vì danh sách ghế thuộc một phòng và thường được đọc cùng phòng.
- `showtimes.movieId` và `showtimes.roomId` tham chiếu `movies`/`rooms`; `showtime_seats.showtimeId` và `bookingId` tham chiếu suất/booking vì trạng thái ghế phụ thuộc từng suất.
- `bookings.customerId`, `showtimeId`, `movieId` tham chiếu các document gốc. `bookings.seats` nhúng `seatCode` và `unitPriceVnd` để giữ giá tại thời điểm mua; `payment` là thông tin thanh toán mô phỏng nhúng trong booking.
- Sáu index nghiệp vụ được giữ nguyên: unique `customers.email`; `showtimes { movieId: 1, startAt: 1 }` và `{ roomId: 1, startAt: 1, endAt: 1 }`; `bookings { customerId: 1, createdAt: -1 }` và `{ showtimeId: 1, status: 1 }`; unique `showtime_seats { showtimeId: 1, seatCode: 1 }`. Mỗi collection có thêm `_id_`.
- Sáu collection của `cinema_management` có JSON Schema validator `strict/error`; cấu trúc validator và index được ghi nhận cùng fingerprint để đối chiếu trước/sau thay đổi giao diện.
- MongoDB đảm bảo atomicity ở cấp một document. Luồng booking cập nhật nhiều ghế và một booking trên standalone bằng cập nhật có điều kiện và thao tác bù; đây không phải transaction và không thể khôi phục chắc chắn khi tiến trình/máy chủ dừng đột ngột.
- Thanh toán chỉ mô phỏng (`SIMULATED`); không kết nối cổng thanh toán thật.

## Điều hướng giao diện CineVue

- Khách hàng: `#/`, `#/movies`, `#/movies/:id`, `#/schedule`, `#/booking/:id`, `#/checkout`, `#/booking-success`, `#/my-tickets`, `#/my-tickets/:id`, `#/help`.
- Dashboard quản trị: `#/admin/dashboard`.
- Báo cáo thống kê: `#/admin/reports`.
- Quản lý nghiệp vụ: `#/admin/movies`, `#/admin/rooms`, `#/admin/showtimes`, `#/admin/customers`, `#/admin/bookings`.
- Công cụ khám phá kỹ thuật không nằm trong các route nghiệp vụ; mã tham khảo phiên bản trước vẫn được lưu trong `frontend/src/admin.js`.
- URL cũ `#admin` vẫn mở Dashboard.

Tổng quan hiển thị KPI riêng và biểu đồ tóm tắt. Báo cáo chia bốn nhóm Phim, Thanh toán, Suất chiếu, Đặt vé & khách hàng; biểu đồ lấy dữ liệu từ API. Thành phần modal, toast và xác nhận dùng chung nằm trong `frontend/src/ui.js`. Khu quản trị nghiệp vụ được kết nối qua `frontend/src/admin-business.js`; các trang bổ trợ khách hàng nằm trong `frontend/src/pages/customer-extras.js`.


## Nghiệm thu giao diện và bảo toàn dữ liệu

Nghiệm thu chức năng cuối cùng có quy trình riêng: [kiểm thử và bảo vệ database chính](docs/FINAL_ACCEPTANCE.md). `npm test` chỉ chạy unit test, không kết nối hoặc ghi MongoDB. Các lệnh QA bên dưới vẫn giữ nguyên guard; không dùng chúng để kiểm thử database chính.

Xem [báo cáo nâng cấp UI/UX](docs/UI_UX_REFINEMENT.md). `npm run db:fingerprint` chỉ đọc toàn bộ sáu collection, validator và index để tạo SHA-256 tái lập; đối chiếu trước/sau trên cùng database. Không seed, migration hoặc kiểm thử ghi trên database chính trong quá trình nâng cấp giao diện.

Chạy kiểm thử trình duyệt với Microsoft Edge đã cài trên máy. API và web QA phải được khởi chạy riêng; tài liệu hướng dẫn ví dụ API cổng 3002 và web cổng 5174:

```powershell
# Terminal API QA: dùng tên database mới, rỗng mỗi đợt kiểm thử
$env:MONGODB_DB_NAME = 'cinema_management_test_uiux_<hau_to_rieng>'
$env:SEED_REFERENCE_AT = (Get-Date).ToUniversalTime().ToString('o')
npm run seed:demo
$env:PORT = '3002'
npm run dev:api
```

```powershell
# Terminal web QA
$env:VITE_API_BASE_URL = 'http://localhost:3002'
npm run dev:web -- --port 5174 --strictPort
```

```powershell
# Terminal kiểm thử: đặt cùng tên database QA với API
$env:MONGODB_DB_NAME = 'cinema_management_test_uiux_<hau_to_rieng>'
$env:TEST_API_BASE_URL = 'http://127.0.0.1:3002'
$env:TEST_WEB_BASE_URL = 'http://127.0.0.1:5174/'
npm run test:integration
npm run test:read-models
npm run test:ui
npm run db:check
```

`test:ui` có thao tác tạo/sửa dữ liệu QA, dùng Playwright với Edge và từ chối API không trỏ vào database kiểm thử. Ảnh, kết quả JSON và bản in PDF được lưu ngoài repository tại `../MinhChung/UIUX` (hoặc `UI_EVIDENCE_DIR`). Không chạy lại seed trên QA đã có dữ liệu. Kết thúc kiểm thử, dừng API/web QA và dùng terminal mới với `.env` chính thức để chạy phiên bản chính.
