/**
 * Parse + validate file Excel chấm công từ máy vân tay.
 *
 * Quy tắc:
 *   - Mỗi file thuộc 1 công ty (user chọn cong_ty_id trước khi upload)
 *   - Match Mã thẻ ↔ cong_nhan.ma_van_tay
 *   - Tìm phan_cong active của (cong_nhan, cong_ty, ngay)
 *   - CN không thuộc công ty này tại ngày đó → skip (báo trong preview)
 *   - so_gio   = CA NGÀY + CA ĐÊM + CHỦ NHẬT + NGÀY LỄ
 *   - so_gio_ot = TĂNG CA TRC 9:45 + SAU 9:45 + TĂNG CA ĐÊM + TĂNG CA CHỦ NHẬT + TĂNG CA NGÀY LỄ
 *   - ca_lam   = 'lam' nếu so_gio > 0, else 'nghi_phep'
 *   - UPSERT ON CONFLICT (phan_cong_id, ngay) DO UPDATE (override)
 */
const ExcelJS = require('exceljs');
const db = require('../utils/db');
const { resolveTemplate } = require('./chamCongTemplates');

function normalizeHeader(raw) {
  raw = extractText(raw); // header cũng có thể là rich text / object ExcelJS
  if (raw == null) return '';
  return String(raw)
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function parseDate(raw) {
  if (raw == null) return null;
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  if (!s) return null;
  // ISO YYYY-MM-DD hoặc YYYY/M/D
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s.*)?$/);
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
  return null;
}

// Chuyển JS Date (từ pg driver) hoặc string thành 'YYYY-MM-DD'.
// Dùng local Y/M/D parts để tránh timezone shift của toISOString().
function dateToYMD(d) {
  if (!d) return null;
  if (d instanceof Date) {
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return String(d).slice(0, 10);
}

function toHours(raw) {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number') return raw;
  const n = Number(String(raw).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// Parse chuỗi "Lịch sử chấm vân tay" dạng "07:30| 08:35| 19:33|"
// Trả { raw: string, gio_den, gio_ve } — gio_nghi_trua không tách vì không đáng tin cậy.
function parseLichSuVanTay(raw) {
  if (!raw) return { raw: null, gio_den: null, gio_ve: null };
  const str = String(raw).trim();
  const matches = [];
  for (const m of str.matchAll(/(\d{1,2}):(\d{2})(?::\d{2})?/g)) {
    matches.push(`${m[1].padStart(2, '0')}:${m[2]}`);
  }
  if (matches.length === 0) return { raw: str, gio_den: null, gio_ve: null };
  return {
    raw: str,
    gio_den: matches[0],
    gio_ve: matches[matches.length - 1],
  };
}

// Chuẩn hoá 1 mốc giờ chấm về 'HH:MM' (máy vân tay xuất nhiều kiểu).
// Trả null nếu không nhận diện được → không lưu.
function toClock(raw) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return `${String(raw.getHours()).padStart(2, '0')}:${String(raw.getMinutes()).padStart(2, '0')}`;
  }
  if (typeof raw === 'number') {
    // ExcelJS có thể trả giờ dạng fraction của ngày (0..1) hoặc số phút.
    const frac = raw > 0 && raw < 1 ? raw : null;
    if (frac != null) {
      const mins = Math.round(frac * 24 * 60);
      return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    }
    return null;
  }
  const m = String(raw).trim().match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/**
 * Parse buffer .xlsx → rows, dùng headerMap của template công ty.
 */
async function parseExcel(buffer, template = resolveTemplate(null)) {
  const headerMap = template.headerMap;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) {
    const err = new Error('File Excel không có sheet nào');
    err.statusCode = 400; err.code = 'EMPTY_WORKBOOK'; throw err;
  }

  // Header ở row 1
  const colMap = {};
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = normalizeHeader(cell.value);
    const field = headerMap[key];
    if (field) colMap[colNumber] = field;
  });

  // Bắt buộc có Mã thẻ và Ngày
  const fields = Object.values(colMap);
  if (!fields.includes('ma_van_tay')) {
    const err = new Error('File Excel thiếu cột "Mã thẻ" / "Mã vân tay"');
    err.statusCode = 400; err.code = 'MISSING_MA_THE'; throw err;
  }
  if (!fields.includes('ngay')) {
    const err = new Error('File Excel thiếu cột "Ngày"');
    err.statusCode = 400; err.code = 'MISSING_NGAY'; throw err;
  }

  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const excelRow = ws.getRow(r);
    if (!excelRow.hasValues) continue;

    const row = {
      rowNumber: r,
      display_name: null,
      ma_van_tay: null,
      ngay: null,
      trang_thai: null,
      bo_phan: null,
      gio_den: null, gio_nghi_trua: null, gio_ve: null, lich_su_van_tay: null,
      h_day: 0, h_night: 0, h_sunday: 0, h_holiday: 0,
      ot_before_945: 0, ot_after_945: 0, ot_night: 0, ot_sunday: 0, ot_holiday: 0,
      errors: [], warnings: [], skip: false,
    };

    for (const [colIdx, field] of Object.entries(colMap)) {
      const raw = cleanCell(excelRow.getCell(Number(colIdx)).value);
      if (raw == null) continue;
      switch (field) {
        case 'ma_van_tay':       row.ma_van_tay = String(raw).trim(); break;
        case '__display_name':   row.display_name = raw; break;
        case 'ngay':             row.ngay = parseDate(raw); break;
        case '__trang_thai':     row.trang_thai = raw; break;
        case '__bo_phan':        row.bo_phan = String(raw).trim() || null; break;
        case '__gio_den':        row.gio_den = toClock(raw); break;
        case '__gio_nghi_trua':  row.gio_nghi_trua = toClock(raw); break;
        case '__gio_ve':         row.gio_ve = toClock(raw); break;
        case '__lich_su_van_tay': {
          const parsed = parseLichSuVanTay(raw);
          row.lich_su_van_tay = parsed.raw;
          // Chỉ set gio_den/gio_ve nếu chưa có cột riêng
          if (!row.gio_den) row.gio_den = parsed.gio_den;
          if (!row.gio_ve)  row.gio_ve  = parsed.gio_ve;
          break;
        }
        case '__h_day':          row.h_day = toHours(raw); break;
        case '__h_night':        row.h_night = toHours(raw); break;
        case '__h_sunday':       row.h_sunday = toHours(raw); break;
        case '__h_holiday':      row.h_holiday = toHours(raw); break;
        case '__ot_before_945':  row.ot_before_945 = toHours(raw); break;
        case '__ot_after_945':   row.ot_after_945 = toHours(raw); break;
        case '__ot_night':       row.ot_night = toHours(raw); break;
        case '__ot_sunday':      row.ot_sunday = toHours(raw); break;
        case '__ot_holiday':     row.ot_holiday = toHours(raw); break;
      }
    }

    // Skip row hoàn toàn trống (không có mã thẻ + không có ngày)
    if (!row.ma_van_tay && !row.ngay) continue;

    // Phân loại vào 4 cột HC/TC × ngày/đêm.
    // Chủ nhật + ngày lễ gộp vào ca NGÀY (không tách riêng ở chấm công thủ công).
    const round2 = (n) => Math.round(n * 100) / 100;
    row.gio_hc_ngay = round2(row.h_day + row.h_sunday + row.h_holiday);
    row.gio_hc_dem  = round2(row.h_night);
    row.gio_tc_ngay = round2(row.ot_before_945 + row.ot_after_945 + row.ot_sunday + row.ot_holiday);
    row.gio_tc_dem  = round2(row.ot_night);

    // Tổng giờ (giữ lại cho tính lương/CTV/báo cáo cũ)
    row.so_gio    = round2(row.gio_hc_ngay + row.gio_hc_dem);
    row.so_gio_ot = round2(row.gio_tc_ngay + row.gio_tc_dem);

    // ca_lam
    if (row.so_gio === 0 && row.so_gio_ot === 0) {
      row.ca_lam = 'nghi_phep';
    } else {
      row.ca_lam = 'lam';
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Resolve mã thẻ → cong_nhan → phan_cong tại cong_ty đã chọn + ngày.
 * Validate + flag skip cho row CN không thuộc công ty.
 */
async function resolveAndValidate(rows, congTyId) {
  // Kiểm tra cong_ty tồn tại
  const { rows: ctRows } = await db.query(
    `SELECT id, ten_cong_ty FROM cong_ty WHERE id = $1`,
    [congTyId],
  );
  if (ctRows.length === 0) {
    const err = new Error('Công ty không tồn tại');
    err.statusCode = 400; err.code = 'CONG_TY_NOT_FOUND'; throw err;
  }

  // Gom unique mã thẻ
  const maTheList = [...new Set(rows.map((r) => r.ma_van_tay).filter(Boolean))];

  // Lookup cong_nhan by ma_van_tay
  const cnMap = new Map(); // ma_van_tay → { id, ho_ten }
  if (maTheList.length > 0) {
    const { rows: cnRows } = await db.query(
      `SELECT id, ho_ten, ma_van_tay FROM cong_nhan
       WHERE ma_van_tay = ANY($1::text[]) AND deleted_at IS NULL`,
      [maTheList],
    );
    for (const cn of cnRows) cnMap.set(cn.ma_van_tay, cn);
  }

  // Lookup phan_cong: cho từng cong_nhan, lấy tất cả phan_cong với cong_ty đã chọn
  const cnIds = [...cnMap.values()].map((cn) => cn.id);
  const pcByCn = new Map(); // cong_nhan_id → array [{ id, ngay_bat_dau, ngay_ket_thuc }]
  if (cnIds.length > 0) {
    const { rows: pcRows } = await db.query(
      `SELECT id, cong_nhan_id, ngay_bat_dau, ngay_ket_thuc
       FROM phan_cong
       WHERE cong_nhan_id = ANY($1::int[]) AND cong_ty_id = $2`,
      [cnIds, congTyId],
    );
    for (const pc of pcRows) {
      if (!pcByCn.has(pc.cong_nhan_id)) pcByCn.set(pc.cong_nhan_id, []);
      pcByCn.get(pc.cong_nhan_id).push(pc);
    }
  }

  for (const r of rows) {
    if (!r.ma_van_tay) { r.errors.push('Thiếu Mã thẻ'); continue; }
    if (!r.ngay)       { r.errors.push('Thiếu/sai định dạng Ngày'); continue; }

    const cn = cnMap.get(r.ma_van_tay);
    if (!cn) {
      r.errors.push(`Mã thẻ "${r.ma_van_tay}" không khớp công nhân nào trong DB`);
      continue;
    }
    r.cong_nhan_id = cn.id;
    r.cong_nhan_ho_ten = cn.ho_ten;

    const pcList = pcByCn.get(cn.id) || [];
    const activePc = pcList.find((pc) => {
      // pg driver trả DATE thành JS Date object, KHÔNG phải string.
      // Phải convert qua YMD trước khi so sánh với r.ngay (đã ở dạng 'YYYY-MM-DD').
      const bd = pc.ngay_bat_dau ? dateToYMD(pc.ngay_bat_dau) : null;
      const kt = pc.ngay_ket_thuc ? dateToYMD(pc.ngay_ket_thuc) : null;
      return (!bd || bd <= r.ngay) && (!kt || r.ngay <= kt);
    });

    if (!activePc) {
      r.skip = true;
      r.warnings.push(`CN "${cn.ho_ten}" không thuộc công ty này tại ngày ${r.ngay} → skip`);
      continue;
    }
    r.phan_cong_id = activePc.id;

    // Validate giờ hợp lý (warning, không block)
    if (r.so_gio > 16) r.warnings.push(`so_gio = ${r.so_gio} lớn bất thường`);
    if (r.so_gio_ot > 12) r.warnings.push(`so_gio_ot = ${r.so_gio_ot} lớn bất thường`);
  }

  return rows;
}

/**
 * UPSERT chấm công vào DB.
 */
async function commitImport(rows, createdBy) {
  const toUpsert = rows.filter((r) => r.errors.length === 0 && !r.skip && r.phan_cong_id);

  let inserted = 0;
  let updated = 0;
  const failed = [];

  await db.withTransaction(async (client) => {
    for (const r of toUpsert) {
      try {
        const { rows: res } = await client.query(
          `INSERT INTO cham_cong
             (phan_cong_id, ngay, so_gio, so_gio_ot,
              gio_hc_ngay, gio_tc_ngay, gio_hc_dem, gio_tc_dem,
              gio_den, gio_nghi_trua, gio_ve, lich_su_van_tay, ca_lam, ghi_chu)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (phan_cong_id, ngay) DO UPDATE
             SET so_gio          = EXCLUDED.so_gio,
                 so_gio_ot       = EXCLUDED.so_gio_ot,
                 gio_hc_ngay     = EXCLUDED.gio_hc_ngay,
                 gio_tc_ngay     = EXCLUDED.gio_tc_ngay,
                 gio_hc_dem      = EXCLUDED.gio_hc_dem,
                 gio_tc_dem      = EXCLUDED.gio_tc_dem,
                 gio_den         = EXCLUDED.gio_den,
                 gio_nghi_trua   = EXCLUDED.gio_nghi_trua,
                 gio_ve          = EXCLUDED.gio_ve,
                 lich_su_van_tay = EXCLUDED.lich_su_van_tay,
                 ca_lam          = EXCLUDED.ca_lam,
                 ghi_chu         = EXCLUDED.ghi_chu,
                 updated_at = NOW()
           RETURNING (xmax = 0) AS is_insert`,
          [
            r.phan_cong_id, r.ngay, r.so_gio, r.so_gio_ot,
            r.gio_hc_ngay, r.gio_tc_ngay, r.gio_hc_dem, r.gio_tc_dem,
            r.gio_den, r.gio_nghi_trua, r.gio_ve, r.lich_su_van_tay, r.ca_lam,
            'Import từ máy vân tay',
          ],
        );
        if (res[0]?.is_insert) inserted++; else updated++;
      } catch (err) {
        failed.push({ rowNumber: r.rowNumber, message: err.message });
      }
    }

    // Cập nhật bộ phận vào hồ sơ công nhân (lấy giá trị mới nhất có trong file).
    // Chỉ ghi đè khi file có bộ phận; không xoá bộ phận đang có.
    const boPhanByCn = new Map();
    for (const r of rows) {
      if (r.cong_nhan_id && r.bo_phan) boPhanByCn.set(r.cong_nhan_id, r.bo_phan);
    }
    for (const [congNhanId, boPhan] of boPhanByCn) {
      await client.query(
        `UPDATE cong_nhan SET bo_phan = $1, updated_at = NOW()
         WHERE id = $2 AND deleted_at IS NULL
           AND (bo_phan IS DISTINCT FROM $1)`,
        [boPhan, congNhanId],
      );
    }
  });

  if (createdBy && (inserted + updated) > 0) {
    try {
      await db.query(
        `INSERT INTO hoat_dong_log (loai, du_lieu, ghi_chu, created_by, muc_do)
         VALUES ('import_cham_cong', $1::jsonb, $2, $3, 'quan_trong')`,
        [
          JSON.stringify({ inserted, updated, total: rows.length }),
          `Import chấm công: thêm ${inserted}, cập nhật ${updated}`,
          createdBy,
        ],
      );
    } catch {}
  }

  return {
    inserted,
    updated,
    skipped:    rows.filter((r) => r.skip).length,
    errorRows:  rows.filter((r) => r.errors.length > 0).length,
    failed,
    total:      rows.length,
  };
}

module.exports = { parseExcel, resolveAndValidate, commitImport };
