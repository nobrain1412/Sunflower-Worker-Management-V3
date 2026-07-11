/**
 * Tra cứu bảng công vân tay theo tháng — lưu NGUYÊN file Excel dưới dạng JSON.
 *
 * Khác với importChamCongService (normalize từng dòng vào cham_cong), service này
 * giữ nguyên toàn bộ bảng vân tay (~15-20k dòng) làm 1 blob JSONB / (công ty, tháng).
 *
 * Quy tắc GHI ĐÈ: máy vân tay luôn xuất full cả tháng → mỗi lần upload thay TRỌN
 * dữ liệu tháng đó (UPSERT). Không merge từng dòng, không cần biết khoá dòng.
 * Bước preview cảnh báo nếu bản mới có vẻ THIẾU so với bản đang lưu (chống đè nhầm).
 */
const ExcelJS = require('exceljs');
const db = require('../utils/db');

function badRequest(message, code) {
  const e = new Error(message);
  e.statusCode = 400; e.code = code;
  return e;
}

// Chuẩn hoá chuỗi header/tên công ty: bỏ dấu, đ→d, lowercase, gộp khoảng trắng.
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

// Bỏ dấu + lowercase để so khớp tìm kiếm (mã thẻ / tên).
function normalizeSearch(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .trim();
}

// Bóc text thuần từ giá trị ô ExcelJS (rich text / hyperlink / công thức / lỗi).
function extractText(value) {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value.richText)) return value.richText.map((p) => p?.text ?? '').join('');
  if ('result' in value) return extractText(value.result);
  if ('text' in value)   return extractText(value.text);
  if ('error' in value)  return null;
  return null;
}

// JS Date → 'YYYY-MM-DD' dùng UTC parts (ExcelJS trả date theo UTC → tránh lệch ngày).
function formatDateUTC(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
       + `-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Ô ngày → 'YYYY-MM-DD'. Nhận Date, 'YYYY/M/D [h:m:s]', 'DD/MM/YYYY'.
function parseDate(raw) {
  const v = extractText(raw);
  if (v == null) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : formatDateUTC(v);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s.*)?$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

// Ô bất kỳ (không phải cột ngày) → scalar sạch để lưu/hiển thị.
function cellValue(raw) {
  const v = extractText(raw);
  if (v == null) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : formatDateUTC(v);
  if (typeof v === 'number') return v;
  const s = String(v).replace(/\s+/g, ' ').trim();
  if (!s || s === '#N/A' || s === '#REF!' || s === '#VALUE!') return null;
  return s;
}

function findMaHeader(headers) {
  return headers.find((h) => {
    const k = normalizeKey(h);
    return k.startsWith('ma the') || k === 'ma van tay' || k === 'ma cham cong';
  }) || null;
}

function findNgayHeader(headers) {
  return headers.find((h) => normalizeKey(h) === 'ngay') || null;
}

function findTenHeader(headers) {
  return headers.find((h) => {
    const k = normalizeKey(h);
    return k.startsWith('ho ') || k === 'ho ten' || k === 'ho va ten' || k.includes('ho ten');
  }) || null;
}

/**
 * Parse buffer .xlsx → cấu trúc chung { headers, rows, ... }. Không phụ thuộc template:
 * đọc dòng 1 làm header, các dòng còn lại thành object theo tên cột.
 */
async function parseWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw badRequest('File Excel không có sheet nào', 'EMPTY_WORKBOOK');

  // Header ở dòng 1 — giữ nguyên tên hiển thị, chỉ gộp khoảng trắng.
  const colHeaders = {}; // colNumber -> header string
  const headers = [];
  const seen = new Set();
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    let name = String(extractText(cell.value) ?? '').replace(/\s+/g, ' ').trim();
    if (!name) return;
    const base = name;
    let i = 2;
    while (seen.has(name)) name = `${base} (${i++})`; // tránh trùng key JSON
    seen.add(name);
    colHeaders[colNumber] = name;
    headers.push(name);
  });
  if (headers.length === 0) throw badRequest('File Excel không có dòng tiêu đề (dòng 1)', 'MISSING_HEADER');

  const maHeader = findMaHeader(headers);
  const ngayHeader = findNgayHeader(headers);

  const rows = [];
  const maSet = new Set();
  const monthCount = new Map(); // 'YYYY-MM' -> số dòng
  for (let r = 2; r <= ws.rowCount; r++) {
    const excelRow = ws.getRow(r);
    if (!excelRow.hasValues) continue;

    const obj = {};
    let hasAny = false;
    for (const [colIdx, header] of Object.entries(colHeaders)) {
      const cell = excelRow.getCell(Number(colIdx)).value;
      const val = header === ngayHeader ? parseDate(cell) : cellValue(cell);
      if (val !== null && val !== '') hasAny = true;
      obj[header] = val;
    }
    if (!hasAny) continue;
    rows.push(obj);

    if (maHeader && obj[maHeader] != null && obj[maHeader] !== '') {
      maSet.add(String(obj[maHeader]).trim());
    }
    if (ngayHeader && obj[ngayHeader]) {
      const key = obj[ngayHeader].slice(0, 7);
      monthCount.set(key, (monthCount.get(key) || 0) + 1);
    }
  }
  if (rows.length === 0) throw badRequest('File Excel không có dòng dữ liệu nào', 'NO_DATA_ROWS');

  const months = [...monthCount.entries()]
    .map(([k, count]) => ({ nam: +k.slice(0, 4), thang: +k.slice(5, 7), count }))
    .sort((a, b) => b.count - a.count);

  return {
    headers, rows, maHeader, ngayHeader, months, maSet,
    soDong: rows.length, soCongNhan: maSet.size,
  };
}

// Lấy tập mã thẻ từ blob du_lieu đã lưu (để so sánh guard).
function extractMaSet(duLieu) {
  const maHeader = duLieu.ma_header || findMaHeader(duLieu.headers || []);
  const set = new Set();
  if (!maHeader) return set;
  for (const row of duLieu.rows || []) {
    const v = row[maHeader];
    if (v != null && v !== '') set.add(String(v).trim());
  }
  return set;
}

/**
 * So bản mới với bản đang lưu (nếu có) → cảnh báo khi có dấu hiệu THIẾU dữ liệu.
 * Không chặn commit, chỉ để UI hỏi lại người dùng trước khi ghi đè.
 */
async function analyzeAgainstExisting(parsed, congTyId, thang, nam) {
  const { rows } = await db.query(
    `SELECT so_dong, so_cong_nhan, du_lieu, updated_at
       FROM bang_van_tay_thang WHERE cong_ty_id = $1 AND thang = $2 AND nam = $3`,
    [congTyId, thang, nam],
  );
  if (rows.length === 0) return { existing: null, warnings: [] };

  const ex = rows[0];
  const warnings = [];
  if (parsed.soDong < ex.so_dong * 0.8) {
    warnings.push(`Bản mới có ${parsed.soDong} dòng, ít hơn đáng kể bản đang lưu `
      + `(${ex.so_dong} dòng). Kiểm tra kỹ trước khi ghi đè.`);
  }
  const missing = [...extractMaSet(ex.du_lieu)].filter((m) => !parsed.maSet.has(m));
  if (missing.length > 0) {
    warnings.push(`${missing.length} mã thẻ có trong bản cũ nhưng KHÔNG có trong bản mới `
      + `(VD: ${missing.slice(0, 5).join(', ')}).`);
  }
  return {
    existing: { so_dong: ex.so_dong, so_cong_nhan: ex.so_cong_nhan, updated_at: ex.updated_at },
    warnings,
  };
}

/**
 * UPSERT ghi đè toàn bộ dữ liệu tháng.
 */
async function commit(congTyId, thang, nam, parsed, userId, { skipLog = false } = {}) {
  const duLieu = {
    headers: parsed.headers,
    rows: parsed.rows,
    ma_header: parsed.maHeader,
    ngay_header: parsed.ngayHeader,
  };
  const { rows } = await db.query(
    `INSERT INTO bang_van_tay_thang
       (cong_ty_id, thang, nam, du_lieu, so_dong, so_cong_nhan, uploaded_by)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
     ON CONFLICT (cong_ty_id, thang, nam) DO UPDATE
       SET du_lieu      = EXCLUDED.du_lieu,
           so_dong      = EXCLUDED.so_dong,
           so_cong_nhan = EXCLUDED.so_cong_nhan,
           uploaded_by  = EXCLUDED.uploaded_by,
           updated_at   = NOW()
     RETURNING (xmax = 0) AS is_insert`,
    [congTyId, thang, nam, JSON.stringify(duLieu), parsed.soDong, parsed.soCongNhan, userId || null],
  );
  const isInsert = !!rows[0]?.is_insert;

  if (userId && !skipLog) {
    try {
      await db.query(
        `INSERT INTO hoat_dong_log (loai, du_lieu, ghi_chu, created_by, muc_do)
         VALUES ('import_van_tay', $1::jsonb, $2, $3, 'quan_trong')`,
        [
          JSON.stringify({ cong_ty_id: congTyId, thang, nam, so_dong: parsed.soDong }),
          `${isInsert ? 'Thêm' : 'Ghi đè'} bảng vân tay T${thang}/${nam}: ${parsed.soDong} dòng`,
          userId,
        ],
      );
    } catch { /* log lỗi không được chặn nghiệp vụ chính */ }
  }
  return { thang, nam, so_dong: parsed.soDong, so_cong_nhan: parsed.soCongNhan, is_insert: isInsert };
}

// Danh sách các tháng đã có dữ liệu của 1 công ty (cho dropdown UI).
async function listThang(congTyId) {
  const { rows } = await db.query(
    `SELECT thang, nam, so_dong, so_cong_nhan, updated_at
       FROM bang_van_tay_thang WHERE cong_ty_id = $1
       ORDER BY nam DESC, thang DESC`,
    [congTyId],
  );
  return rows;
}

/**
 * Tra cứu bảng vân tay 1 tháng — lấy blob, lọc theo q (mã thẻ / tên), phân trang.
 */
async function lookup(congTyId, thang, nam, { q, page, limit }) {
  const { rows } = await db.query(
    `SELECT du_lieu, so_dong, so_cong_nhan, updated_at
       FROM bang_van_tay_thang WHERE cong_ty_id = $1 AND thang = $2 AND nam = $3`,
    [congTyId, thang, nam],
  );
  if (rows.length === 0) {
    const e = new Error('Chưa có dữ liệu vân tay cho kỳ này');
    e.statusCode = 404; e.code = 'KY_NOT_FOUND';
    throw e;
  }
  const duLieu = rows[0].du_lieu || {};
  const headers = duLieu.headers || [];
  let data = duLieu.rows || [];

  if (q && q.trim()) {
    const needle = normalizeSearch(q);
    const maH = duLieu.ma_header || findMaHeader(headers);
    const tenH = findTenHeader(headers);
    data = data.filter((row) => {
      const ma = maH ? normalizeSearch(row[maH]) : '';
      const ten = tenH ? normalizeSearch(row[tenH]) : '';
      return ma.includes(needle) || ten.includes(needle);
    });
  }

  const total = data.length;
  const start = (page - 1) * limit;
  return {
    headers,
    rows: data.slice(start, start + limit),
    updated_at: rows[0].updated_at,
    meta: { page, limit, total },
  };
}

/**
 * Tra cứu theo MÃ VÂN TAY xuyên tất cả các tháng đã lưu (cho ô tìm kiếm 1 field).
 * Trả về các dòng khớp, mỗi dòng gắn thêm cột "Công ty" và "Tháng".
 */
async function lookupByMa(ma, { congTyId, page, limit }) {
  const params = [];
  let where = '';
  if (congTyId) { params.push(congTyId); where = `WHERE b.cong_ty_id = $${params.length}`; }

  const { rows: recs } = await db.query(
    `SELECT b.cong_ty_id, b.thang, b.nam, b.du_lieu, c.ten_cong_ty
       FROM bang_van_tay_thang b
       JOIN cong_ty c ON c.id = b.cong_ty_id
       ${where}
       ORDER BY b.nam DESC, b.thang DESC`,
    params,
  );

  const needle = normalizeSearch(ma);
  let baseHeaders = null;
  const matched = [];
  for (const rec of recs) {
    const du = rec.du_lieu || {};
    const hs = du.headers || [];
    const maH = du.ma_header || findMaHeader(hs);
    if (!maH) continue;
    if (!baseHeaders) baseHeaders = hs; // dùng bộ cột của bản mới nhất làm chuẩn
    for (const row of du.rows || []) {
      if (normalizeSearch(row[maH]).includes(needle)) {
        matched.push({ 'Công ty': rec.ten_cong_ty, 'Tháng': `${rec.thang}/${rec.nam}`, ...row });
      }
    }
  }

  const headers = ['Công ty', 'Tháng', ...(baseHeaders || [])];
  const total = matched.length;
  const start = (page - 1) * limit;
  return { headers, rows: matched.slice(start, start + limit), meta: { page, limit, total } };
}

module.exports = {
  parseWorkbook,
  analyzeAgainstExisting,
  commit,
  listThang,
  lookup,
  lookupByMa,
};
