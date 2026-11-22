# Bộ truy vấn chỉ đọc cho Mingo

Database: `cinema_booking`. Các mẫu bên dưới chỉ đọc. Không chọn lệnh insert/update/delete trong lúc minh họa. Bộ dữ liệu và truy vấn aggregation này chưa được chạy trong Mingo; dùng chúng để chạy lại và chụp ảnh thật.

## Filter nghiệp vụ

Trang **Quản trị demo → Khám phá dữ liệu** có thể chạy các filter dưới đây qua API GET để xem kết quả ứng dụng. Bộ lọc ghế được giới hạn theo `showtimeId` rồi lọc `status`; API không ghi dữ liệu. Kết quả API không thay thế minh chứng thao tác thật trong Mingo.

### Booking chính xác theo mã booking hoặc suất chiếu

Collection: `bookings`. `_id` có index mặc định unique `_id_`; `showtimeId` hiện chưa có index riêng.

Mã mới do backend tạo theo dạng `BK-YYYYMMDD-<12 ký tự hex>`. Mã cũ được giữ nguyên. Một mã có thể xuất hiện trên nhiều document ghế nếu một booking gồm nhiều ghế; đó là quan hệ tham chiếu, không phải document booking trùng.

```json
{ "_id": "BK-<mã booking>" }
```

```json
{ "showtimeId": "ST001", "status": "CONFIRMED" }
```

### Booking theo khách, trạng thái và khoảng ngày

Collection: `bookings` · Index liên quan: `{ customerId: 1, createdAt: -1 }`. MongoDB có thể dùng index để thu hẹp theo khách/ngày; `status` hiện không thuộc index nên cần quan sát `explain` trước khi kết luận hiệu năng.

```json
{
  "customerId": "CUS001",
  "status": "CONFIRMED",
  "createdAt": {
    "$gte": { "$date": "2026-11-01T00:00:00.000Z" },
    "$lt": { "$date": "2026-12-01T00:00:00.000Z" }
  }
}
```

### Ghế theo suất và trạng thái

Collection: `showtime_seats` · Index unique liên quan: `{ showtimeId: 1, seatCode: 1 }`. Index phục vụ lọc suất; trạng thái là điều kiện lọc bổ sung.

```json
{ "showtimeId": "ST001", "status": "BOOKED" }
```

Trang quản trị **Suất chiếu** cũng cho lọc danh sách theo `movieId`, ngày Việt Nam, `roomId` và `status`, rồi tải trạng thái ghế bằng GET để đếm AVAILABLE/HELD/BOOKED. Đây là filter trên ứng dụng; khi đối chiếu trong Mingo, chạy filter `showtimeId`/`status` phía trên và ghi nhận kết quả thật.

## Aggregation Builder

Chọn collection `bookings` làm đầu vào cho cả ba pipeline.

Ba phép tính bên dưới cũng được endpoint chỉ đọc `GET /api/admin/analytics` dùng để hiển thị trong trang Quản trị demo. Đây là cùng logic aggregation ở backend để có thể so sánh kết quả Mingo với ứng dụng. Các pipeline trong tài liệu **chưa được chạy trên Mingo**; khi bàn giao, người kiểm tra cần ghi phiên bản Mingo và lưu ảnh kết quả thật.

### Vé và giá trị booking CONFIRMED theo phim

Giá trị tính từ `seats.unitPriceVnd` để đếm và cộng từng vé. `$lookup` tham chiếu collection `movies` qua `movieId`.

```json
[
  { "$match": { "status": "CONFIRMED" } },
  { "$unwind": "$seats" },
  {
    "$group": {
      "_id": "$movieId",
      "ticketCount": { "$sum": 1 },
      "totalAmountVnd": { "$sum": "$seats.unitPriceVnd" }
    }
  },
  {
    "$lookup": {
      "from": "movies",
      "localField": "_id",
      "foreignField": "_id",
      "as": "movie"
    }
  },
  { "$unwind": { "path": "$movie", "preserveNullAndEmptyArrays": true } },
  {
    "$project": {
      "_id": 0,
      "movieId": "$_id",
      "movieTitle": { "$ifNull": ["$movie.title", "Không rõ phim"] },
      "ticketCount": 1,
      "totalAmountVnd": 1
    }
  },
  { "$sort": { "totalAmountVnd": -1 } }
]
```

Index hiện có trên `bookings` là `{ customerId: 1, createdAt: -1 }`; không có index theo `status`/`movieId`. Đọc `explain` và đo `executionStats` trước khi đề xuất index.

### Tổng thanh toán mô phỏng theo ngày

Nhóm theo ngày Việt Nam (`+07:00`) từ `payment.paidAt`; chỉ lấy booking xác nhận với payment mô phỏng thành công.

```json
[
  {
    "$match": {
      "status": "CONFIRMED",
      "payment.method": "SIMULATED",
      "payment.status": "SUCCESS",
      "payment.paidAt": { "$type": "date" }
    }
  },
  {
    "$group": {
      "_id": {
        "$dateToString": {
          "format": "%Y-%m-%d",
          "date": "$payment.paidAt",
          "timezone": "+07:00"
        }
      },
      "bookingCount": { "$sum": 1 },
      "totalAmountVnd": { "$sum": "$totalAmountVnd" }
    }
  },
  { "$sort": { "_id": 1 } }
]
```

### Số ghế BOOKED và tỷ lệ theo suất

Collection đầu vào: `showtime_seats` (khác hai pipeline trên).

```json
[
  {
    "$group": {
      "_id": "$showtimeId",
      "seatCount": { "$sum": 1 },
      "bookedCount": {
        "$sum": { "$cond": [{ "$eq": ["$status", "BOOKED"] }, 1, 0] }
      }
    }
  },
  {
    "$project": {
      "_id": 0,
      "showtimeId": "$_id",
      "seatCount": 1,
      "bookedCount": 1,
      "bookedPercent": {
        "$cond": [
          { "$eq": ["$seatCount", 0] },
          0,
          { "$multiply": [{ "$divide": ["$bookedCount", "$seatCount"] }, 100] }
        ]
      }
    }
  },
  { "$sort": { "showtimeId": 1 } }
]
```

Index `{ showtimeId: 1, seatCode: 1 }` hỗ trợ lọc theo suất; pipeline toàn bộ suất vẫn cần đọc các ghế trong collection.

## Explain và kiểm kê schema

Trong shell tương thích MongoDB, có thể so sánh truy vấn đọc trước/sau index bằng:

```javascript
db.bookings.find({ customerId: "CUS001", createdAt: { $gte: ISODate("2026-11-01T00:00:00Z"), $lt: ISODate("2026-12-01T00:00:00Z") } }).explain("executionStats")
db.showtime_seats.find({ showtimeId: "ST001", seatCode: "A1" }).explain("executionStats")
```

Ghi lại `winningPlan`, `totalKeysExamined`, `totalDocsExamined` và `executionTimeMillis` cho mỗi lần đo. Không tạo index trong buổi minh họa này và không kết luận cải thiện nếu chưa đo trên cùng điều kiện.

Kiểm kê read-only qua Node driver hiện tại ghi nhận sáu collection và các index:

- `customers`: unique `{ email: 1 }`.
- `movies`: chỉ `_id_`.
- `rooms`: chỉ `_id_`.
- `showtimes`: `{ movieId: 1, startAt: 1 }`.
- `showtime_seats`: unique `{ showtimeId: 1, seatCode: 1 }`.
- `bookings`: `{ customerId: 1, createdAt: -1 }`.

Kiểm kê hiện tại không thấy validator ở sáu collection. Đây là kết quả từ Node driver; chưa xác nhận bằng Schema Analyzer của Mingo.

## Checklist minh chứng Mingo

Chỉ đánh dấu hoàn tất sau khi thao tác thật trong Mingo và chụp ảnh có dữ liệu/kết quả rõ ràng.

- [ ] Kết nối `localhost:27017`, database `cinema_booking`, đủ sáu collection.
- [ ] Dùng trang Khám phá dữ liệu để chạy filter/aggregation qua backend; đối chiếu từng kết quả với filter/pipeline đã chạy trên Mingo (trang ứng dụng không được tính là thao tác Mingo).
- [ ] Mở document thật ở `movies`, `showtimes`, `showtime_seats`, `bookings`.
- [ ] Chụp filter booking theo khách/trạng thái/khoảng ngày và filter ghế theo suất/trạng thái.
- [ ] Chụp ba aggregation: vé/giá trị theo phim, thanh toán theo ngày, tỷ lệ ghế BOOKED.
- [ ] Chụp Schema Analyzer (hiện chưa thấy validator qua driver).
- [ ] Chụp indexes và đối chiếu với danh sách phía trên.
- [ ] Thực hiện import/export chỉ trên database kiểm thử, lưu file mẫu và ảnh kết quả.
- [ ] Dùng trial Mingo hợp lệ theo điều khoản; không tìm cách né giới hạn.
- [ ] Backup database demo nếu cần bằng quy trình đã được nhóm duyệt, rồi chỉ restore sang database riêng như `cinema_booking_restore_test`; không dùng `--drop` và không ghi đè database demo.
- [ ] Sau restore kiểm tra số document từng collection, indexes, một filter và một aggregation.

Mỗi ảnh cần chú thích tên chức năng, dữ liệu đang xem, kết quả và ý nghĩa trong đề tài. Mục import/export và backup/restore ở trên chưa được chạy.
