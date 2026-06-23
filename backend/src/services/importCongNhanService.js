/**
 * Parse + validate file Excel danh sách công nhân để bulk import.
 *
 * Cột Excel hỗ trợ (header tiếng Việt, case-insensitive, có thể bỏ dấu):
 *   - Họ tên / Họ và tên       → ho_ten        (BẮT BUỘC)
 *   - CCCD / CMT / Căn cước    → cccd          (12 số, dedup key)
 *   - Ngày sinh / Ngày tháng năm sinh → ngay_sinh
 *   - Ngày vào / Ngày vào làm  → ngay_vao_lam
 *   - Địa chỉ / Quê quán       → dia_chi_hien_tai
 *   - SĐT / Số điện thoại      → so_dien_thoai
 *   - Mã vân tay               → ma_van_tay
 *   - Vender / Người tuyển     → resolve theo ho_ten của users
 *   - Công ty                  → resolve theo ten_cong_ty
 *   - Bộ phận / Ghi chú        → ghi_chu
 */
const ExcelJS = require('exceljs');
const db = require('../utils/db');
const { normalizeQueQuan } = require('../utils/vietnamProvinces');

// Tên cột → field DB. Header được normalize (lowercase, bỏ dấu, bỏ space dư).
const HEADER_MAP = {
  'ho ten':                  'ho_ten',
  'ho va ten':               'ho_ten',
  'cccd':                    'cccd',
  'cmt':                     'cccd',
  'cmnd':                    'cccd',
  'can cuoc':                'cccd',
  'cmt can cuoc':            'cccd',
  'cmt/can cuoc':            'cccd',
  'so cccd':                 'cccd',
  'ngay sinh':               'ngay_sinh',
  'ngay thang nam sinh':     'ngay_sinh',
  'ngay vao':                'ngay_vao_lam',
  'ngay vao lam':            'ngay_vao_lam',
  'dia chi':                 'dia_chi_hien_tai',
  'que quan':                'dia_chi_hien_tai',
  'sdt':                     'so_dien_thoai',
  'so dien thoai':           'so_dien_thoai',
  'dien thoai':              'so_dien_thoai',
  'ma van tay':              'ma_van_tay',
  'vender':                  '__vender_name',
  'nguoi tuyen':             '__vender_name',
  'ma vender':               '__vender_name',
  'ma vd':                   '__vender_name',
  'cong ty':                 '__cong_ty_name',
  'bo phan':                 'ghi_chu',
  'ghi chu':                 'ghi_chu',
};

// Fallback khi header không khớp HEADER_MAP chính xác:
// mỗi field gắn 1 list từ khoá, header chứa từ khoá nào thì map vào field đó.
// Thứ tự quan trọng — field đặt trước được ưu tiên khi header dính nhiều từ khoá.
// `keywords`: khớp nếu header CHỨA từ khoá. `exact`: chỉ khớp khi header BẰNG đúng
// (dùng cho token ngắn dễ đụng như "ten" — tránh "ten vender" bị nhận nhầm là họ tên).
const HEADER_FUZZY = [
  { field: 'cccd',           keywords: ['cccd', 'cmnd', 'cmt', 'can cuoc', 'so cmt', 'identity'] },
  { field: 'ngay_sinh',      keywords: ['ngay sinh', 'sinh', 'birth', 'dob'] },
  { field: 'ngay_vao_lam',   keywords: ['ngay vao', 'vao lam', 'ngay bat dau', 'start date', 'onboard'] },
  { field: '__vender_name',  keywords: ['vender', 'vendor', 'nguoi tuyen', 'ma vd'] },
  { field: 'ho_ten',         keywords: ['ho ten', 'ho va ten', 'hoten', 'ten cong nhan', 'ten nhan vien', 'ten nv', 'full name', 'fullname'], exact: ['ten'] },
  { field: 'so_dien_thoai',  keywords: ['so dien thoai', 'dien thoai', 'sdt', 'so dt', 'phone', 'mobile', 'lien he'] },
  { field: 'dia_chi_hien_tai',       keywords: ['que quan', 'dia chi', 'noi o', 'thuong tru', 'address', 'que'] },
  { field: 'ma_van_tay',     keywords: ['ma van tay', 'van tay', 'ma vt', 'ma cham cong', 'fingerprint'] },
  { field: '__cong_ty_name', keywords: ['cong ty', 'doanh nghiep', 'cty', 'company'] },
  { field: 'ghi_chu',        keywords: ['ghi chu', 'bo phan', 'note', 'remark', 'chu thich'] },
];

const CCCD_REGEX = /^\d{12}$/;
const SDT_REGEX  = /^(0[3578]\d{8}|0[6789]\d{8})$/;

function normalizeHeader(raw) {
  raw = extractText(raw); // header cũng có thể là rich text / object ExcelJS
  if (raw == null) return '';
  return String(raw)
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '') // bỏ dấu tiếng Việt
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Resolve 1 header (đã normalize) → field DB.
// Ưu tiên khớp chính xác trong HEADER_MAP, sau đó fallback theo từ khoá
// để nhận được cả header viết tắt / thêm chữ thừa / sai chính tả nhẹ.
function resolveHeaderField(normalized) {
  if (!normalized) return null;
  if (HEADER_MAP[normalized]) return HEADER_MAP[normalized];
  for (const { field, keywords, exact } of HEADER_FUZZY) {
    if (exact && exact.includes(normalized)) return field;
    if (keywords.some((kw) => normalized.includes(kw))) return field;
  }
  return null;
}

// Chuẩn hoá danh từ riêng (họ tên, quê quán) về Title Case bất kể input
// viết HOA hết / thường hết / lẫn lộn. Hỗ trợ ký tự tiếng Việt có dấu.
// vd: "TRẦN VĂN PHÚC" / "trần văn phúc" → "Trần Văn Phúc"
function toTitleCaseVN(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/\s+/g, ' ');
  if (!s) return null;
  return s
    .toLowerCase()
    .replace(/(^|[\s\-/().,])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase());
}

// Trích text thuần từ giá trị ô ExcelJS. Ô có thể là object ở nhiều dạng:
//   - rich text:  { richText: [{ text }, ...] }   ← hay gặp khi copy-paste từ Word
//   - hyperlink:  { text, hyperlink }
//   - công thức:  { formula, result }  (result lại có thể là rich text → đệ quy)
//   - lỗi:        { error: '#N/A' }
// Các object này nếu để String() sẽ ra "[object Object]" → phải bóc text trước.
function extractText(value) {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value.richText)) return value.richText.map((p) => p?.text ?? '').join('');
  if ('result' in value) return extractText(value.result); // công thức → đọc kết quả
  if ('text' in value)   return extractText(value.text);   // hyperlink (text có thể lại là rich text)
  if ('error' in value)  return null;                      // ô lỗi #N/A, #REF!...
  return null; // object lạ → coi như rỗng thay vì "[object Object]"
}

function cleanCell(value) {
  value = extractText(value);
  if (value == null) return null;
  if (value instanceof Date) return value;
  const s = String(value).trim();
  if (!s || s === '#N/A' || s === '#REF!' || s === '#VALUE!') return null;
  return s;
}

// Ghép YYYY-MM-DD đã pad + kiểm tra hợp lệ (tháng 1-12, ngày 1-31). Sai → null.
function buildISO(y, mo, d) {
  const Y = Number(y), M = Number(mo), D = Number(d);
  if (M < 1 || M > 12 || D < 1 || D > 31) return null;
  return `${Y}-${String(M).padStart(2, '0')}-${String(D).padStart(2, '0')}`;
}

// Parse date từ nhiều format → luôn trả ISO 'YYYY-MM-DD' (chuẩn, không nhập nhằng).
// Chuẩn ưu tiên: dd/mm/yyyy. Nhưng tự nhận diện nếu file lỡ ở dạng mm/dd/yyyy:
//   - phần đầu > 12  → chắc chắn là NGÀY  → dd/mm
//   - phần sau  > 12 → chắc chắn là NGÀY → mm/dd (đảo lại)
//   - cả hai <= 12   → không chắc → theo chuẩn dd/mm
function parseDayMonth(a, b, y) {
  const A = Number(a), B = Number(b);
  let day, mo;
  if (A > 12 && B <= 12) { day = A; mo = B; }       // dd/mm rõ ràng
  else if (B > 12 && A <= 12) { day = B; mo = A; }  // mm/dd → đảo về dd/mm
  else { day = A; mo = B; }                          // cả hai <=12 → giả định dd/mm
  return buildISO(y, mo, day);
}

function parseDate(raw) {
  if (raw == null) return null;
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    // Excel lưu ngày ở UTC nửa đêm → dùng phần UTC để tránh lệch múi giờ (-1 ngày)
    return `${raw.getUTCFullYear()}-${String(raw.getUTCMonth() + 1).padStart(2, '0')}-${String(raw.getUTCDate()).padStart(2, '0')}`;
  }
  const s = String(raw).trim();
  if (!s) return null;
  // ISO YYYY-MM-DD (không nhập nhằng)
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return buildISO(m[1], m[2], m[3]);
  // X/Y/YYYY hoặc X-Y-YYYY (dd/mm hoặc mm/dd — tự nhận diện)
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return parseDayMonth(m[1], m[2], m[3]);
  return null;
}

// ISO yyyy-mm-dd → dd/mm/yyyy (cho thông báo cảnh báo)
function isoToDmy(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso ?? '');
}

// Đảo ngày ↔ tháng của 1 ISO. Trả null nếu sau khi đảo không hợp lệ (vd ngày gốc > 12).
function swapDayMonth(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return buildISO(m[1], m[3], m[2]); // tháng mới = ngày cũ, ngày mới = tháng cũ
}

// Ngày vào / ngày sinh KHÔNG thể ở tương lai. Nếu iso > hôm nay → thử đảo ngày/tháng:
//   - đảo xong hợp lệ và <= hôm nay  → coi như bị ngược, tự sửa (swapped = true)
//   - không sửa được                → giữ nguyên, đánh dấu future = true để cảnh báo
function fixFutureDate(iso, todayISO) {
  if (!iso || iso <= todayISO) return { iso, swapped: false, future: false };
  const sw = swapDayMonth(iso);
  if (sw && sw <= todayISO) return { iso: sw, swapped: true, future: false };
  return { iso, swapped: false, future: true };
}

const DATE_FIELDS = [['ngay_sinh', 'Ngày sinh'], ['ngay_vao_lam', 'Ngày vào']];

// Ngưỡng: nếu >= 30% số dòng có ngày trong 1 cột bị lật (mm/dd) → coi cả cột là mm/dd.
const MMDD_COLUMN_THRESHOLD = 0.30;

// Phân tích sâu 1 ô ngày — phục vụ vừa xử lý per-row vừa thống kê cả cột.
// Trả:
//   hasValue        ô có dữ liệu không
//   invalid         không đọc được
//   iso0 / iso      ISO trước / sau khi sửa-tương-lai
//   futureSwapped   đã đảo ngày/tháng vì ở tương lai
//   future          ở tương lai nhưng không đảo được
//   reversed        đã/đáng bị lật so với cách đọc dd/mm (mm/dd chắc chắn, hoặc future-swap)
//   pendingAmbiguous còn nhập nhằng (cả 2 số <=12) chưa được quyết
function analyzeDate(raw, todayISO) {
  if (raw == null) return { hasValue: false };
  const goc = raw instanceof Date ? null : String(raw).trim();

  // Phân loại cặp số nếu là dạng chữ dd/mm hoặc mm/dd
  let mmddCertain = false, ambiguous = false;
  if (!(raw instanceof Date)) {
    const m = String(raw).trim().match(/^(\d{1,2})[/-](\d{1,2})[/-]\d{4}$/);
    if (m) {
      const A = +m[1], B = +m[2];
      if (B > 12 && A <= 12) mmddCertain = true;            // tháng>12 → chắc chắn mm/dd
      else if (A <= 12 && B <= 12 && A !== B) ambiguous = true;
    }
  }

  const iso0 = parseDate(raw); // đã tự đảo khi tháng>12
  if (iso0 == null) return { hasValue: true, goc, invalid: true };

  const fixed = fixFutureDate(iso0, todayISO);
  return {
    hasValue: true, goc, invalid: false,
    iso0, iso: fixed.iso,
    futureSwapped: fixed.swapped, future: fixed.future,
    reversed: mmddCertain || fixed.swapped,
    pendingAmbiguous: ambiguous && !fixed.swapped,
  };
}

function normalizeCccd(raw) {
  if (raw == null) return null;
  let s = String(raw).replace(/\D/g, '');
  if (!s) return null;
  // Excel lưu CCCD dạng SỐ sẽ cắt số 0 ở đầu. Mã tỉnh (3 số đầu) luôn 001–096,
  // tức CCCD chuẩn LUÔN bắt đầu bằng 0 → ô số sẽ mất 1–2 số đầu, còn 10–11 số.
  // CCCD đúng phải 12 số → bù 0 bên trái cho đủ 12.
  if (s.length === 10 || s.length === 11) s = s.padStart(12, '0');
  return s;
}

function normalizePhone(raw) {
  if (raw == null) return null;
  let s = String(raw).replace(/[\s.-]/g, '');
  // Excel hay strip số 0 đầu → thêm lại nếu thiếu
  if (s && !s.startsWith('0') && /^\d{9}$/.test(s)) s = '0' + s;
  return s || null;
}

/**
 * Parse buffer .xlsx → mảng row đã có đủ field DB.
 * Mỗi row có dạng:
 *   { rowNumber, data: { ho_ten, cccd, ... }, errors: [], warnings: [] }
 */
async function parseExcel(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  if (wb.worksheets.length === 0) {
    const err = new Error('File Excel rỗng (không có sheet dữ liệu nào). Vui lòng kiểm tra lại file.');
    err.statusCode = 400; err.code = 'EMPTY_WORKBOOK';
    throw err;
  }

  // Map cột cho 1 worksheet: colIndex → fieldName
  const buildColMap = (sheet) => {
    const map = {};
    sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const field = resolveHeaderField(normalizeHeader(cell.value));
      // Không ghi đè nếu field đã được map từ cột trước (tránh fuzzy match đụng nhau)
      if (field && !Object.values(map).includes(field)) map[colNumber] = field;
    });
    return map;
  };

  // Tự tìm sheet dữ liệu = sheet đầu tiên có cột "Họ tên".
  // → cho phép template kèm sheet "Hướng dẫn" mà không vỡ import, không phụ thuộc thứ tự sheet.
  let ws = null;
  let colMap = {};
  for (const sheet of wb.worksheets) {
    const map = buildColMap(sheet);
    if (Object.values(map).includes('ho_ten')) { ws = sheet; colMap = map; break; }
  }
  if (!ws) {
    const err = new Error(
      'File Excel thiếu cột "Họ tên". Dòng đầu tiên (header) bắt buộc có 1 cột tên là "Họ tên" hoặc "Họ và tên". '
      + 'Hãy tải file mẫu để đối chiếu đúng tên cột.',
    );
    err.statusCode = 400; err.code = 'MISSING_HO_TEN';
    throw err;
  }

  // Hôm nay (ISO) — dùng để phát hiện ngày ở tương lai. UTC ổn cho so sánh ngày.
  const todayISO = new Date().toISOString().slice(0, 10);
  // Thống kê mỗi cột ngày để quyết định cả cột có đang là mm/dd hay không
  const dateStats = { ngay_sinh: { total: 0, reversed: 0 }, ngay_vao_lam: { total: 0, reversed: 0 } };

  // Đọc data rows (từ row 2)
  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const excelRow = ws.getRow(r);
    if (!excelRow.hasValues) continue;

    const data = {};
    let venderName = null;
    let congTyName = null;

    for (const [colIdx, field] of Object.entries(colMap)) {
      const raw = cleanCell(excelRow.getCell(Number(colIdx)).value);
      if (raw == null) continue;
      if (field === '__vender_name') { venderName = raw; continue; }
      if (field === '__cong_ty_name') { congTyName = raw; continue; }
      data[field] = raw;
    }

    // Bỏ qua row trống
    if (!data.ho_ten && !data.cccd) continue;

    const warnings = [];

    // Normalize từng field
    if (data.ho_ten) data.ho_ten = toTitleCaseVN(data.ho_ten);
    if (data.cccd) {
      const cccdTruoc = String(data.cccd).replace(/\D/g, '');
      data.cccd = normalizeCccd(data.cccd);
      if (data.cccd && cccdTruoc.length < 12 && data.cccd.length === 12) {
        warnings.push(`CCCD "${cccdTruoc}" thiếu số 0 ở đầu (Excel lưu dạng số) → tự bù thành "${data.cccd}"`);
      }
    }
    if (data.so_dien_thoai) data.so_dien_thoai = normalizePhone(data.so_dien_thoai);
    // Ngày: parse per-row (tự đảo khi tháng>12 / ngày ở tương lai).
    // Phần nhập nhằng (cả 2 số <=12) tạm để dd/mm, quyết định sau theo thống kê cả cột.
    const dateMeta = {};
    for (const [field, nhan] of DATE_FIELDS) {
      if (data[field] == null) continue;
      const a = analyzeDate(data[field], todayISO);
      dateMeta[field] = a;
      data[field] = a.invalid ? null : a.iso;
      dateStats[field].total++;
      if (a.invalid) {
        if (a.goc) warnings.push(`${nhan} "${a.goc}" không đọc được → để trống, vui lòng nhập lại (dd/mm/yyyy)`);
        continue;
      }
      if (a.reversed) dateStats[field].reversed++;
      if (a.futureSwapped) {
        warnings.push(`${nhan} ${isoToDmy(a.iso0)} ở tương lai → tự sửa ngày/tháng thành ${isoToDmy(a.iso)}`);
      } else if (a.future) {
        warnings.push(`${nhan} ${isoToDmy(a.iso)} ở tương lai (sau hôm nay) — hãy kiểm tra lại`);
      }
      // dòng nhập nhằng: chưa cảnh báo ở đây — xử lý ở lượt thống kê cột bên dưới
    }
    if (data.dia_chi_hien_tai) data.dia_chi_hien_tai = toTitleCaseVN(data.dia_chi_hien_tai);

    // Chuẩn hoá tỉnh trong dia_chi_hien_tai → đảm bảo filter "Tỉnh" bắt được
    if (data.dia_chi_hien_tai) {
      const { normalized, originalTinh, matchedTinh } = normalizeQueQuan(data.dia_chi_hien_tai);
      data.dia_chi_hien_tai = normalized;
      if (matchedTinh && originalTinh && originalTinh !== matchedTinh) {
        warnings.push(`Tỉnh: "${originalTinh}" → chuẩn hoá thành "${matchedTinh}"`);
      } else if (!matchedTinh) {
        warnings.push(`Không nhận diện được tỉnh trong "${data.dia_chi_hien_tai}" → filter Tỉnh có thể không hoạt động`);
      }
    }

    rows.push({
      rowNumber: r,
      data,
      _venderName: venderName,
      _congTyName: congTyName,
      _dateMeta: dateMeta,
      errors: [],
      warnings,
    });
  }

  // ── Quyết định nhập nhằng theo từng CỘT ──────────────────────────────
  // Nếu >= 30% số dòng có ngày trong cột bị lật (mm/dd) → coi cả cột là mm/dd,
  // đổi nốt các dòng nhập nhằng (cả 2 số <=12) về dd/mm. Ngược lại chỉ cảnh báo.
  for (const [field, nhan] of DATE_FIELDS) {
    const st = dateStats[field];
    const columnIsMmdd = st.total > 0 && st.reversed / st.total >= MMDD_COLUMN_THRESHOLD;
    for (const r of rows) {
      const a = r._dateMeta?.[field];
      if (!a || !a.pendingAmbiguous || !a.iso) continue;
      if (columnIsMmdd) {
        const sw = swapDayMonth(a.iso);
        if (sw) {
          r.data[field] = sw;
          r.warnings.push(`Cột "${nhan}": ≥30% dòng đang ở dạng mm/dd → đổi dòng này ${isoToDmy(a.iso)} → ${isoToDmy(sw)} (dd/mm)`);
        } else {
          r.warnings.push(`${nhan} "${a.goc}" không rõ ngày/tháng — đã hiểu là ${isoToDmy(a.iso)}, hãy kiểm tra lại`);
        }
      } else {
        r.warnings.push(`${nhan} "${a.goc}" không rõ ngày/tháng — đã hiểu là ${isoToDmy(a.iso)}, hãy kiểm tra lại`);
      }
    }
  }

  // _dateMeta chỉ dùng nội bộ — bỏ trước khi trả ra ngoài
  for (const r of rows) delete r._dateMeta;

  return rows;
}

/**
 * Validate + resolve vender_name/cong_ty_name sang ID + check CCCD trùng.
 * Mutates rows in place (append errors/warnings + set nguoi_tuyen_id, cong_ty_id).
 */
// Chuẩn hoá tên (vender / công ty) để so khớp: bỏ NBSP, trim, gộp khoảng trắng, lower.
// Lý do: file Excel hay dính space dư ở đầu/cuối hoặc giữa các từ, hoặc NBSP ( )
// do copy-paste từ Word → so khớp `=` thẳng sẽ trượt dù mắt thường thấy giống hệt.
function normName(raw) {
  if (raw == null) return '';
  return String(raw).replace(/ /g, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
}

async function resolveAndValidate(rows) {
  // Gom unique vender + cong_ty names để query 1 lần
  const venderNames = [...new Set(rows.map((r) => r._venderName).filter(Boolean))];
  const congTyNames = [...new Set(rows.map((r) => r._congTyName).filter(Boolean))];
  const cccds       = [...new Set(rows.map((r) => r.data.cccd).filter(Boolean))];

  // Resolve vender: khớp theo HỌ TÊN hoặc MÃ VENDER (đều case-insensitive).
  // → giải quyết lỗi import không nhận diện được vender khi file ghi mã thay vì tên.
  const venderMap = new Map();   // token (ho_ten | ma_vender, normName) → user id
  const maVenderSet = new Set();  // các token là MÃ VENDER (duy nhất → luôn ưu tiên)
  const nameCount = new Map();    // normName(ho_ten) → số user trùng tên (phát hiện nhập nhằng)
  if (venderNames.length > 0) {
    // Lấy hết user active rồi so khớp ở JS theo normName — gọn hơn là viết REGEXP_REPLACE trong SQL.
    const { rows: vRows } = await db.query(
      `SELECT id, ho_ten, ma_vender FROM users WHERE active = TRUE`,
    );
    const inputKeys = new Set(venderNames.map(normName));
    for (const v of vRows) {
      const kMa  = v.ma_vender ? normName(v.ma_vender) : null;
      const kTen = v.ho_ten    ? normName(v.ho_ten)    : null;
      if (kMa && inputKeys.has(kMa)) {
        venderMap.set(kMa, v.id);
        maVenderSet.add(kMa);
      }
      if (kTen && inputKeys.has(kTen)) {
        nameCount.set(kTen, (nameCount.get(kTen) || 0) + 1);
        if (!venderMap.has(kTen)) venderMap.set(kTen, v.id);
      }
    }
  }

  // Resolve cong_ty — load all rồi match bằng normName để dung sai space/NBSP
  const congTyMap = new Map();
  if (congTyNames.length > 0) {
    const inputKeys = new Set(congTyNames.map(normName));
    const { rows: ctRows } = await db.query(
      `SELECT id, ten_cong_ty FROM cong_ty`,
    );
    for (const c of ctRows) {
      const k = normName(c.ten_cong_ty);
      if (inputKeys.has(k)) congTyMap.set(k, c.id);
    }
  }

  // Check CCCD đã tồn tại — lấy luôn hồ sơ hiện có để FE hiển thị + cho phép
  // cập nhật / đổi công ty. CCCD nay không còn unique nên 1 cccd có thể ứng nhiều
  // bản ghi → lấy bản ghi id nhỏ nhất (cũ nhất) làm "công nhân hiện có" đại diện.
  const existingByCccd = new Map(); // cccd → { id, ho_ten, ...field hiện tại, cong_ty_ten }
  if (cccds.length > 0) {
    const { rows: eRows } = await db.query(
      `SELECT cn.id, cn.ho_ten, cn.cccd, cn.ngay_sinh, cn.dia_chi_hien_tai, cn.so_dien_thoai,
              cn.ngay_vao_lam, cn.ma_van_tay, cn.ghi_chu, cn.nguoi_tuyen_id,
              cn.cong_ty_id, cn.trang_thai, ct.ten_cong_ty AS cong_ty_ten
         FROM cong_nhan cn
         LEFT JOIN cong_ty ct ON ct.id = cn.cong_ty_id
        WHERE cn.cccd = ANY($1::text[]) AND cn.deleted_at IS NULL
        ORDER BY cn.id`,
      [cccds],
    );
    for (const e of eRows) if (!existingByCccd.has(e.cccd)) existingByCccd.set(e.cccd, e);
  }

  // Cũng dedup trong chính file (CCCD trùng nhau trong file)
  const cccdInFile = new Map(); // cccd → first rowNumber

  for (const r of rows) {
    const d = r.data;

    // Required: ho_ten
    if (!d.ho_ten) r.errors.push('Thiếu họ tên');

    // CCCD: optional nhưng nếu có phải đúng 12 số
    if (d.cccd) {
      if (!CCCD_REGEX.test(d.cccd)) {
        r.errors.push(`CCCD "${d.cccd}" không hợp lệ (cần 12 số)`);
      } else if (existingByCccd.has(d.cccd)) {
        // Trùng CCCD trong DB → gắn hồ sơ hiện có, quyết định xử lý ở cuối vòng
        // (sau khi đã resolve công ty mới, vì hành động "đổi công ty" cần cong_ty_id).
        r.existing = existingByCccd.get(d.cccd);
        r._duplicate = true;
      } else if (cccdInFile.has(d.cccd)) {
        r.warnings.push(`CCCD trùng với dòng ${cccdInFile.get(d.cccd)} trong file → sẽ skip`);
        r.skip = true;
      } else {
        cccdInFile.set(d.cccd, r.rowNumber);
      }
    }

    // SDT format check (cảnh báo, không block)
    if (d.so_dien_thoai && !SDT_REGEX.test(d.so_dien_thoai)) {
      r.warnings.push(`SĐT "${d.so_dien_thoai}" có thể sai format`);
    }

    // Resolve vender
    if (r._venderName) {
      const key = normName(r._venderName);
      if (maVenderSet.has(key)) {
        // Khớp theo MÃ VENDER → luôn rõ ràng (mã là duy nhất)
        d.nguoi_tuyen_id = venderMap.get(key);
      } else if (venderMap.has(key)) {
        // Khớp theo HỌ TÊN → nếu nhiều user trùng tên thì không tự đoán, bắt nhập mã
        if ((nameCount.get(key) || 0) > 1) {
          r.errors.push(`Tên vender "${r._venderName}" trùng ${nameCount.get(key)} người — hãy nhập MÃ VENDER để chỉ định chính xác`);
        } else {
          d.nguoi_tuyen_id = venderMap.get(key);
        }
      } else {
        r.errors.push(`Vender "${r._venderName}" không tìm thấy trong danh sách users`);
      }
    }

    // Resolve cong_ty
    if (r._congTyName) {
      const id = congTyMap.get(normName(r._congTyName));
      if (id) {
        d.cong_ty_id = id;
      } else {
        r.errors.push(`Công ty "${r._congTyName}" không tìm thấy trong DB`);
      }
    }

    // Công ty BẮT BUỘC khi thêm mới (dòng không trùng CCCD → insert trạng thái "mới vào").
    // Dòng trùng CCCD xử lý theo hành động riêng (update / đổi công ty / thêm mới chờ duyệt).
    if (!r._duplicate && d.ho_ten && !d.cong_ty_id) {
      r.errors.push('Thiếu công ty — cột "Công ty" bắt buộc khi thêm mới công nhân');
    }

    // Dòng trùng CCCD: áp hành động người dùng chọn (mặc định = bỏ qua)
    if (r._duplicate) applyDuplicateAction(r);
  }

  return rows;
}

// Quyết định cách xử lý 1 dòng trùng CCCD theo r.action:
//   skip (mặc định) → bỏ qua, không import
//   update          → cập nhật công nhân hiện có (chỉ bổ sung ô đang trống)
//   doi_cong_ty     → báo nghỉ công ty cũ + gán công ty mới
//   them_moi        → thêm mới riêng biệt dù trùng CCCD → trạng thái "Chờ duyệt"
const DUP_ACTIONS = new Set(['skip', 'update', 'doi_cong_ty', 'them_moi']);
function applyDuplicateAction(r) {
  const ten = r.existing?.ho_ten || 'công nhân';
  const ctyCu = r.existing?.cong_ty_ten ?? '—';
  let action = r.action || 'skip';
  if (!DUP_ACTIONS.has(action)) action = 'skip';

  if (action === 'update') {
    r.warnings.push(`CCCD trùng "${ten}" → CẬP NHẬT hồ sơ hiện có (chỉ bổ sung ô đang trống)`);
  } else if (action === 'doi_cong_ty') {
    if (!r.data.cong_ty_id) {
      r.errors.push('Đổi công ty: cần nhập "Công ty" mới hợp lệ ở cột Công ty');
    } else if (r.existing && r.existing.cong_ty_id === r.data.cong_ty_id) {
      r.errors.push(`Công ty mới trùng công ty hiện tại (${ctyCu}) — không cần đổi`);
    } else {
      r.warnings.push(`CCCD trùng "${ten}" → báo nghỉ công ty cũ (${ctyCu}) và gán "${r._congTyName}"`);
    }
  } else if (action === 'them_moi') {
    r.warnings.push(`CCCD trùng "${ten}" → THÊM MỚI riêng biệt, trạng thái "Chờ duyệt" (cần admin duyệt)`);
  } else {
    r.skip = true;
    r.warnings.push(`CCCD đã tồn tại trong DB (${ten}) → mặc định BỎ QUA. Chọn hành động khác nếu muốn cập nhật / đổi công ty / thêm mới.`);
  }
}

/**
 * Dựng lại danh sách row từ payload do FE gửi (đã sửa tay ở màn hình preview)
 * về đúng shape nội bộ để resolveAndValidate xử lý lại.
 * payload row: { rowNumber, data:{...}, vender_name, cong_ty_name }
 */
function rebuildRowsFromPayload(payloadRows = []) {
  return payloadRows.map((r, i) => {
    const data = { ...(r.data || {}) };
    // Bỏ id resolve cũ để re-resolve theo tên/mã đã sửa
    delete data.nguoi_tuyen_id;
    delete data.cong_ty_id;
    // Normalize lại các field nhạy cảm
    if (data.ho_ten) data.ho_ten = toTitleCaseVN(data.ho_ten);
    if (data.dia_chi_hien_tai) data.dia_chi_hien_tai = toTitleCaseVN(data.dia_chi_hien_tai);
    if (data.cccd) data.cccd = normalizeCccd(data.cccd);
    if (data.so_dien_thoai) data.so_dien_thoai = normalizePhone(data.so_dien_thoai);
    if (data.ngay_sinh) data.ngay_sinh = parseDate(data.ngay_sinh) ?? data.ngay_sinh;
    if (data.ngay_vao_lam) data.ngay_vao_lam = parseDate(data.ngay_vao_lam) ?? data.ngay_vao_lam;
    return {
      rowNumber: r.rowNumber ?? i + 2,
      data,
      _venderName: r.vender_name || null,
      _congTyName: r.cong_ty_name || null,
      action: r.action || null, // hành động cho dòng trùng CCCD (skip/update/doi_cong_ty/them_moi)
      errors: [],
      warnings: [],
    };
  });
}

// ISO yyyy-mm-dd → ngày hôm trước (dùng cho mốc kết thúc công ty cũ khi đổi việc)
function prevDayISO(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

// Insert 1 công nhân mới với trạng thái cho trước. Trả id.
async function insertCongNhan(d, trangThai) {
  const ins = await db.query(
    `INSERT INTO cong_nhan
       (ho_ten, cccd, ngay_sinh, dia_chi_hien_tai, so_dien_thoai,
        ngay_vao_lam, ma_van_tay, ghi_chu,
        nguoi_tuyen_id, cong_ty_id, trang_thai)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      d.ho_ten, d.cccd ?? null, d.ngay_sinh ?? null, d.dia_chi_hien_tai ?? null,
      d.so_dien_thoai ?? null, d.ngay_vao_lam ?? null, d.ma_van_tay ?? null,
      d.ghi_chu ?? null, d.nguoi_tuyen_id ?? null, d.cong_ty_id ?? null, trangThai,
    ],
  );
  return ins.rows[0].id;
}

// Cập nhật công nhân hiện có nhưng CHỈ bổ sung các ô đang trống trong DB
// (COALESCE: field cũ có giá trị → giữ nguyên; đang NULL → lấy giá trị từ file).
// Không đụng cong_ty_id ở đây — việc gán công ty đi qua hành động "đổi công ty".
async function updateFillEmpty(id, d) {
  await db.query(
    `UPDATE cong_nhan SET
        ngay_sinh      = COALESCE(ngay_sinh, $2),
        dia_chi_hien_tai       = COALESCE(dia_chi_hien_tai, $3),
        so_dien_thoai  = COALESCE(so_dien_thoai, $4),
        ngay_vao_lam   = COALESCE(ngay_vao_lam, $5),
        ma_van_tay     = COALESCE(ma_van_tay, $6),
        ghi_chu        = COALESCE(ghi_chu, $7),
        nguoi_tuyen_id = COALESCE(nguoi_tuyen_id, $8)
      WHERE id = $1`,
    [
      id, d.ngay_sinh ?? null, d.dia_chi_hien_tai ?? null, d.so_dien_thoai ?? null,
      d.ngay_vao_lam ?? null, d.ma_van_tay ?? null, d.ghi_chu ?? null,
      d.nguoi_tuyen_id ?? null,
    ],
  );
}

/**
 * Ghi vào DB theo hành động từng dòng. Trả thống kê các loại xử lý.
 *   - dòng mới thường        → INSERT trạng thái 'moi_vao' + phan_cong
 *   - trùng + update         → bổ sung ô trống cho CN cũ
 *   - trùng + doi_cong_ty    → đóng phan_cong cũ + tạo phan_cong mới + đổi công ty hiện tại
 *   - trùng + them_moi       → INSERT trạng thái 'cho_duyet' (chờ admin duyệt)
 */
async function commitImport(rows, createdBy) {
  const toProcess = rows.filter((r) => r.errors.length === 0 && !r.skip);
  let inserted = 0, updated = 0, doiCongTy = 0, choDuyet = 0;
  const failed = [];
  const today = new Date().toISOString().slice(0, 10);

  await db.query('BEGIN');
  try {
    for (const r of toProcess) {
      const d = r.data;
      const action = r._duplicate ? (r.action || 'skip') : 'new';
      try {
        if (action === 'update') {
          await updateFillEmpty(r.existing.id, d);
          updated++;
        } else if (action === 'doi_cong_ty') {
          await updateFillEmpty(r.existing.id, d);
          const start = d.ngay_vao_lam || today;       // bắt đầu công ty mới
          const end = prevDayISO(start);                // công ty cũ kết thúc hôm trước
          // Đóng mọi phan_cong đang mở của CN này
          await db.query(
            `UPDATE phan_cong SET ngay_ket_thuc = $1
              WHERE cong_nhan_id = $2 AND ngay_ket_thuc IS NULL`,
            [end, r.existing.id],
          );
          // Tạo phan_cong mới ở công ty mới
          await db.query(
            `INSERT INTO phan_cong (cong_nhan_id, cong_ty_id, ngay_bat_dau)
             VALUES ($1, $2, $3)`,
            [r.existing.id, d.cong_ty_id, start],
          );
          // Cập nhật công ty hiện tại (denormalized); nếu đang nghỉ việc → cho đi làm lại
          await db.query(
            `UPDATE cong_nhan
                SET cong_ty_id = $1,
                    ngay_nghi_viec = NULL,
                    trang_thai = CASE WHEN trang_thai = 'nghi_viec' THEN 'dang_lam' ELSE trang_thai END
              WHERE id = $2`,
            [d.cong_ty_id, r.existing.id],
          );
          doiCongTy++;
        } else {
          // 'new' hoặc 'them_moi' (trùng CCCD → chờ duyệt)
          const trangThai = action === 'them_moi' ? 'cho_duyet' : 'moi_vao';
          const id = await insertCongNhan(d, trangThai);
          // Có công ty → tạo luôn phan_cong để CN hiện trong bảng công.
          if (d.cong_ty_id) {
            await db.query(
              `INSERT INTO phan_cong (cong_nhan_id, cong_ty_id, ngay_bat_dau)
               VALUES ($1, $2, $3)`,
              [id, d.cong_ty_id, d.ngay_vao_lam || today],
            );
          }
          if (action === 'them_moi') choDuyet++; else inserted++;
        }
      } catch (err) {
        failed.push({ rowNumber: r.rowNumber, message: err.message });
      }
    }
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }

  const tongXuLy = inserted + updated + doiCongTy + choDuyet;
  // Log activity (audit). Bọc try để không fail flow chính nếu schema chưa khớp.
  if (createdBy && tongXuLy > 0) {
    try {
      await db.query(
        `INSERT INTO hoat_dong_log (loai, du_lieu, ghi_chu, created_by, muc_do)
         VALUES ('import_excel', $1::jsonb, $2, $3, 'quan_trong')`,
        [
          JSON.stringify({ inserted, updated, doiCongTy, choDuyet, total: rows.length,
            skipped: rows.filter((r) => r.skip).length }),
          `Import Excel: thêm ${inserted}, cập nhật ${updated}, đổi công ty ${doiCongTy}, chờ duyệt ${choDuyet}`,
          createdBy,
        ],
      );
    } catch {}
  }

  return {
    inserted,
    updated,
    doiCongTy,
    choDuyet,
    skipped: rows.filter((r) => r.skip).length,
    errorRows: rows.filter((r) => r.errors.length > 0).length,
    failed,
  };
}

/**
 * Tạo file Excel template để user download.
 */
async function buildTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Công nhân');

  ws.columns = [
    { header: 'Mã vân tay',  key: 'ma_van_tay', width: 14 },
    { header: 'Ngày vào',    key: 'ngay_vao',   width: 14 },
    { header: 'Họ tên',      key: 'ho_ten',     width: 28 },
    { header: 'Ngày sinh',   key: 'ngay_sinh',  width: 14 },
    { header: 'CCCD',        key: 'cccd',       width: 16 },
    { header: 'Địa chỉ',     key: 'dia_chi_hien_tai',   width: 36 },
    { header: 'SĐT',         key: 'sdt',        width: 14 },
    { header: 'Vender',      key: 'vender',     width: 16 },
    { header: 'Công ty',     key: 'cong_ty',    width: 24 },
    { header: 'Ghi chú',     key: 'ghi_chu',    width: 24 },
  ];
  // Style header
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FF' },
  };
  ws.views = [{ state: 'frozen', ySplit: 1 }]; // ghim header khi cuộn

  // Ép CCCD (cột 5) + SĐT (cột 7) về định dạng Text ('@') để Excel KHÔNG cắt
  // số 0 ở đầu khi người dùng gõ (CCCD luôn bắt đầu bằng 0, SĐT cũng vậy).
  ws.getColumn(5).numFmt = '@';
  ws.getColumn(7).numFmt = '@';

  // Sheet dữ liệu chỉ có header — không có dòng mẫu cần xoá.
  // Mọi hướng dẫn + ví dụ nằm ở sheet "Hướng dẫn" bên dưới.

  // ── Sheet "Hướng dẫn" ──────────────────────────────────────────────
  const guide = wb.addWorksheet('Hướng dẫn');
  guide.columns = [
    { header: 'Cột',       key: 'cot',    width: 16 },
    { header: 'Bắt buộc',  key: 'bb',     width: 10 },
    { header: 'Mô tả / Định dạng chấp nhận',          key: 'mota', width: 56 },
    { header: 'Ví dụ',     key: 'vd',     width: 34 },
  ];
  guide.getRow(1).font = { bold: true };
  guide.getRow(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FF' },
  };

  const rows = [
    ['Họ tên',     'Có',     'Tên công nhân. Nhập sao cũng được (HOA/thường/lẫn lộn) — hệ thống tự chuẩn hoá về dạng "Trần Văn Phúc".', 'TRẦN VĂN PHÚC'],
    ['CCCD',       'Không',  'Đúng 12 số. Có thể nhập kèm khoảng trắng. Trùng CCCD trong DB hoặc trong file sẽ bị bỏ qua.', '035203001364'],
    ['Ngày sinh',  'Không',  'Chấp nhận: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY hoặc ô định dạng Ngày của Excel.', '16/2/2003'],
    ['Ngày vào',   'Không',  'Ngày vào làm. Cùng định dạng với Ngày sinh.', '2023-12-19'],
    ['Địa chỉ',    'Không',  'Quê quán. Tỉnh đặt ở CUỐI chuỗi, sau dấu phẩy. Hoa/thường/dấu không sao, nhưng tránh chữ thừa như "Tỉnh", "TP." và tránh sai chính tả để filter Tỉnh hoạt động đúng.', 'Thanh Hương, Thanh Liêm, Hà Nam'],
    ['SĐT',        'Không',  'Số điện thoại di động (10 số). Nếu Excel cắt mất số 0 đầu, hệ thống tự thêm lại.', '0914443321'],
    ['Mã vân tay', 'Không',  'Mã máy chấm công, nếu có.', '3002645'],
    ['Vender',     'Không',  'Người tuyển — nhập HỌ TÊN hoặc MÃ VENDER (khớp với danh sách users, không phân biệt hoa/thường).', 'Thuý VT'],
    ['Công ty',    'Có',     'BẮT BUỘC khi thêm mới. Tên công ty — phải KHỚP với tên đã có trong hệ thống (không phân biệt hoa/thường).', 'Tên công ty (phải khớp DB)'],
    ['Ghi chú',    'Không',  'Bộ phận / ghi chú tự do.', 'Tổ 2'],
  ];
  for (const r of rows) guide.addRow({ cot: r[0], bb: r[1], mota: r[2], vd: r[3] });
  guide.eachRow((row) => { row.alignment = { vertical: 'top', wrapText: true }; });

  // Ghi chú chung dưới bảng
  guide.addRow([]);
  const note = guide.addRow(['Lưu ý:', '', 'Header (dòng 1 của sheet "Công nhân") nhận diện linh hoạt: viết tắt / khác hoa thường / có dấu hay không đều được. Tên cột có thể đặt khác, miễn chứa từ khoá (vd "Số điện thoại", "SĐT liên hệ" đều nhận là SĐT). Chỉ cần KHÔNG đổi thứ tự dòng header ở dòng 1.', '']);
  note.font = { italic: true, color: { argb: 'FF555555' } };
  note.alignment = { vertical: 'top', wrapText: true };

  // ── Danh sách Vender (cột F-G của sheet Hướng dẫn) ─────────────────
  // Đổ mã + tên vender từ DB để người nhập tra cứu và làm nguồn cho dropdown.
  let venders = [];
  try {
    const { rows: vRows } = await db.query(
      `SELECT ho_ten, ma_vender FROM users
        WHERE active = TRUE AND ma_vender IS NOT NULL AND TRIM(ma_vender) <> ''
        ORDER BY ma_vender`,
    );
    venders = vRows;
  } catch {
    // Không lấy được danh sách → vẫn xuất template, chỉ thiếu dropdown
  }

  guide.getColumn(6).width = 18; // F: Mã vender
  guide.getColumn(7).width = 28; // G: Tên vender
  const vHeaderRow = 1;
  guide.getCell(vHeaderRow, 6).value = 'Mã vender';
  guide.getCell(vHeaderRow, 7).value = 'Tên vender';
  guide.getCell(vHeaderRow, 6).font = { bold: true };
  guide.getCell(vHeaderRow, 7).font = { bold: true };
  guide.getCell(vHeaderRow, 6).fill = guide.getCell(vHeaderRow, 7).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FF' },
  };
  venders.forEach((v, i) => {
    guide.getCell(i + 2, 6).value = v.ma_vender;
    guide.getCell(i + 2, 7).value = v.ho_ten || '';
  });

  // Dropdown cho cột Vender (cột H) ở sheet nhập liệu, tham chiếu cột F sheet Hướng dẫn.
  // showErrorMessage=false → vẫn cho gõ tay (hệ thống còn khớp theo họ tên/mã khác).
  if (venders.length > 0) {
    const lastRow = venders.length + 1; // F2..F{n+1}
    const listFormula = `'Hướng dẫn'!$F$2:$F$${lastRow}`;
    for (let r = 2; r <= 500; r++) {
      ws.getCell(r, 8).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [listFormula],
        showErrorMessage: false,
      };
    }
  }

  return wb.xlsx.writeBuffer();
}

module.exports = {
  parseExcel, resolveAndValidate, commitImport, buildTemplate, rebuildRowsFromPayload,
};
