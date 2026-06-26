/**
 * Registry template chấm công THEO CÔNG TY.
 *
 * Nguồn sự thật (phía BE) cho:
 *   - Import vân tay: mỗi công ty xuất file 1 định dạng cột khác nhau → headerMap riêng.
 *   - Sinh file mẫu (.xlsx) để người dùng tải về đúng định dạng công ty đó.
 *   - Bộ cột (columns) hiển thị trên bảng tháng — FE có bản mirror tại
 *     frontend/src/pages/ChamCong/chamCongTemplates.js (GIỮ ĐỒNG BỘ THỦ CÔNG).
 *
 * Key registry theo TÊN công ty đã chuẩn hoá (bỏ dấu + lowercase) qua ALIASES.
 * Công ty chưa khai báo → fallback 'default'.
 *
 * Khi cần thêm công ty mới: thêm 1 entry vào TEMPLATES + 1 dòng vào ALIASES,
 * và cập nhật columns tương ứng ở file mirror FE.
 */

// Chuẩn hoá chuỗi: bỏ dấu, đ→d, lowercase, gộp khoảng trắng.
// Dùng chung cho cả header Excel lẫn tên công ty.
function normalizeKey(raw) {
  if (raw == null) return '';
  return String(raw)
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 4 bucket giờ chuẩn (khớp cột DB gio_hc_ngay / gio_tc_ngay / gio_hc_dem / gio_tc_dem).
const ALL_BUCKETS = ['gio_hc_ngay', 'gio_tc_ngay', 'gio_hc_dem', 'gio_tc_dem'];

// Map các mốc GIỜ CHẤM (giờ đến / nghỉ trưa / về) — dùng chung cho mọi template,
// các template có thể bổ sung alias riêng qua headerMap.
const COMMON_TIME_HEADERS = {
  'gio den':       '__gio_den',
  'gio vao':       '__gio_den',
  'gio bat dau':   '__gio_den',
  'gio cham vao':  '__gio_den',
  'nghi trua':     '__gio_nghi_trua',
  'gio nghi trua': '__gio_nghi_trua',
  'gio ve':        '__gio_ve',
  'gio ra':        '__gio_ve',
  'gio ket thuc':  '__gio_ve',
  'gio cham ra':   '__gio_ve',
};

// Identity + ngày — chung cho mọi template.
const COMMON_IDENTITY_HEADERS = {
  'ma the':           'ma_van_tay',
  'ma the cham cong': 'ma_van_tay',
  'ma van tay':       'ma_van_tay',
  'ho ten':           '__display_name',
  'ho va ten':        '__display_name',
  'ngay':             'ngay',
  'trang thai':       '__trang_thai',
  // Bộ phận / phòng ban → cập nhật vào hồ sơ công nhân
  'bo phan':          '__bo_phan',
  'phong ban':        '__bo_phan',
  'to':               '__bo_phan',
  'to nhom':          '__bo_phan',
};

// ── Template Kangyin: định dạng máy vân tay hiện hành (bê từ HEADER_MAP cũ) ──
const KANGYIN = {
  key: 'kangyin',
  label: 'Kangyin',
  columns: [...ALL_BUCKETS],
  headerMap: {
    ...COMMON_IDENTITY_HEADERS,
    ...COMMON_TIME_HEADERS,
    // Cột lịch sử vân tay Kangyin (tất cả mốc giờ trong 1 ô)
    'lich su cham van tay': '__lich_su_van_tay',
    'lich su van tay':      '__lich_su_van_tay',
    'thoi gian cham':       '__lich_su_van_tay',
    // Regular hours
    'ca ngay':          '__h_day',
    'ca dem':           '__h_night',
    'chu nhat':         '__h_sunday',
    'ngay le':          '__h_holiday',
    // OT hours (thực tế, không phải "đề xuất")
    'tang ca trc 9 45': '__ot_before_945',
    'trc 9 45':         '__ot_before_945',
    'tang ca trc 945':  '__ot_before_945',
    'sau 9 45':         '__ot_after_945',
    'tang ca sau 9 45': '__ot_after_945',
    'tang ca dem':      '__ot_night',
    'tang ca chu nhat': '__ot_sunday',
    'tang ca ngay le':  '__ot_holiday',
  },
  // Cột tiêu đề cho file mẫu tải về (giữ dấu tiếng Việt cho người dùng dễ đọc).
  templateHeaders: [
    'Mã thẻ', 'Họ tên', 'Bộ phận', 'Ngày', 'Lịch sử chấm vân tay',
    'CA NGÀY', 'CA ĐÊM', 'CHỦ NHẬT', 'NGÀY LỄ',
    'TĂNG CA TRC 9:45', 'SAU 9:45', 'TĂNG CA ĐÊM', 'TĂNG CA CHỦ NHẬT', 'TĂNG CA NGÀY LỄ',
  ],
};

// ── Template mặc định: bản rút gọn HC ngày / TC ngày + 3 mốc giờ ──
// Dùng cho công ty chưa có template riêng. Người dùng sẽ bổ sung định dạng thật sau.
const DEFAULT = {
  key: 'default',
  label: 'Mặc định',
  columns: ['gio_hc_ngay', 'gio_tc_ngay'],
  headerMap: {
    ...COMMON_IDENTITY_HEADERS,
    ...COMMON_TIME_HEADERS,
    'ca ngay':      '__h_day',
    'gio hanh chinh': '__h_day',
    'gio cong':     '__h_day',
    'tang ca':      '__ot_before_945',
    'ot':           '__ot_before_945',
  },
  templateHeaders: [
    'Mã thẻ', 'Họ tên', 'Bộ phận', 'Ngày', 'Giờ đến', 'Nghỉ trưa', 'Giờ về',
    'CA NGÀY', 'TĂNG CA',
  ],
};

const TEMPLATES = {
  default: DEFAULT,
  kangyin: KANGYIN,
};

// Map tên công ty (đã chuẩn hoá) → key template.
// Thêm alias ở đây khi công ty có tên khác nhưng cùng định dạng.
const ALIASES = {
  'kangyin':      'kangyin',
  'cong ty kangyin': 'kangyin',
  'kang yin':     'kangyin',
};

// Resolve công ty → template (fallback 'default').
function resolveTemplate(tenCongTy) {
  const key = ALIASES[normalizeKey(tenCongTy)];
  return TEMPLATES[key] || TEMPLATES.default;
}

module.exports = { normalizeKey, resolveTemplate, TEMPLATES, ALL_BUCKETS };
