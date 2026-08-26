// Helper + cấu hình tĩnh cho trang tuyển dụng Sunflower.
// Toàn bộ dữ liệu hiển thị (việc làm, công ty, thống kê) lấy từ API thật.
// File này chỉ còn helper định dạng và các nhãn giao diện, KHÔNG chứa dữ liệu mẫu.

// Bảng màu xoay vòng cho avatar chữ cái (theo handoff).
export const PALETTE = ['#2c4a8a', '#d98b2b', '#c9678f', '#5b7ec9', '#8a5fb0', '#3d8a7a'];

export const pickColor = (i) => PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];

// 1–2 chữ cái đầu của tên (viết hoa) — dùng cho avatar.
export function mono(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// Định dạng số tiền VNĐ; trả null nếu không hợp lệ.
export function fmtLuong(n) {
  const v = Number(n || 0);
  if (v <= 0) return null;
  return v.toLocaleString('vi-VN') + 'đ';
}

// Chip lương ngắn gọn cho card việc làm.
export function salaryText(ct) {
  const coBan = fmtLuong(ct?.luong_co_ban);
  if (coBan) return coBan;
  const gio = fmtLuong(ct?.luong_theo_gio);
  if (gio) return gio + '/giờ';
  return 'Thỏa thuận';
}

// Định dạng số lớn cho khối thống kê Hero (vd 1234 → "1.234").
export function fmtStat(n) {
  return Number(n || 0).toLocaleString('vi-VN');
}

export const toArr = (v) => (Array.isArray(v) ? v : []);

// Mỗi mục có thể kèm `to` để điều hướng thật; không có `to` là link marketing (trơ).
export const NAV_ITEMS = [
  { label: 'Việc làm' },
  { label: 'Hồ sơ & CV' },
  { label: 'Công ty' },
  { label: 'Công cụ' },
  { label: 'Tra cứu vân tay', to: '/tra-cuu-cong' },
];

export const LOCATIONS = [
  'Tất cả địa điểm', 'Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Bình Dương', 'Cần Thơ', 'Làm từ xa',
];

export const FOOTER_COLS = [
  { title: 'Về Sunflower', links: ['Giới thiệu', 'Tuyển dụng nội bộ', 'Liên hệ', 'Báo chí'] },
  { title: 'Dành cho ứng viên', links: ['Tìm việc làm', 'Tạo CV online', 'Tính lương Gross - Net', 'Trắc nghiệm nghề nghiệp'] },
  { title: 'Nhà tuyển dụng', links: ['Đăng tin tuyển dụng', 'Tìm kiếm hồ sơ', 'Báo giá dịch vụ', 'Hỗ trợ khách hàng'] },
];

// Chuyển 1 công ty thật (từ /api/tuyen-dung) thành object card việc làm.
export function companyToJob(ct, i) {
  return {
    id: 'co-' + ct.id,
    title: ct.ten_cong_ty,
    company: ct.dia_chi || 'Đang tuyển công nhân',
    salary: salaryText(ct),
    location: 'Đang tuyển',
    tag: ct.so_dien_thoai ? 'Liên hệ ngay' : 'Toàn thời gian',
    mono: mono(ct.ten_cong_ty),
    color: pickColor(i),
    real: true,
    congTy: ct,
  };
}

// Chuyển 1 công ty thật thành object card thương hiệu.
export function companyToBrand(ct, i) {
  return {
    key: 'co-' + ct.id,
    name: ct.ten_cong_ty,
    subtitle: 'Đang tuyển dụng',
    mono: mono(ct.ten_cong_ty),
    color: pickColor(i + 2),
    real: true,
    congTy: ct,
  };
}
