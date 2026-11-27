# Mô hình dữ liệu Cinema Booking

Backend chọn database qua `MONGODB_DB_NAME`, mặc định `cinema_management`. Dữ liệu hoàn thiện dùng duy nhất `cinema_management`; database kiểm thử tạm thời chỉ dùng tên bắt đầu bằng `cinema_management_test_`.

## Sáu collection

| Collection | Thiết kế |
|---|---|
| `customers` | String ID, tên/email giả lập, BSON Date đăng ký |
| `movies` | Mảng thể loại nhúng, thời lượng integer, trạng thái `NOW_SHOWING`/`COMING_SOON` |
| `rooms` | Nhúng sơ đồ `seats`; mỗi ghế có code, row, number và type |
| `showtimes` | Tham chiếu movie/room; BSON Date bắt đầu/kết thúc; giá VND nguyên không âm |
| `showtime_seats` | Một document cho mỗi ghế trong mỗi suất; unique `(showtimeId, seatCode)` |
| `bookings` | Tham chiếu customer/movie/showtime; nhúng snapshot ghế/giá và payment mô phỏng |

MongoDB validator kiểm tra cấu trúc, kiểu BSON, trường bắt buộc, enum và miền số. Quan hệ tham chiếu, tổng tiền, chồng lịch và quyền sở hữu ghế là quy tắc liên collection nên được kiểm tra bởi backend và `npm run db:check`.

`holdExpiresAt` và `bookingId` chấp nhận `null` để tương thích backend hiện tại. Không có TTL index vì expiry giữ ghế chưa được triển khai.

Booking hủy do thanh toán thất bại giữ `payment.status: FAILED` và không có `cancellation`. Booking do khách chủ động hủy giữ payment thành công ban đầu và bổ sung `cancellation.reason: CUSTOMER_REQUEST`, thời điểm hủy cùng thông tin hoàn tiền `SIMULATED/SUCCESS`. Cách này không làm mất lịch sử thanh toán gốc.

Validator booking của Nhiệm vụ 03 bổ sung cấu trúc `cancellation`. Trước khi áp dụng lên `cinema_management`, chạy migration có xác nhận; script kiểm tra toàn bộ document tương thích trước `collMod` và không sửa document:

```powershell
$env:MONGODB_DB_NAME = 'cinema_management'
$env:CONFIRM_SCHEMA_MIGRATION = 'YES'
npm run db:migrate-task03
```

## Quy tắc seed

- PRNG seed cố định `20261128`; có thể cố định mốc bằng `SEED_REFERENCE_AT` ở dạng ISO 8601.
- 50 khách giả, email miền `.test`; 12 phim; 3 phòng 32/40/48 ghế.
- 45 suất theo nhóm 20 ngày quá khứ, 5 suất trong ngày tham chiếu, 20 ngày tương lai; không chồng phòng.
- 200 booking: 170 CONFIRMED, 30 CANCELLED; không sinh PENDING/HELD giả.
- CONFIRMED sở hữu đúng ghế BOOKED; CANCELLED không giữ ghế; tổng tiền bằng tổng giá snapshot.
- Seed chỉ chạy khi database đích trống. Dữ liệu hiện hữu hoặc lần chạy gián đoạn đều làm script dừng và báo counts, không reset.

## Validator và index

Mọi validator dùng `validationLevel: strict`, `validationAction: error`. Index:

- `customers`: unique `{ email: 1 }`.
- `showtimes`: `{ movieId: 1, startAt: 1 }` và `{ roomId: 1, startAt: 1, endAt: 1 }`.
- `bookings`: `{ customerId: 1, createdAt: -1 }` và `{ showtimeId: 1, status: 1 }`.
- `showtime_seats`: unique `{ showtimeId: 1, seatCode: 1 }`.

## Giới hạn

MongoDB đang chạy standalone. Booking nhiều document dùng cập nhật có điều kiện và compensation, không có transaction đa document. Mingo phải được thao tác và chụp minh chứng trực tiếp; API hoặc script không thay thế bằng chứng thực nghiệm Mingo. Import/export và backup/restore chỉ thực hiện trên database thử nghiệm riêng.
