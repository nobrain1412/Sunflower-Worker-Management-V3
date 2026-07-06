// Dữ liệu tĩnh + helper cho trang tuyển dụng Sunflower.
// Các phần "marketing chrome" (banner, ngành nghề, thống kê...) dùng dữ liệu mẫu
// theo đúng thiết kế; phần việc làm / công ty được thay bằng dữ liệu thật khi có.

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

export const toArr = (v) => (Array.isArray(v) ? v : []);

export const NAV_ITEMS = ['Việc làm', 'Hồ sơ & CV', 'Công ty', 'Công cụ', 'Cẩm nang nghề nghiệp'];

export const HOT_KEYWORDS = ['Kế toán', 'Marketing', 'IT', 'Ngân hàng', 'Bán hàng', 'Nhân sự'];

export const STATS = [
  { value: '52.300+', label: 'Việc làm đang tuyển' },
  { value: '18.900+', label: 'Doanh nghiệp' },
  { value: '5,2 triệu', label: 'Ứng viên tin dùng' },
];

export const LOCATIONS = [
  'Tất cả địa điểm', 'Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Bình Dương', 'Cần Thơ', 'Làm từ xa',
];

export const BANNERS = [
  {
    kicker: 'Tuyển dụng tháng 7',
    title: 'Cơ hội việc làm lương cao đang chờ bạn',
    sub: 'Hơn 5.000 vị trí mới từ các doanh nghiệp hàng đầu',
    bg: 'linear-gradient(120deg,#2c4a8a 0%,#3a5ea6 100%)',
    fg: '#ffffff', accent: '#f7c948',
  },
  {
    kicker: 'Miễn phí trọn đời',
    title: 'Tạo CV chuyên nghiệp chỉ trong 5 phút',
    sub: 'Mẫu CV đẹp, chuẩn nhà tuyển dụng, tải về PDF ngay',
    bg: 'linear-gradient(120deg,#fdeede 0%,#f9e0ea 100%)',
    fg: '#5a340c', accent: '#c9678f',
  },
  {
    kicker: 'Dành cho nhà tuyển dụng',
    title: 'Đăng tin & tiếp cận 5 triệu ứng viên',
    sub: 'Tối ưu chi phí tuyển dụng với Sunflower for Business',
    bg: 'linear-gradient(120deg,#1f7a68 0%,#2fa088 100%)',
    fg: '#ffffff', accent: '#f7c948',
  },
];

// Ngành nghề nổi bật (marketing — dữ liệu mẫu theo thiết kế).
const CAT_RAW = [
  ['Kinh doanh / Bán hàng', '12.540'], ['IT - Phần mềm', '8.312'],
  ['Marketing / Truyền thông', '6.108'], ['Kế toán / Kiểm toán', '4.756'],
  ['Nhân sự', '3.290'], ['Hành chính / Văn phòng', '5.877'],
  ['Xây dựng', '2.945'], ['Chăm sóc khách hàng', '4.021'],
];
export const CATEGORIES = CAT_RAW.map(([name, count], i) => ({
  key: 'c' + i,
  name,
  count,
  mono: mono(name.replace(/[/-]/g, ' ')),
  color: pickColor(i),
}));

export const FOOTER_COLS = [
  { title: 'Về Sunflower', links: ['Giới thiệu', 'Tuyển dụng nội bộ', 'Liên hệ', 'Báo chí'] },
  { title: 'Dành cho ứng viên', links: ['Tìm việc làm', 'Tạo CV online', 'Tính lương Gross - Net', 'Trắc nghiệm nghề nghiệp'] },
  { title: 'Nhà tuyển dụng', links: ['Đăng tin tuyển dụng', 'Tìm kiếm hồ sơ', 'Báo giá dịch vụ', 'Hỗ trợ khách hàng'] },
];

// --- Dữ liệu mẫu dự phòng khi chưa có công ty thật đang tuyển ---
const MOCK_JOB_RAW = [
  { id: 'j1', title: 'Nhân viên Kinh doanh B2B', company: 'Công ty CP Giải pháp Số Việt', salary: '12 – 18 triệu', location: 'Hà Nội', tag: 'Toàn thời gian' },
  { id: 'j2', title: 'Lập trình viên Frontend (ReactJS)', company: 'FTech Solutions', salary: '20 – 35 triệu', location: 'Hà Nội', tag: 'Hybrid' },
  { id: 'j3', title: 'Trưởng nhóm Marketing', company: 'Mỹ phẩm Hoa Sen', salary: '18 – 25 triệu', location: 'TP.HCM', tag: 'Kinh nghiệm 3 năm' },
  { id: 'j4', title: 'Kế toán tổng hợp', company: 'Sunflower Retail', salary: '10 – 14 triệu', location: 'TP.HCM', tag: 'Toàn thời gian' },
  { id: 'j5', title: 'Chuyên viên Tuyển dụng', company: 'Nhân Lực Á Châu', salary: '11 – 15 triệu', location: 'Đà Nẵng', tag: 'Toàn thời gian' },
  { id: 'j6', title: 'Designer UI/UX', company: 'Studio Ánh Dương', salary: '15 – 22 triệu', location: 'Làm từ xa', tag: 'Remote' },
  { id: 'j7', title: 'Kỹ sư QA/QC', company: 'Cơ khí Miền Nam', salary: '14 – 20 triệu', location: 'Bình Dương', tag: 'Đi làm ngay' },
  { id: 'j8', title: 'Nhân viên Chăm sóc khách hàng', company: 'Bảo hiểm An Phát', salary: '9 – 12 triệu', location: 'Hà Nội', tag: 'Ca xoay' },
  { id: 'j9', title: 'Giám sát bán hàng khu vực', company: 'NGK Đại Việt', salary: '15 – 20 triệu', location: 'Cần Thơ', tag: 'Có thưởng KPI' },
];
export const MOCK_JOBS = MOCK_JOB_RAW.map((j, i) => ({
  ...j, mono: mono(j.company), color: pickColor(i), real: false,
}));

const MOCK_CO_RAW = [
  ['Sunflower Retail', '24'], ['FTech Solutions', '18'], ['Ngân hàng Đông Đô', '31'],
  ['Tập đoàn Hoa Sen', '12'], ['Logistics Sao Mai', '9'],
];
export const MOCK_COMPANIES = MOCK_CO_RAW.map(([name, count], i) => ({
  key: 'k' + i, name, subtitle: count + ' vị trí đang tuyển',
  mono: mono(name), color: pickColor(i + 2), real: false,
}));

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
