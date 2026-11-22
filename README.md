# Cinema Booking – Đồ án NoSQL

Ứng dụng minh họa đặt vé phim dùng MongoDB. Backend Node.js/Express truy cập database `cinema_booking`; Mingo/Compass dùng để duyệt và kiểm chứng document thật. MongoDB hiện chạy standalone 4.4.31 nên luồng nhiều document không dùng transaction.

## Môi trường

- Node.js 24.15.0, npm 11.12.1
- MongoDB 4.4.31 Community tại `localhost:27017`
- Dependency: Express, MongoDB Node.js driver, CORS, dotenv

## Cài đặt và chạy

```powershell
npm install
Copy-Item .env.example .env # chỉ khi .env chưa tồn tại
npm run seed               # thêm ID mẫu còn thiếu; không xóa/ghi đè document
npm run dev:api
```

`.env` mặc định dùng `MONGODB_URI=mongodb://localhost:27017` và `PORT=3000`. Không commit `.env`.

Seed demo gồm 6 khách mẫu, 6 phim, 2 phòng, 6 suất, trạng thái ghế riêng theo suất và nhiều booking xác nhận/hủy trải trên các ngày. Tên/email khách đều là dữ liệu giả (địa chỉ mới dùng miền `.test`). Seed chỉ upsert bằng `_id` cố định với `$setOnInsert`; nếu ID đã tồn tại, nội dung hiện có được giữ nguyên. Có thể chạy lại để bổ sung các ID còn thiếu; không dùng seed làm thao tác reset.

Sau lần mở rộng dữ liệu demo ngày 22/11/2026, database local được kiểm tra có 6 khách, 6 phim, 2 phòng, 6 suất, 224 document ghế và 10 booking (9 CONFIRMED, 1 CANCELLED). Đây là ảnh chụp trạng thái database tại thời điểm đó; số booking sẽ thay đổi khi tiếp tục demo.

### Chạy frontend

Mở terminal thứ hai và chạy:

```powershell
npm run dev:web
```

Mặc định Vite dùng `http://localhost:5173`; frontend gọi API tại `http://localhost:3000`. Có thể sao chép `frontend/.env.example` thành `frontend/.env` và đặt `VITE_API_BASE_URL` nếu backend dùng địa chỉ khác. Sau khi đổi biến môi trường, khởi động lại Vite.

Kịch bản demo end-to-end: chạy MongoDB, backend và frontend; chọn phim/suất/ghế AVAILABLE; đặt vé mô phỏng; xác nhận lịch sử xuất hiện. Trong Mingo mở `cinema_booking.bookings` để xem booking và `showtime_seats` để thấy ghế tương ứng chuyển thành BOOKED.

## API

### Đọc dữ liệu

- `GET /api/health`
- `GET /api/movies` – phim có `status: NOW_SHOWING`
- `GET /api/movies/:id/showtimes` – suất mở bán trong tương lai
- `GET /api/showtimes/:id/seats` – trạng thái ghế theo suất
- `GET /api/customers/:customerId/bookings` – lịch sử, mới nhất trước
- `GET /api/customers/:customerId/bookings/details` – lịch sử kèm `movieTitle` và `startAt`, lấy bằng tra cứu read-only từ `movies`/`showtimes`. Route lịch sử cũ giữ nguyên response.

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

Nút **Quản trị demo** mở khu quản trị được tách thành năm trang điều hướng: **Tổng quan**, **Phim**, **Suất chiếu**, **Tra cứu booking** và **Khám phá dữ liệu**. Trang tổng quan hiển thị ba aggregation đọc từ MongoDB. Trang Suất chiếu lọc theo phim, ngày chiếu, phòng và trạng thái; có thể tải số ghế AVAILABLE/HELD/BOOKED cho từng suất. Trang Tra cứu booking hỗ trợ lọc chính xác theo mã booking, khách hàng, mã suất, trạng thái và ngày. Trang Khám phá dữ liệu chạy filter booking, filter ghế và từng aggregation qua backend để người xem hiểu collection, pipeline, kết quả và index liên quan; pipeline đầy đủ để chạy trong Mingo nằm ở [`database/queries/mingo-readonly.md`](database/queries/mingo-readonly.md). Thao tác xem/lọc các trang này dùng GET/read-only; thao tác quản lý phim/suất vẫn có API ghi. Trang hiển thị cảnh báo rõ đây là demo local, không có đăng nhập và không an toàn để triển khai công khai. Backend chỉ nhận các route `/api/admin/*` từ loopback và từ Origin frontend local `http://localhost:5173` hoặc `http://127.0.0.1:5173` (Origin trống được chấp nhận cho công cụ local). Không mở cổng API ra Internet.

- `GET /api/admin/movies`, `GET /api/admin/rooms`, `GET /api/admin/showtimes`
- `GET /api/admin/analytics` – đọc ba aggregation: vé/giá trị booking xác nhận theo phim, thanh toán mô phỏng theo ngày và tỷ lệ ghế BOOKED theo suất.
- `POST /api/admin/movies`, `PUT /api/admin/movies/:id`, `DELETE /api/admin/movies/:id`
- `POST /api/admin/showtimes`, `PUT /api/admin/showtimes/:id`, `DELETE /api/admin/showtimes/:id`
- `GET /api/admin/bookings?bookingId=BK-...&customerId=CUS001&showtimeId=ST001&status=CONFIRMED&from=...&to=...` – mọi bộ lọc tùy chọn; `bookingId` khớp chính xác `_id`; tối đa 100 kết quả.

API kiểm tra trường phim, tham chiếu phim/phòng, thời gian suất và lịch chiếu chồng nhau. Tạo suất chiếu khởi tạo các document `showtime_seats` ở trạng thái `AVAILABLE`. Nếu khởi tạo dở, backend cố gắng xóa các document thuộc đúng mã suất vừa tạo rồi xóa suất đó. MongoDB standalone không bảo đảm atomicity đa document nếu tiến trình dừng đột ngột. Không đổi phòng của suất đã có sơ đồ ghế; không đổi phim/giờ của suất đã có booking; không xóa phim đang được tham chiếu; không xóa suất đã có ghế/booking, hãy đóng suất thay thế.

Các API ghi quản trị đã được triển khai trong mã nhưng **chưa được gọi trong kiểm tra**. Lần mở rộng dữ liệu demo gần nhất dùng seed insert-only trong `cinema_booking`; các document cũ được giữ nguyên. Seed không tác động database khác.

Trang quản trị demo có thêm phần **Tổng quan dữ liệu**. Phần này chỉ đọc MongoDB bằng aggregation, không ghi dữ liệu. Các pipeline trong endpoint `/api/admin/analytics` được ghi riêng tại [`database/queries/mingo-readonly.md`](database/queries/mingo-readonly.md) để nhóm chạy đối chiếu trên Mingo. Kết quả hiển thị phản ánh database tại thời điểm gọi API; thanh toán chỉ là mô phỏng.

### Tạo booking và thanh toán mô phỏng

`POST /api/bookings`

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

Kết nối Mingo tới `mongodb://localhost:27017`, mở `cinema_booking`, sau đó:

1. Xem `showtime_seats` trước khi tạo booking.
2. Gửi `POST /api/bookings` bằng Postman/curl với ghế AVAILABLE.
3. Mở `bookings` và kiểm tra tổng tiền, trạng thái thanh toán; mở `showtime_seats` và kiểm tra các ghế thuộc booking đã thành `BOOKED`.
4. Gọi `GET /api/customers/CUS001/bookings` để xem lịch sử.
5. Thử đặt lại ghế đã BOOKED và xác nhận API trả `409`.

Các bộ lọc và pipeline aggregation chỉ đọc được chuẩn bị tại [`database/queries/mingo-readonly.md`](database/queries/mingo-readonly.md). Chạy aggregation/import/export/backup/restore trên database demo chưa được thực hiện trong chặng này; backup/restore chỉ hướng dẫn trên database kiểm thử riêng.

## Nhất quán dữ liệu và giới hạn

MongoDB standalone không cung cấp transaction đa document. Backend giữ ghế tuần tự bằng điều kiện trạng thái, và khi phát hiện lỗi sẽ hoàn tác các ghế còn gắn đúng mã booking bằng điều kiện khớp suất, ghế, trạng thái và bookingId. Nếu đã tạo booking, thao tác bù chuyển booking sang `CANCELLED` và thanh toán `FAILED`, không xóa document. Cơ chế bù khôi phục được lỗi phát hiện trong lúc chạy nhưng không bảo đảm nguyên tử khi tiến trình/máy chủ dừng đột ngột. Đây là thanh toán mô phỏng, không có cổng thanh toán thật.

## Mô hình dữ liệu NoSQL

- `rooms.seats` nhúng sơ đồ ghế tĩnh vì danh sách ghế thuộc một phòng và thường được đọc cùng phòng.
- `showtimes.movieId` và `showtimes.roomId` tham chiếu `movies`/`rooms`; `showtime_seats.showtimeId` và `bookingId` tham chiếu suất/booking vì trạng thái ghế phụ thuộc từng suất.
- `bookings.customerId`, `showtimeId`, `movieId` tham chiếu các document gốc. `bookings.seats` nhúng `seatCode` và `unitPriceVnd` để giữ giá tại thời điểm mua; `payment` là thông tin thanh toán mô phỏng nhúng trong booking.
- Index đã kiểm tra bằng Node driver: unique `customers.email`; `showtimes { movieId: 1, startAt: 1 }`; `bookings { customerId: 1, createdAt: -1 }`; unique `showtime_seats { showtimeId: 1, seatCode: 1 }`; `movies`/`rooms` chỉ có `_id_`.
- Lần kiểm tra hiện tại không thấy schema validator trên sáu collection. Không có validator nghĩa là ứng dụng/backend đang gánh phần validation nghiệp vụ; không tuyên bố MongoDB đang cưỡng chế kiểu/trạng thái bằng validator.
- MongoDB đảm bảo atomicity ở cấp một document. Luồng booking cập nhật nhiều ghế và một booking trên standalone bằng cập nhật có điều kiện và thao tác bù; đây không phải transaction và không thể khôi phục chắc chắn khi tiến trình/máy chủ dừng đột ngột.
- Thanh toán chỉ mô phỏng (`SIMULATED`); không kết nối cổng thanh toán thật.
