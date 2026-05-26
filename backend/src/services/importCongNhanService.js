/**
 * Parse + validate file Excel danh sách công nhân để bulk import.
 *
 * Cột Excel hỗ trợ (header tiếng Việt, case-insensitive, có thể bỏ dấu):
 *   - Họ tên / Họ và tên       → ho_ten        (BẮT BUỘC)
 *   - CCCD / CMT / Căn cước    → cccd          (12 số, dedup key)
 *   - Ngày sinh / Ngày tháng năm sinh → ngay_sinh
 *   - Ngày vào / Ngày vào làm  → ngay_vao_lam
 *   - Địa chỉ / Quê quán       → que_quan
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
  'dia chi':                 'que_quan',
  'que quan':                'que_quan',
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
  { field: 'que_quan',       keywords: ['que quan', 'dia chi', 'noi o', 'thuong tru', 'address', 'que'] },
  { field: 'ma_van_tay',     keywords: ['ma van tay', 'van tay', 'ma vt', 'ma cham cong', 'fingerprint'] },
  { field: '__cong_ty_name', keywords: ['cong ty', 'doanh nghiep', 'cty', 'company'] },
  { field: 'ghi_chu',        keywords: ['ghi chu', 'bo phan', 'note', 'remark', 'chu thich'] },
];

const CCCD_REGEX = /^\d{12}$/;
const SDT_REGEX  = /^(0[3578]\d{8}|0[6789]\d{8})$/;

function normalizeHeader(raw) {
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

function cleanCell(value) {
  if (value == null) return null;
  if (typeof value === 'object' && 'text' in value) value = value.text;     // rich text
  if (typeof value === 'object' && 'result' in value) value = value.result; // formula
  if (value instanceof Date) return value;
  const s = String(value).trim();
  if (!s || s === '#N/A' || s === '#REF!' || s === '#VALUE!') return null;
  return s;
}

// Parse date từ nhiều format: Date (Excel), 'YYYY-MM-DD', 'DD/MM/YYYY', 'D/M/YYYY'
function parseDate(raw) {
  if (raw == null) return null;
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  if (!s) return null;
  // ISO YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // DD/MM/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // DD-MM-YYYY
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

function normalizeCccd(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/\D/g, '');
  return s || null;
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

    // Normalize từng field
    if (data.ho_ten) data.ho_ten = toTitleCaseVN(data.ho_ten);
    if (data.cccd) data.cccd = normalizeCccd(data.cccd);
    if (data.so_dien_thoai) data.so_dien_thoai = normalizePhone(data.so_dien_thoai);
    if (data.ngay_sinh) data.ngay_sinh = parseDate(data.ngay_sinh);
    if (data.ngay_vao_lam) data.ngay_vao_lam = parseDate(data.ngay_vao_lam);
    if (data.que_quan) data.que_quan = toTitleCaseVN(data.que_quan);

    // Chuẩn hoá tỉnh trong que_quan → đảm bảo filter "Tỉnh" bắt được
    const warnings = [];
    if (data.que_quan) {
      const { normalized, originalTinh, matchedTinh } = normalizeQueQuan(data.que_quan);
      data.que_quan = normalized;
      if (matchedTinh && originalTinh && originalTinh !== matchedTinh) {
        warnings.push(`Tỉnh: "${originalTinh}" → chuẩn hoá thành "${matchedTinh}"`);
      } else if (!matchedTinh) {
        warnings.push(`Không nhận diện được tỉnh trong "${data.que_quan}" → filter Tỉnh có thể không hoạt động`);
      }
    }

    rows.push({
      rowNumber: r,
      data,
      _venderName: venderName,
      _congTyName: congTyName,
      errors: [],
      warnings,
    });
  }

  return rows;
}

/**
 * Validate + resolve vender_name/cong_ty_name sang ID + check CCCD trùng.
 * Mutates rows in place (append errors/warnings + set nguoi_tuyen_id, cong_ty_id).
 */
async function resolveAndValidate(rows) {
  // Gom unique vender + cong_ty names để query 1 lần
  const venderNames = [...new Set(rows.map((r) => r._venderName).filter(Boolean))];
  const congTyNames = [...new Set(rows.map((r) => r._congTyName).filter(Boolean))];
  const cccds       = [...new Set(rows.map((r) => r.data.cccd).filter(Boolean))];

  // Resolve vender: khớp theo HỌ TÊN hoặc MÃ VENDER (đều case-insensitive).
  // → giải quyết lỗi import không nhận diện được vender khi file ghi mã thay vì tên.
  const venderMap = new Map();
  if (venderNames.length > 0) {
    const lowered = venderNames.map((n) => n.toLowerCase());
    const { rows: vRows } = await db.query(
      `SELECT id, ho_ten, ma_vender FROM users
        WHERE active = TRUE
          AND (LOWER(ho_ten) = ANY($1::text[]) OR LOWER(ma_vender) = ANY($1::text[]))`,
      [lowered],
    );
    for (const v of vRows) {
      if (v.ho_ten) venderMap.set(v.ho_ten.toLowerCase(), v.id);
      if (v.ma_vender) venderMap.set(v.ma_vender.toLowerCase(), v.id);
    }
  }

  // Resolve cong_ty
  const congTyMap = new Map();
  if (congTyNames.length > 0) {
    const { rows: ctRows } = await db.query(
      `SELECT id, ten_cong_ty FROM cong_ty WHERE LOWER(ten_cong_ty) = ANY($1::text[])`,
      [congTyNames.map((n) => n.toLowerCase())],
    );
    for (const c of ctRows) congTyMap.set(c.ten_cong_ty.toLowerCase(), c.id);
  }

  // Check CCCD đã tồn tại
  const existingCccds = new Set();
  if (cccds.length > 0) {
    const { rows: eRows } = await db.query(
      `SELECT cccd FROM cong_nhan WHERE cccd = ANY($1::text[]) AND deleted_at IS NULL`,
      [cccds],
    );
    for (const e of eRows) existingCccds.add(e.cccd);
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
      } else if (existingCccds.has(d.cccd)) {
        r.warnings.push(`CCCD đã tồn tại trong DB → sẽ skip`);
        r.skip = true;
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
      const id = venderMap.get(r._venderName.toLowerCase());
      if (id) {
        d.nguoi_tuyen_id = id;
      } else {
        r.errors.push(`Vender "${r._venderName}" không tìm thấy trong danh sách users`);
      }
    }

    // Resolve cong_ty
    if (r._congTyName) {
      const id = congTyMap.get(r._congTyName.toLowerCase());
      if (id) {
        d.cong_ty_id = id;
      } else {
        r.errors.push(`Công ty "${r._congTyName}" không tìm thấy trong DB`);
      }
    }
  }

  return rows;
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
    if (data.que_quan) data.que_quan = toTitleCaseVN(data.que_quan);
    if (data.cccd) data.cccd = normalizeCccd(data.cccd);
    if (data.so_dien_thoai) data.so_dien_thoai = normalizePhone(data.so_dien_thoai);
    if (data.ngay_sinh) data.ngay_sinh = parseDate(data.ngay_sinh) ?? data.ngay_sinh;
    if (data.ngay_vao_lam) data.ngay_vao_lam = parseDate(data.ngay_vao_lam) ?? data.ngay_vao_lam;
    return {
      rowNumber: r.rowNumber ?? i + 2,
      data,
      _venderName: r.vender_name || null,
      _congTyName: r.cong_ty_name || null,
      errors: [],
      warnings: [],
    };
  });
}

/**
 * Insert thực sự vào DB. Trả về { inserted, skipped, errors }.
 */
async function commitImport(rows, createdBy) {
  const toInsert = rows.filter((r) => r.errors.length === 0 && !r.skip);
  let inserted = 0;
  const failed = [];

  await db.query('BEGIN');
  try {
    for (const r of toInsert) {
      const d = r.data;
      try {
        await db.query(
          `INSERT INTO cong_nhan
             (ho_ten, cccd, ngay_sinh, que_quan, so_dien_thoai,
              ngay_vao_lam, ma_van_tay, ghi_chu,
              nguoi_tuyen_id, cong_ty_id, trang_thai)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'moi_vao')`,
          [
            d.ho_ten,
            d.cccd ?? null,
            d.ngay_sinh ?? null,
            d.que_quan ?? null,
            d.so_dien_thoai ?? null,
            d.ngay_vao_lam ?? null,
            d.ma_van_tay ?? null,
            d.ghi_chu ?? null,
            d.nguoi_tuyen_id ?? null,
            d.cong_ty_id ?? null,
          ],
        );
        inserted++;
      } catch (err) {
        failed.push({ rowNumber: r.rowNumber, message: err.message });
      }
    }
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }

  // Log activity (audit). Bọc try để không fail flow chính nếu schema chưa khớp.
  if (createdBy && inserted > 0) {
    try {
      await db.query(
        `INSERT INTO hoat_dong_log (loai, du_lieu, ghi_chu, created_by, muc_do)
         VALUES ('import_excel', $1::jsonb, $2, $3, 'quan_trong')`,
        [
          JSON.stringify({ inserted, total: rows.length, skipped: rows.filter((r) => r.skip).length }),
          `Import ${inserted}/${rows.length} công nhân từ Excel`,
          createdBy,
        ],
      );
    } catch {}
  }

  return {
    inserted,
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
    { header: 'Địa chỉ',     key: 'que_quan',   width: 36 },
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
    ['Công ty',    'Không',  'Tên công ty — phải KHỚP với tên đã có trong hệ thống (không phân biệt hoa/thường).', 'Tên công ty (phải khớp DB)'],
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
