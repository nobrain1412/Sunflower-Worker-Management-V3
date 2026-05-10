# WorkerOS — Yêu Cầu Coding

> Tài liệu này là chuẩn bắt buộc cho toàn bộ code của dự án quản lý công nhân WorkerOS.  
> Mọi module, component, và API đều phải tuân theo các quy tắc dưới đây.

---

## 1. Tổng Quan Dự Án

- **Tên app:** WorkerOS
- **Quy mô:** ~20 người dùng nội bộ
- **Mục đích:** Quản lý công nhân, chấm công, tài chính thu/chi, ký túc xá, công ty
- **Ngôn ngữ giao diện:** Tiếng Việt toàn bộ
- **Stack:** React + Tailwind CSS (Frontend) · Node.js/Express (Backend) · PostgreSQL (Database)

---

## 2. Thiết Kế & Giao Diện

### 2.1 Theme & Màu sắc

Sử dụng dark mode làm theme mặc định. Toàn bộ màu sắc định nghĩa bằng CSS variables:

```css
:root {
  --bg0: #0d0f14;       /* nền ngoài cùng */
  --bg1: #141720;       /* sidebar, card */
  --bg2: #1c2030;       /* hover state */
  --bg3: #242840;       /* input, progress bg */
  --border: rgba(255,255,255,0.07);
  --border2: rgba(255,255,255,0.12);
  --text1: #eef0f6;     /* text chính */
  --text2: #8a8fa8;     /* text phụ */
  --text3: #545870;     /* label, placeholder */
  --accent: #4f7cff;    /* màu chủ đạo xanh */
  --accent2: #7b5fff;   /* gradient pair */
  --green: #22c986;
  --red: #ff5f72;
  --amber: #ffb344;
  --teal: #2dd4bf;
}
```

- **Không dùng** màu nền trắng hoặc theme sáng trừ khi có yêu cầu cụ thể
- **Không dùng** gradient tím trên nền trắng (cliché)
- Accent chính là `--accent` (#4f7cff) — dùng cho button primary, active nav, highlight

### 2.2 Typography

```
Font chính:   'Be Vietnam Pro'  (body, UI text)
Font số/code: 'JetBrains Mono'  (số liệu, timestamp, ID)
```

Import từ Google Fonts. **Không dùng** Inter, Roboto, Arial, hoặc system-ui.

- Title trang: 15–16px, font-weight 700
- Card title: 13px, font-weight 700
- Label/caption: 10–11px, font-weight 600, uppercase, letter-spacing 0.06em
- Body text: 12–13px, font-weight 400–500
- Số KPI: 24–32px, `var(--mono)`, font-weight 700

### 2.3 Layout

- **Sidebar** cố định bên trái, rộng 220px
- **Topbar** cao 56px, sticky
- **Content area** có padding 24px 28px
- Grid hệ thống dùng CSS Grid, không dùng float
- Border-radius: card/modal = 14px · button = 8px · input = 8px · pill/badge = 20px
- Gap giữa các card: 14px

### 2.4 Component Rules

**Button:**
```
Primary:  bg var(--accent), color #fff, hover -10% brightness
Ghost:    bg var(--bg3), border var(--border2), hover bg var(--bg2)
Danger:   bg var(--red), color #fff
```
- Padding: 7px 14px · font-size 12px · font-weight 600
- Luôn có icon SVG bên trái khi là action button

**Badge/Pill:**
- Status "Đang làm" → green · "Nghỉ phép" → amber · "Mới vào" → blue · "Nghỉ việc" → red
- Dùng class `pill` với background rgba của màu tương ứng ở 12% opacity

**Table:**
- Header: font-size 10px, uppercase, color var(--text3), letter-spacing 0.06em
- Row hover: background var(--bg2)
- Border: 1px solid var(--border) giữa các row

**Card:**
- Background var(--bg1), border 1px solid var(--border), border-radius 14px
- Card header có border-bottom phân tách
- Accent line 2px ở top của KPI card theo màu nhóm

**Input/Form:**
- Background var(--bg3), border var(--border2), color var(--text1)
- Focus: border-color var(--accent), outline none
- Placeholder: color var(--text3)
- Label: 11px, font-weight 600, color var(--text2), margin-bottom 6px

---

## 3. Cấu Trúc Database

### Bảng chính

| Bảng | Mô tả |
|---|---|
| `users` | Tài khoản hệ thống, phân quyền |
| `cong_nhan` | Hồ sơ công nhân |
| `ocr_quet` | Lịch sử quét OCR, lưu ảnh gốc + JSON kết quả |
| `cong_ty` | Thông tin công ty, bảng lương |
| `phan_cong` | Quan hệ công nhân ↔ công ty theo thời gian |
| `cham_cong` | Ngày công, OT, ca làm theo từng phân công |
| `giao_dich_tai_chinh` | Thu/chi tổng hợp dạng enum loại |
| `ky_tuc_xa` | Thông tin căn (nhiều căn) |
| `phong` | Phòng trong từng căn |
| `giuong` | Giường trong từng phòng |
| `thue_phong` | Gán công nhân ↔ giường theo thời gian |
| `hoa_don_ktx` | Hóa đơn điện/nước/phòng hàng tháng |

### Quy tắc database

- Mọi bảng có `id` kiểu `SERIAL PRIMARY KEY`
- Timestamp dùng `TIMESTAMPTZ`, default `NOW()`
- Soft delete: thêm cột `deleted_at TIMESTAMPTZ` thay vì xóa thật
- Enum lưu dạng `VARCHAR` với CHECK constraint, không dùng PostgreSQL ENUM type (khó migrate)
- Foreign key luôn có `ON DELETE RESTRICT` trừ khi có lý do cụ thể
- Index bắt buộc trên: `cong_nhan.cccd`, `phan_cong(cong_nhan_id, cong_ty_id)`, `cham_cong(phan_cong_id, ngay)`

### Trường bảng lương trong `cong_ty`

```sql
luong_co_ban        NUMERIC(12,2)   -- VNĐ/tháng
luong_theo_gio      NUMERIC(10,2)   -- VNĐ/giờ
he_so_ot            NUMERIC(4,2)    -- ví dụ 1.5
so_luong_cn_toi_da  INTEGER
so_luong_cn_hien_tai INTEGER        -- cập nhật qua trigger
```

---

## 4. API Backend

### 4.1 Chuẩn Response

Mọi API trả về cấu trúc thống nhất:

```json
{
  "success": true,
  "data": { },
  "message": "Thành công",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 142
  }
}
```

Khi lỗi:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "CCCD không hợp lệ",
    "details": [ ]
  }
}
```

### 4.2 Route naming

```
GET    /api/cong-nhan              danh sách (có filter, sort, phân trang)
GET    /api/cong-nhan/:id          chi tiết 1 công nhân
POST   /api/cong-nhan              tạo mới
PUT    /api/cong-nhan/:id          cập nhật
DELETE /api/cong-nhan/:id          soft delete

POST   /api/ocr/scan               upload ảnh, trả về JSON trích xuất
POST   /api/ocr/:id/approve        duyệt và đẩy dữ liệu vào cong_nhan
POST   /api/ocr/:id/reject         từ chối hồ sơ OCR
```

Pattern tương tự cho: `/api/cong-ty`, `/api/cham-cong`, `/api/tai-chinh`, `/api/ktx`

### 4.3 Phân trang & Filter

- Mặc định: `?page=1&limit=20`
- Filter: `?cong_ty_id=1&thang=5&nam=2026&trang_thai=active`
- Sort: `?sort=ho_ten&order=asc`

### 4.4 Auth

- JWT token, expire 8 giờ
- Refresh token expire 30 ngày, lưu trong HttpOnly cookie
- Middleware kiểm tra vai trò: `requireRole('admin')`, `requireRole('quan_ly')`
- Ba vai trò: `admin` · `quan_ly` · `xem`

---

## 5. Module OCR

### Luồng xử lý

```
Upload ảnh → Lưu ảnh gốc vào storage → Gọi OCR API → 
Lưu JSON thô vào ocr_quet → Hiển thị để admin review → 
Admin duyệt → Ghi vào cong_nhan
```

### Yêu cầu

- OCR **không ghi thẳng** vào bảng `cong_nhan` — luôn phải qua bước duyệt
- Hỗ trợ 2 loại tài liệu: `cccd` (CCCD 2 mặt) và `danh_sach` (danh sách viết tay nhiều người)
- Với loại `danh_sach`: kết quả là mảng JSON, mỗi phần tử là 1 công nhân tiềm năng
- Lưu trường `trang_thai`: `cho_duyet` · `da_duyet` · `tu_choi`
- Lưu `nguoi_duyet_id` và timestamp khi duyệt/từ chối
- Ảnh gốc lưu vào `/uploads/ocr/YYYY/MM/` theo tháng

### Trường JSON trích xuất CCCD

```json
{
  "ho_ten": "NGUYỄN VĂN A",
  "cccd": "012345678901",
  "ngay_sinh": "01/01/1995",
  "gioi_tinh": "Nam",
  "que_quan": "Hà Nam",
  "ngay_cap": "15/03/2021",
  "noi_cap": "Cục CS QLHC về TTXH"
}
```

---

## 6. Module Ký Túc Xá

### Phân cấp 3 tầng

```
ky_tuc_xa (căn)
  └── phong (phòng)
        └── giuong (giường)
              └── thue_phong (hợp đồng thuê)
                    └── hoa_don_ktx (hóa đơn hàng tháng)
```

- Một căn có nhiều phòng, một phòng có nhiều giường
- Gán công nhân ở cấp **giường** (chi tiết nhất)
- Một công nhân chỉ có 1 bản ghi `thue_phong` active tại một thời điểm
- Hóa đơn sinh tự động vào đầu mỗi tháng dựa trên `thue_phong` đang active

### Tính tiền hóa đơn

```
tong_cong = tien_phong + tien_dien + tien_nuoc
```

- `tien_phong`: lấy từ `phong.don_gia_thang` chia đầu người trong phòng
- `tien_dien` và `tien_nuoc`: nhập thủ công hoặc chia đều theo số người

---

## 7. Module Tài Chính

### Enum loại giao dịch

```
THU:  luong · thuong · phu_cap · hoan_ung
CHI:  khau_tru · tam_ung · tien_phong_ktx · bao_hiem · khac
```

- Một bảng `giao_dich_tai_chinh` duy nhất, phân biệt qua cột `loai`
- Số tiền luôn dương, chiều thu/chi xác định bởi `loai`
- Lương tính theo công thức:

```
luong_thuc_nhan = (luong_co_ban / so_ngay_lam_chuan * so_ngay_cong)
                + (luong_theo_gio * gio_ot * he_so_ot)
                - tong_khau_tru
```

- Hỗ trợ xuất bảng lương ra Excel (thư viện `exceljs` phía backend)

---

## 8. Quy Tắc Code

### 8.1 Chung

- Tên biến, hàm, file: `camelCase` (JS/TS) · `snake_case` (SQL, Python)
- Comment bằng **tiếng Việt** cho logic nghiệp vụ, tiếng Anh cho comment kỹ thuật
- Không commit file `.env` — dùng `.env.example` làm mẫu
- Mỗi file không vượt quá 300 dòng — tách module nếu quá dài

### 8.2 Frontend (React)

- Dùng functional component + hooks, không dùng class component
- State management: React Context cho auth/user, local state cho UI
- Tách component: 1 file = 1 component chính
- Tên component: `PascalCase`, tên file: `PascalCase.jsx`
- Không hardcode string tiếng Việt trong JSX — đặt vào constants hoặc i18n nếu cần tái sử dụng
- API calls qua custom hook `useApi()` hoặc React Query

### 8.3 Backend (Node.js)

- Cấu trúc thư mục:
  ```
  src/
    routes/       # định nghĩa route
    controllers/  # xử lý request/response
    services/     # business logic
    models/       # database queries
    middleware/   # auth, validate, error
    utils/        # helper functions
  ```
- Không viết SQL thẳng trong controller — luôn qua `models/`
- Validate input bằng `joi` hoặc `zod` trước khi vào controller
- Dùng `async/await`, không dùng callback

### 8.4 Xử lý lỗi

- Mọi async function trong controller wrap bằng `try/catch` hoặc `asyncWrapper`
- Không để lộ stack trace ra response production
- Log lỗi server-side bằng `winston` hoặc `pino`
- HTTP status code đúng chuẩn: 200 · 201 · 400 · 401 · 403 · 404 · 422 · 500

### 8.5 Security

- Sanitize tất cả input trước khi insert DB — dùng parameterized query, không string concat
- CCCD và thông tin cá nhân nhạy cảm: không log ra console
- Upload file: kiểm tra MIME type thực sự (không chỉ extension), giới hạn 10MB/file
- Rate limit API: 100 request/phút/IP

---

## 9. Xuất Báo Cáo

Các báo cáo bắt buộc hỗ trợ xuất:

| Báo cáo | Định dạng |
|---|---|
| Bảng chấm công tháng | Excel (.xlsx) |
| Bảng lương tổng hợp | Excel (.xlsx) |
| Thu/chi theo kỳ | Excel (.xlsx) |
| Danh sách công nhân | Excel (.xlsx) |
| Hóa đơn KTX | PDF |

- Thư viện xuất Excel: `exceljs`
- Thư viện xuất PDF: `puppeteer` hoặc `pdfkit`
- File tải về đặt tên theo pattern: `[loai-bao-cao]_T[thang]-[nam]_[timestamp].xlsx`

---

## 10. Checklist Trước Khi Deploy

- [ ] Tất cả biến môi trường đã set trong `.env.production`
- [ ] Migration database đã chạy
- [ ] Index database đã tạo đầy đủ
- [ ] Upload folder có write permission
- [ ] CORS chỉ cho phép domain production
- [ ] JWT secret đủ mạnh (≥ 64 ký tự random)
- [ ] Rate limiting đã bật
- [ ] Log lỗi ghi ra file, không chỉ console
- [ ] Backup database tự động hàng ngày đã cấu hình

---

*Cập nhật lần cuối: 05/2026 — WorkerOS v1.0*
