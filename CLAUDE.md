# WorkerOS — Project Context for Claude Code

> Đặt file này ở **root** của dự án. Claude Code sẽ tự đọc mỗi khi khởi động.
> Không xoá — đây là nguồn sự thật duy nhất cho toàn bộ dự án.

---

## Dự án là gì

**WorkerOS** — web app quản lý công nhân nội bộ, ~20 người dùng.

Các module chính:
- Hồ sơ công nhân (thêm thủ công + OCR CCCD/danh sách viết tay)
- Phân công công nhân vào công ty
- Chấm công (ngày công, OT, ca làm)
- Tài chính thu/chi (lương, khấu trừ, tạm ứng)
- Ký túc xá nhiều căn (căn → phòng → giường)
- Báo cáo & xuất Excel/PDF

Giao diện: **Tiếng Việt toàn bộ**, dark mode mặc định.

---

## Tech Stack

```
Frontend:  React 18 + Tailwind CSS + React Query
Backend:   Node.js + Express
Database:  PostgreSQL
Auth:      JWT (8h) + Refresh token HttpOnly cookie (30 ngày)
Excel:     exceljs
PDF:       pdfkit
OCR:       Google Vision API hoặc Tesseract
Hosting:   VPS / Railway
```

---

## Cấu trúc thư mục

```
workeros/
├── CLAUDE.md               ← file này
├── CODING_REQUIREMENTS.md  ← đọc thêm khi cần chi tiết
├── frontend/
│   ├── src/
│   │   ├── components/     PascalCase.jsx — 1 file = 1 component
│   │   ├── pages/          Dashboard, CongNhan, ChamCong, TaiChinh, KTX
│   │   ├── hooks/          useApi(), useAuth(), useCongNhan()...
│   │   ├── context/        AuthContext, AppContext
│   │   └── constants/      strings VI, enums, config
│   └── public/
└── backend/
    └── src/
        ├── routes/         định nghĩa route
        ├── controllers/    xử lý request/response
        ├── services/       business logic
        ├── models/         database queries (không SQL trong controller)
        ├── middleware/      auth, validate, errorHandler
        └── utils/          helpers, logger
```

---

## Database — 12 bảng

```sql
users           -- tài khoản, vai trò: admin | quan_ly | xem
cong_nhan       -- hồ sơ công nhân, soft delete (deleted_at)
ocr_quet        -- lịch sử OCR, trang_thai: cho_duyet|da_duyet|tu_choi
cong_ty         -- công ty + bảng lương (luong_co_ban, luong_theo_gio, he_so_ot)
phan_cong       -- công nhân ↔ công ty theo thời gian
cham_cong       -- ngày công, OT, ca làm (thuộc phan_cong)
giao_dich_tai_chinh  -- thu/chi, phân loại bằng cột `loai`
ky_tuc_xa       -- căn (nhiều căn)
phong           -- phòng trong căn
giuong          -- giường trong phòng
thue_phong      -- công nhân ↔ giường (1 active tại một thời điểm)
hoa_don_ktx     -- hóa đơn điện/nước/phòng hàng tháng
```

**Quy tắc DB bắt buộc:**
- `SERIAL PRIMARY KEY` cho mọi bảng
- `TIMESTAMPTZ` + `DEFAULT NOW()` cho timestamps
- Soft delete bằng `deleted_at`, không xoá thật
- Enum dùng `VARCHAR` + `CHECK`, không dùng PostgreSQL ENUM
- Foreign key: `ON DELETE RESTRICT`
- Index bắt buộc: `cong_nhan.cccd`, `phan_cong(cong_nhan_id, cong_ty_id)`, `cham_cong(phan_cong_id, ngay)`

---

## API — chuẩn response

```json
// Thành công
{ "success": true, "data": {}, "message": "Thành công", "meta": { "page": 1, "limit": 20, "total": 142 } }

// Lỗi
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "CCCD không hợp lệ", "details": [] } }
```

**Routes pattern:**
```
GET    /api/cong-nhan           danh sách + filter + phân trang
GET    /api/cong-nhan/:id       chi tiết
POST   /api/cong-nhan           tạo mới
PUT    /api/cong-nhan/:id       cập nhật
DELETE /api/cong-nhan/:id       soft delete

POST   /api/ocr/scan            upload ảnh → JSON trích xuất
POST   /api/ocr/:id/approve     duyệt → ghi vào cong_nhan
POST   /api/ocr/:id/reject      từ chối

-- Tương tự cho: /api/cong-ty /api/cham-cong /api/tai-chinh /api/ktx
```

**Query params chuẩn:** `?page=1&limit=20&sort=ho_ten&order=asc&trang_thai=active&thang=5&nam=2026`

---

## UI — Design tokens (dark mode)

```css
--bg0: #0d0f14    /* nền ngoài */
--bg1: #141720    /* sidebar, card */
--bg2: #1c2030    /* hover */
--bg3: #242840    /* input bg */
--border:  rgba(255,255,255,0.07)
--border2: rgba(255,255,255,0.12)
--text1: #eef0f6  /* chính */
--text2: #8a8fa8  /* phụ */
--text3: #545870  /* label, placeholder */
--accent:  #4f7cff
--accent2: #7b5fff
--green:  #22c986
--red:    #ff5f72
--amber:  #ffb344
--teal:   #2dd4bf
```

Font: `'Be Vietnam Pro'` (UI) + `'JetBrains Mono'` (số liệu). Không dùng Inter/Roboto/Arial.

**Layout desktop:** Sidebar 220px cố định trái + Topbar 56px + Content padding 24px 28px.
**Layout mobile:** Sidebar → Bottom navigation 5 tab. Table → Card list. KPI grid → scroll ngang.

---

## OCR — luồng xử lý

```
Upload ảnh → lưu file gốc /uploads/ocr/YYYY/MM/
→ gọi OCR API → lưu JSON thô vào ocr_quet (trang_thai = cho_duyet)
→ admin review trên UI → approve → ghi vào cong_nhan
                        → reject → đánh dấu tu_choi
```

OCR **không bao giờ** ghi thẳng vào `cong_nhan`. Bắt buộc qua bước duyệt.

Hỗ trợ 2 loại: `cccd` (1 người) và `danh_sach` (nhiều người, kết quả là mảng).

---

## Tài chính — công thức lương

```
luong_thuc_nhan = (luong_co_ban / ngay_lam_chuan * so_ngay_cong)
                + (luong_theo_gio * gio_ot * he_so_ot)
                - tong_khau_tru
```

Enum `loai` trong `giao_dich_tai_chinh`:
- Thu: `luong` `thuong` `phu_cap` `hoan_ung`
- Chi: `khau_tru` `tam_ung` `tien_phong_ktx` `bao_hiem` `khac`

---

## Quy tắc code — bắt buộc

| Quy tắc | Chi tiết |
|---|---|
| Naming | `camelCase` JS · `snake_case` SQL |
| Comment | Tiếng Việt cho nghiệp vụ, tiếng Anh cho kỹ thuật |
| File size | Tối đa 300 dòng, tách module nếu quá |
| SQL | Chỉ trong `models/`, dùng parameterized query |
| Validate | `zod` hoặc `joi` trước controller |
| Error | `try/catch` mọi async, không lộ stack trace production |
| Log | `winston` hoặc `pino`, không log CCCD/thông tin nhạy cảm |
| Upload | Kiểm tra MIME thực, giới hạn 10MB |
| Rate limit | 100 req/phút/IP |
| Auth | `requireRole('admin')` · `requireRole('quan_ly')` middleware |

---

## UI đã thiết kế sẵn (cần implement)

Các màn hình đã có mockup đầy đủ, implement theo đúng design:

- [x] **Dashboard desktop** — KPI cards, bar chart ngày công, donut phân bổ công ty, bảng CN mới, activity feed, KTX occupancy
- [x] **Dashboard mobile** — tổng CN đang làm, CN mới theo công ty trong ngày, activity feed, FAB thêm mới + bottom sheet 3 tùy chọn
- [x] **Bottom sheet thêm CN** — 3 option: nhập thủ công / quét CCCD / quét danh sách
- [x] **Form thêm CN thủ công (mobile)** — 3 bước: cá nhân → phân công+KTX → xác nhận → success
- [ ] Màn hình OCR quét CCCD
- [ ] Màn hình OCR quét danh sách viết tay + bulk review
- [ ] Hồ sơ chi tiết công nhân
- [ ] Chấm công desktop
- [ ] Thu/chi + bảng lương
- [ ] Quản lý KTX (sơ đồ phòng)
- [ ] Quản lý công ty (cấu hình lương)
- [ ] Báo cáo + xuất Excel/PDF

---

## Báo cáo — xuất file

| Loại | Format | Thư viện |
|---|---|---|
| Bảng chấm công tháng | `.xlsx` | exceljs |
| Bảng lương tổng hợp | `.xlsx` | exceljs |
| Thu/chi theo kỳ | `.xlsx` | exceljs |
| Danh sách công nhân | `.xlsx` | exceljs |
| Hóa đơn KTX | `.pdf` | pdfkit |

Tên file: `[loai-bao-cao]_T[thang]-[nam]_[timestamp].xlsx`

---

## Khi Claude Code được hỏi về dự án

1. Đây là WorkerOS — app quản lý công nhân nội bộ ~20 user
2. Stack: React + Tailwind / Node.js + Express / PostgreSQL
3. Luôn dùng dark mode design tokens ở trên
4. Luôn viết UI tiếng Việt
5. Luôn tuân theo chuẩn API response `{ success, data, message, meta }`
6. OCR không ghi thẳng vào DB — bắt buộc qua duyệt
7. Xem `CODING_REQUIREMENTS.md` để biết chi tiết đầy đủ hơn

---

*WorkerOS v1.0 — Cập nhật 05/2026*
