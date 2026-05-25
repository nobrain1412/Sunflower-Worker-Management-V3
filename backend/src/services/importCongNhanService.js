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
  const ws = wb.worksheets[0];
  if (!ws) {
    const err = new Error('File Excel rỗng (không có sheet dữ liệu nào). Vui lòng kiểm tra lại file.');
    err.statusCode = 400; err.code = 'EMPTY_WORKBOOK';
    throw err;
  }

  // Đọc header row (luôn là row 1)
  const headerRow = ws.getRow(1);
  const colMap = {}; // colIndex → fieldName
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = normalizeHeader(cell.value);
    const field = HEADER_MAP[key];
    if (field) colMap[colNumber] = field;
  });

  if (!Object.values(colMap).includes('ho_ten')) {
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
    if (data.cccd) data.cccd = normalizeCccd(data.cccd);
    if (data.so_dien_thoai) data.so_dien_thoai = normalizePhone(data.so_dien_thoai);
    if (data.ngay_sinh) data.ngay_sinh = parseDate(data.ngay_sinh);
    if (data.ngay_vao_lam) data.ngay_vao_lam = parseDate(data.ngay_vao_lam);

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
  // Row mẫu để user tham khảo format
  ws.addRow({
    ma_van_tay: '3002645',
    ngay_vao:   '2023-12-19',
    ho_ten:     'Trần Văn Phúc',
    ngay_sinh:  '16/2/2003',
    cccd:       '035203001364',
    que_quan:   'Thanh Hương, Thanh Liêm, Hà Nam',
    sdt:        '0914443321',
    vender:     'Thuý VT',
    cong_ty:    'Tên công ty (phải khớp DB)',
    ghi_chu:    'Ví dụ — xoá dòng này trước khi import',
  });
  ws.getRow(2).font = { italic: true, color: { argb: 'FF888888' } };

  return wb.xlsx.writeBuffer();
}

module.exports = {
  parseExcel, resolveAndValidate, commitImport, buildTemplate, rebuildRowsFromPayload,
};
