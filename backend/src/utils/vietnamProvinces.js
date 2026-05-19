/**
 * Danh sách 63 tỉnh/thành Việt Nam — tên chính thức khớp với
 * https://provinces.open-api.vn/api/ (mà ProvinceSelect FE dùng).
 *
 * Dùng để chuẩn hoá `que_quan` khi import Excel: tránh tình trạng
 * Excel viết "Hà nam" / "BÌnh" / thiếu dấu → filter Tỉnh không bắt được.
 */

const PROVINCES = [
  'An Giang', 'Bà Rịa - Vũng Tàu', 'Bạc Liêu', 'Bắc Giang', 'Bắc Kạn',
  'Bắc Ninh', 'Bến Tre', 'Bình Dương', 'Bình Định', 'Bình Phước',
  'Bình Thuận', 'Cà Mau', 'Cao Bằng', 'Cần Thơ', 'Đà Nẵng',
  'Đắk Lắk', 'Đắk Nông', 'Điện Biên', 'Đồng Nai', 'Đồng Tháp',
  'Gia Lai', 'Hà Giang', 'Hà Nam', 'Hà Nội', 'Hà Tĩnh',
  'Hải Dương', 'Hải Phòng', 'Hậu Giang', 'Hòa Bình', 'Hưng Yên',
  'Khánh Hòa', 'Kiên Giang', 'Kon Tum', 'Lai Châu', 'Lạng Sơn',
  'Lào Cai', 'Lâm Đồng', 'Long An', 'Nam Định', 'Nghệ An',
  'Ninh Bình', 'Ninh Thuận', 'Phú Thọ', 'Phú Yên', 'Quảng Bình',
  'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sóc Trăng',
  'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên', 'Thanh Hóa',
  'Thừa Thiên Huế', 'Tiền Giang', 'TP Hồ Chí Minh', 'Trà Vinh', 'Tuyên Quang',
  'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái',
];

// Alias cho các cách viết phổ biến → tên chuẩn
const ALIASES = {
  'sai gon':              'TP Hồ Chí Minh',
  'tphcm':                'TP Hồ Chí Minh',
  'tp hcm':               'TP Hồ Chí Minh',
  'tp ho chi minh':       'TP Hồ Chí Minh',
  'ho chi minh':          'TP Hồ Chí Minh',
  'thanh pho ho chi minh':'TP Hồ Chí Minh',
  'ha noi':               'Hà Nội',
  'tp ha noi':            'Hà Nội',
  'thanh pho ha noi':     'Hà Nội',
  'da nang':              'Đà Nẵng',
  'tp da nang':           'Đà Nẵng',
  'thua thien hue':       'Thừa Thiên Huế',
  'tt hue':               'Thừa Thiên Huế',
  'hue':                  'Thừa Thiên Huế',
  'ba ria vung tau':      'Bà Rịa - Vũng Tàu',
  'ba ria - vung tau':    'Bà Rịa - Vũng Tàu',
  'vung tau':             'Bà Rịa - Vũng Tàu',
};

// Strip dấu + lowercase + bỏ ký tự không alphanumeric
function normalize(s) {
  if (s == null) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Map normalized name → official name (chỉ build 1 lần khi require)
const NORMALIZED_MAP = new Map();
for (const p of PROVINCES) NORMALIZED_MAP.set(normalize(p), p);
for (const [alias, official] of Object.entries(ALIASES)) {
  NORMALIZED_MAP.set(normalize(alias), official);
}

/**
 * Tìm tên tỉnh chính thức từ chuỗi tự do.
 * @param {string} raw - vd "Hà nam", "BÌnh", "TPHCM", "Tp. Hồ Chí Minh"
 * @returns {string|null} - tên chính thức (vd "Hà Nam") hoặc null nếu không match
 */
function matchProvince(raw) {
  if (!raw) return null;
  const norm = normalize(raw);
  if (!norm) return null;
  return NORMALIZED_MAP.get(norm) ?? null;
}

/**
 * Chuẩn hoá chuỗi que_quan từ Excel.
 * Logic: tách phần cuối sau dấu ',' cuối làm candidate tỉnh.
 * Nếu match → thay phần đó bằng tên chính thức.
 *
 * @returns { normalized, originalTinh, matchedTinh }
 *   - normalized: chuỗi mới (đã sửa nếu match)
 *   - originalTinh: phần text gốc dùng làm candidate
 *   - matchedTinh: tên chính thức nếu match, null nếu không
 */
function normalizeQueQuan(raw) {
  if (!raw) return { normalized: raw, originalTinh: null, matchedTinh: null };

  const s = String(raw).trim();
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { normalized: s, originalTinh: null, matchedTinh: null };

  // Candidate là phần cuối cùng
  const candidate = parts[parts.length - 1];
  const matched = matchProvince(candidate);

  if (matched) {
    parts[parts.length - 1] = matched;
    return { normalized: parts.join(', '), originalTinh: candidate, matchedTinh: matched };
  }

  // Không match candidate cuối → thử match toàn chuỗi (vd Excel chỉ ghi "Hà Nam")
  if (parts.length === 1) {
    const matchedWhole = matchProvince(s);
    if (matchedWhole) {
      return { normalized: matchedWhole, originalTinh: s, matchedTinh: matchedWhole };
    }
  }

  return { normalized: s, originalTinh: candidate, matchedTinh: null };
}

module.exports = {
  PROVINCES,
  matchProvince,
  normalizeQueQuan,
};
