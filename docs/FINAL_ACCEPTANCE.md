# Nghiệm thu chức năng CINEVUE

Không thay giao diện đã chốt, schema, enum, validator hoặc index. Chạy `npm test` và `npm run build:web` để kiểm tra không ghi dữ liệu. Các entry point QA `test:integration`, `test:read-models`, `test:ui` vẫn chỉ chấp nhận tiền tố `cinema_management_test_`.

## Chế độ chỉ đọc trên database chính

API và web phải trỏ vào cùng `cinema_management`; mặc định API cổng 3000, web cổng 5173. Mở terminal kiểm thử riêng, đặt thư mục minh chứng ngoài repository:

```powershell
$env:MONGODB_DB_NAME = 'cinema_management'
$env:TEST_API_BASE_URL = 'http://127.0.0.1:3000'
$env:TEST_WEB_BASE_URL = 'http://127.0.0.1:5173/'
$env:ACCEPTANCE_EVIDENCE_DIR = 'E:\NghiemThuFinal\ReadOnly'
npm run test:acceptance:read
npm run test:acceptance:ui-oracle
npm run db:check
npm run db:fingerprint
```

Oracle đọc BSON trực tiếp, tự tính ID, thứ tự, tổng tiền, thống kê và so với API/UI. Các lượt đọc phải chạy khi không có thao tác ghi đồng thời: phân trang offset không cung cấp snapshot xuyên nhiều HTTP request.

## Chế độ nghiệm thu có ghi — chỉ khi được chủ dữ liệu cho phép

Các lệnh dưới đây **ghi trực tiếp database chính**, không phải lệnh khởi chạy ứng dụng hoặc kiểm thử mặc định. Phải backup trước, lưu manifest JSON ngoài repo chứa `database`, `archive` (đường dẫn tuyệt đối), `bytes`, `sha256`, `dryRun: true`. `archive` là full native `mongodump --db=cinema_management --archive=... --gzip`; kiểm tra dry-run bằng `mongorestore --archive=... --gzip --dryRun`. Dry-run không thay thế thực nghiệm restore.

```powershell
$env:ACCEPTANCE_CONFIRM = 'WRITE cinema_management'
$env:ACCEPTANCE_BACKUP_MANIFEST = 'E:\NghiemThuFinal\backup-manifest.json'
$env:MONGORESTORE_PATH = (Get-Command mongorestore).Source
$env:UI_EVIDENCE_DIR = 'E:\NghiemThuFinal\Browser'
npm run test:acceptance:api
npm run test:acceptance:ui
npm run test:acceptance:regression
npm run test:acceptance:actions
npm run test:acceptance:mongo
npm run test:acceptance:boundaries
```

Chạy tuần tự, không chạy hai lượt có ghi song song. Guard kiểm tra tên DB chính xác (không dùng prefix), health API, xác nhận ghi, kích thước/hash archive và chạy lại dry-run trước mỗi suite ghi. Không đổi guard QA. Suite boundaries cố ý chỉ chạy một lần mỗi chu kỳ reset để tránh đè fixture đã có. Microsoft Edge và Playwright cần có cho suite trình duyệt.

Các suite có ghi tạo booking/phim/suất thử; không tự reset hoặc xóa database. Sau nghiệm thu, lưu backup trạng thái kiểm thử, dừng mọi API/web có quyền ghi, xác minh backup gốc rồi thực hiện quy trình phục hồi đã được chủ dữ liệu phê duyệt. Không cung cấp lệnh reset tự động nguy hiểm trong repo.

Phiên nghiệm thu 28/11/2026 dùng seed PRNG `20261128`, `SEED_REFERENCE_AT=2026-11-27T03:00:00.000Z`: 50 customers, 12 movies, 3 rooms, 45 showtimes, 1.800 showtime_seats, 200 bookings (2.110 document). Không thay reference thành ngày chạy test. Seed thông thường từ chối database không trống.

Sau phục hồi chỉ chạy chế độ đọc; với regression đặt `$env:ACCEPTANCE_READ_ONLY='1'` để bỏ các thao tác đặt vé. Không chạy các suite có ghi sau reset. Tắt xác nhận ghi trong terminal bằng `Remove-Item Env:ACCEPTANCE_CONFIRM` khi kết thúc.

Minh chứng, archive, ảnh/PDF và báo cáo cụ thể của phiên nghiệm thu lưu ngoài repo. Các thanh toán/hoàn tiền là **mô phỏng**; ứng dụng local không có xác thực tài khoản, không phải hệ thống bán vé production. MongoDB standalone dùng cập nhật có điều kiện và bù trừ, không đảm bảo transaction đa document hoặc khôi phục sau mất điện/crash.
