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

// Bỏ dấu tiếng Việt + hạ chữ thường để so khớp không phân biệt dấu/hoa-thường.
export function boDau(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

// 63 tỉnh/thành để nhận diện tỉnh từ địa chỉ dạng text tự do trong cong_ty.dia_chi.
export const VN_PROVINCES = [
  'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Kạn', 'Bạc Liêu', 'Bắc Ninh',
  'Bến Tre', 'Bình Định', 'Bình Dương', 'Bình Phước', 'Bình Thuận', 'Cà Mau',
  'Cần Thơ', 'Cao Bằng', 'Đà Nẵng', 'Đắk Lắk', 'Đắk Nông', 'Điện Biên', 'Đồng Nai',
  'Đồng Tháp', 'Gia Lai', 'Hà Giang', 'Hà Nam', 'Hà Nội', 'Hà Tĩnh', 'Hải Dương',
  'Hải Phòng', 'Hậu Giang', 'Hòa Bình', 'Hưng Yên', 'Khánh Hòa', 'Kiên Giang',
  'Kon Tum', 'Lai Châu', 'Lâm Đồng', 'Lạng Sơn', 'Lào Cai', 'Long An', 'Nam Định',
  'Nghệ An', 'Ninh Bình', 'Ninh Thuận', 'Phú Thọ', 'Phú Yên', 'Quảng Bình',
  'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sóc Trăng', 'Sơn La',
  'Tây Ninh', 'Thái Bình', 'Thái Nguyên', 'Thanh Hóa', 'Thừa Thiên Huế', 'Tiền Giang',
  'TP. Hồ Chí Minh', 'Trà Vinh', 'Tuyên Quang', 'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái',
];

// Chuẩn hoá sẵn tên tỉnh để so khớp nhanh; "TP. Hồ Chí Minh" khớp cả "hồ chí minh"/"tphcm".
const PROVINCE_MATCH = VN_PROVINCES.map((ten) => {
  const keys = [boDau(ten)];
  if (ten === 'TP. Hồ Chí Minh') keys.push('ho chi minh', 'tphcm', 'tp hcm', 'hcm', 'sai gon');
  if (ten === 'Bà Rịa - Vũng Tàu') keys.push('vung tau', 'ba ria');
  if (ten === 'Thừa Thiên Huế') keys.push('hue');
  return { ten, keys };
});

// Nhận diện tỉnh/thành xuất hiện trong địa chỉ; trả tên chuẩn hoặc null.
// Ưu tiên chuỗi khớp dài nhất để tránh nhầm (vd "Nam" trong "Nam Định").
export function extractTinh(diaChi) {
  const norm = boDau(diaChi);
  if (!norm) return null;
  let found = null;
  let foundLen = 0;
  for (const p of PROVINCE_MATCH) {
    for (const k of p.keys) {
      if (k.length > foundLen && norm.includes(k)) { found = p.ten; foundLen = k.length; }
    }
  }
  return found;
}

// Nhận diện tên khu/cụm công nghiệp từ địa chỉ (KCN, CCN, Khu/Cụm công nghiệp, Cụm CN).
// Trả tên KCN đã gọn (cắt tại dấu phẩy/gạch) hoặc null nếu địa chỉ không nêu KCN.
export function extractKcn(diaChi) {
  const m = String(diaChi || '').match(
    /(?:KCN|CCN|Khu\s+công\s+nghiệp|Cụm\s+công\s+nghiệp|Cụm\s+CN)\s+([^,\-–—;.]+)/i,
  );
  if (!m) return null;
  const ten = m[1].replace(/\s+/g, ' ').trim();
  return ten.length >= 2 ? ten : null;
}

// Danh sách lựa chọn (tỉnh, KCN) suy ra từ dữ liệu công ty thật — chỉ hiện mục có công ty.
// Đồng thời gắn _tinh/_kcn vào từng công ty để lọc phía client.
export function phanTichDiaDiem(congTyList) {
  const items = congTyList.map((ct) => ({
    ...ct,
    _tinh: extractTinh(ct.dia_chi),
    _kcn: extractKcn(ct.dia_chi),
  }));

  const tinhSet = new Map();   // boDau -> tên hiển thị
  const kcnSet = new Map();
  for (const it of items) {
    if (it._tinh) tinhSet.set(boDau(it._tinh), it._tinh);
    if (it._kcn)  kcnSet.set(boDau(it._kcn),  it._kcn);
  }
  const sortVi = (a, b) => a.localeCompare(b, 'vi');
  return {
    items,
    tinhOptions: [...tinhSet.values()].sort(sortVi),
    kcnOptions:  [...kcnSet.values()].sort(sortVi),
  };
}

// Mỗi mục có thể kèm `to` để điều hướng thật; không có `to` là link marketing (trơ).
export const NAV_ITEMS = [
  { label: 'Việc làm' },
  { label: 'Hồ sơ & CV' },
  { label: 'Công ty' },
  { label: 'Công cụ' },
  { label: 'Tra cứu vân tay', to: '/tra-cuu-cong' },
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
