/**
 * Routes tra cứu bảng công vân tay theo tháng (lưu nguyên file dưới dạng JSONB).
 *
 *   POST /api/bang-van-tay/preview   — parse Excel + cảnh báo, KHÔNG ghi DB
 *   POST /api/bang-van-tay/commit    — parse Excel + UPSERT ghi đè cả tháng
 *   GET  /api/bang-van-tay/thang     — danh sách tháng đã có (cho dropdown)
 *   GET  /api/bang-van-tay           — tra cứu 1 tháng (lọc + phân trang)
 *
 * Upload: multipart (file: .xlsx). Kỳ (thang/nam) tự phát hiện từ cột NGÀY,
 * người dùng có thể truyền thang/nam để ghi đè lựa chọn.
 */
const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadExcel } = require('../middleware/upload');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');
const svc = require('../services/bangVanTayService');
const db = require('../utils/db');

const router = Router();

function parsePositiveInt(value, field) {
  const n = parseInt(value, 10);
  if (!Number.isInteger(n) || n <= 0) {
    const e = new Error(`${field} không hợp lệ`);
    e.statusCode = 400; e.code = 'VALIDATION_ERROR';
    throw e;
  }
  return n;
}

// thang 1-12, nam 2000-2100; trả null nếu không truyền (để fallback tự phát hiện).
function parseThangNam(rawThang, rawNam) {
  if (rawThang == null && rawNam == null) return { thang: null, nam: null };
  const thang = parseInt(rawThang, 10);
  const nam = parseInt(rawNam, 10);
  if (!Number.isInteger(thang) || thang < 1 || thang > 12) {
    const e = new Error('thang không hợp lệ (1-12)'); e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
  }
  if (!Number.isInteger(nam) || nam < 2000 || nam > 2100) {
    const e = new Error('nam không hợp lệ'); e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
  }
  return { thang, nam };
}

async function assertCongTyExists(congTyId) {
  const { rows } = await db.query('SELECT 1 FROM cong_ty WHERE id = $1', [congTyId]);
  if (rows.length === 0) {
    const e = new Error('Công ty không tồn tại');
    e.statusCode = 400; e.code = 'CONG_TY_NOT_FOUND';
    throw e;
  }
}

function requireFile(req) {
  if (!req.file) {
    const e = new Error('Vui lòng upload file Excel');
    e.statusCode = 400; e.code = 'NO_FILE';
    throw e;
  }
}

// Chọn kỳ ghi: ưu tiên thang/nam người dùng truyền, else lấy tháng chiếm đa số trong file.
function resolveKy(parsed, provided) {
  if (provided.thang != null) return { thang: provided.thang, nam: provided.nam };
  if (parsed.months.length === 0) {
    const e = new Error('Không xác định được tháng từ cột "Ngày" — vui lòng chọn thang/nam');
    e.statusCode = 400; e.code = 'KHONG_XAC_DINH_KY';
    throw e;
  }
  return { thang: parsed.months[0].thang, nam: parsed.months[0].nam };
}

router.post('/preview',
  authenticate,
  requireRole('admin', 'quan_ly'),
  uploadExcel,
  asyncWrapper(async (req, res) => {
    requireFile(req);
    const congTyId = parsePositiveInt(req.body?.cong_ty_id, 'cong_ty_id');
    await assertCongTyExists(congTyId);
    const provided = parseThangNam(req.body?.thang, req.body?.nam);

    const parsed = await svc.parseWorkbook(req.file.buffer);
    const ky = resolveKy(parsed, provided);
    const { existing, warnings } = await svc.analyzeAgainstExisting(parsed, congTyId, ky.thang, ky.nam);

    // Cảnh báo thêm nếu file trải nhiều tháng hoặc kỳ chọn khác kỳ đa số trong file.
    if (parsed.months.length > 1) {
      warnings.push(`File chứa dữ liệu của ${parsed.months.length} tháng khác nhau — `
        + `sẽ lưu tất cả vào kỳ T${ky.thang}/${ky.nam}.`);
    }
    if (provided.thang != null && parsed.months[0]
        && (parsed.months[0].thang !== ky.thang || parsed.months[0].nam !== ky.nam)) {
      warnings.push(`Kỳ bạn chọn (T${ky.thang}/${ky.nam}) khác tháng đa số trong file `
        + `(T${parsed.months[0].thang}/${parsed.months[0].nam}).`);
    }

    sendSuccess(res, {
      ky,
      headers: parsed.headers,
      so_dong: parsed.soDong,
      so_cong_nhan: parsed.soCongNhan,
      thang_phat_hien: parsed.months,
      preview_rows: parsed.rows.slice(0, 50),
      existing,
      warnings,
    }, 'Đọc file thành công');
  }),
);

router.post('/commit',
  authenticate,
  requireRole('admin', 'quan_ly'),
  uploadExcel,
  asyncWrapper(async (req, res) => {
    requireFile(req);
    const congTyId = parsePositiveInt(req.body?.cong_ty_id, 'cong_ty_id');
    await assertCongTyExists(congTyId);
    const provided = parseThangNam(req.body?.thang, req.body?.nam);

    const parsed = await svc.parseWorkbook(req.file.buffer);
    const ky = resolveKy(parsed, provided);
    const result = await svc.commit(congTyId, ky.thang, ky.nam, parsed, req.user.id);

    sendSuccess(res, result,
      `${result.is_insert ? 'Đã thêm' : 'Đã ghi đè'} bảng vân tay T${ky.thang}/${ky.nam}: `
      + `${result.so_dong} dòng, ${result.so_cong_nhan} công nhân`);
  }),
);

router.get('/thang',
  authenticate,
  requireRole('admin', 'quan_ly', 'ke_toan', 'vender', 'xem'),
  asyncWrapper(async (req, res) => {
    const congTyId = parsePositiveInt(req.query.cong_ty_id, 'cong_ty_id');
    const list = await svc.listThang(congTyId);
    sendSuccess(res, list, 'Danh sách tháng có dữ liệu');
  }),
);

// Tra cứu theo mã vân tay (1 ô input) — quét mọi tháng đã lưu.
router.get('/tra-cuu-ma',
  authenticate,
  requireRole('admin', 'quan_ly', 'ke_toan', 'vender', 'xem'),
  asyncWrapper(async (req, res) => {
    const ma = String(req.query.ma || '').trim();
    if (!ma) {
      const e = new Error('Vui lòng nhập mã vân tay'); e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
    }
    const congTyId = req.query.cong_ty_id ? parsePositiveInt(req.query.cong_ty_id, 'cong_ty_id') : null;
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 500));

    const result = await svc.lookupByMa(ma, { congTyId, limit });
    sendSuccess(res, { groups: result.groups }, 'Tra cứu thành công', 200, result.meta);
  }),
);

router.get('/',
  authenticate,
  requireRole('admin', 'quan_ly', 'ke_toan', 'vender', 'xem'),
  asyncWrapper(async (req, res) => {
    const congTyId = parsePositiveInt(req.query.cong_ty_id, 'cong_ty_id');
    const { thang, nam } = parseThangNam(req.query.thang, req.query.nam);
    if (thang == null) {
      const e = new Error('Thiếu thang/nam để tra cứu'); e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const q = req.query.q || '';

    const result = await svc.lookup(congTyId, thang, nam, { q, page, limit });
    sendSuccess(res, { headers: result.headers, rows: result.rows, updated_at: result.updated_at },
      'Tra cứu thành công', 200, result.meta);
  }),
);

module.exports = router;
