/**
 * Routes import danh sách công nhân từ file Excel.
 *
 *   GET  /api/cong-nhan/import-excel/template  → download .xlsx mẫu
 *   POST /api/cong-nhan/import-excel/preview   → parse + validate, không ghi DB
 *   POST /api/cong-nhan/import-excel/commit    → parse + validate + insert DB
 *
 * Cả 2 POST nhận multipart field `file` (.xlsx).
 */
const { Router } = require('express');
const multer = require('multer');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadExcel } = require('../middleware/upload');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');
const importSvc = require('../services/importCongNhanService');

const router = Router();

// Bọc uploadExcel để chuyển lỗi multer (sai định dạng / quá lớn) thành 400 dễ hiểu
function uploadExcelSafe(req, res, next) {
  uploadExcel(req, res, (err) => {
    if (!err) return next();
    let message = 'Không đọc được file tải lên. Vui lòng chọn lại file Excel (.xlsx).';
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') message = 'File quá lớn. Giới hạn 10MB.';
      else message = `Lỗi tải file: ${err.message}`;
    } else if (err.message) {
      message = err.message; // vd: "Chỉ chấp nhận file Excel (.xlsx)"
    }
    const e = new Error(message);
    e.statusCode = 400; e.code = 'INVALID_UPLOAD';
    return next(e);
  });
}

// Dựng payload preview để FE hiển thị/sửa
function toPreviewPayload(rows) {
  return rows.map((r) => ({
    rowNumber:    r.rowNumber,
    data:         r.data,
    vender_name:  r._venderName ?? null,
    cong_ty_name: r._congTyName ?? null,
    errors:       r.errors,
    warnings:     r.warnings,
    skip:         !!r.skip,
  }));
}

function toSummary(rows) {
  return {
    total:     rows.length,
    ready:     rows.filter((r) => r.errors.length === 0 && !r.skip).length,
    errorRows: rows.filter((r) => r.errors.length > 0).length,
    skipRows:  rows.filter((r) => r.skip).length,
  };
}

// Schema cho các dòng FE gửi lên (đã sửa tay)
const editedRowsSchema = z.object({
  rows: z.array(z.object({
    rowNumber:    z.number().int().optional(),
    data:         z.record(z.any()).default({}),
    vender_name:  z.string().nullable().optional(),
    cong_ty_name: z.string().nullable().optional(),
  })).min(1, 'Không có dòng nào để xử lý'),
});

// Tải file template — không cần auth (đỡ rườm rà link tải)
// Chỉ là 1 file Excel rỗng có headers, không lộ thông tin nhạy cảm
router.get('/template', authenticate, asyncWrapper(async (_req, res) => {
  const buffer = await importSvc.buildTemplate();
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', 'attachment; filename="template-cong-nhan.xlsx"');
  res.send(Buffer.from(buffer));
}));

// Preview: parse + validate, KHÔNG ghi DB
router.post('/preview',
  authenticate,
  requireRole('admin', 'quan_ly'),
  uploadExcelSafe,
  asyncWrapper(async (req, res) => {
    if (!req.file) {
      const e = new Error('Vui lòng upload file Excel');
      e.statusCode = 400; e.code = 'NO_FILE'; throw e;
    }
    const rows = await importSvc.parseExcel(req.file.buffer);
    await importSvc.resolveAndValidate(rows);

    sendSuccess(res, {
      rows: toPreviewPayload(rows),
      summary: toSummary(rows),
    }, 'Parse Excel thành công');
  }),
);

// Re-validate các dòng đã sửa tay (KHÔNG ghi DB) — dùng cho màn hình preview
router.post('/revalidate',
  authenticate,
  requireRole('admin', 'quan_ly'),
  validate(editedRowsSchema),
  asyncWrapper(async (req, res) => {
    const rows = importSvc.rebuildRowsFromPayload(req.validatedBody.rows);
    await importSvc.resolveAndValidate(rows);
    sendSuccess(res, {
      rows: toPreviewPayload(rows),
      summary: toSummary(rows),
    }, 'Kiểm tra lại thành công');
  }),
);

// Commit từ các dòng đã sửa tay (JSON) thay vì re-parse file
router.post('/commit-rows',
  authenticate,
  requireRole('admin', 'quan_ly'),
  validate(editedRowsSchema),
  asyncWrapper(async (req, res) => {
    const rows = importSvc.rebuildRowsFromPayload(req.validatedBody.rows);
    await importSvc.resolveAndValidate(rows);
    const result = await importSvc.commitImport(rows, req.user.id);
    sendSuccess(res, { ...result, total: rows.length }, `Đã thêm ${result.inserted} công nhân`);
  }),
);

// Commit: parse + validate + insert. Skip các row có error hoặc trùng CCCD.
router.post('/commit',
  authenticate,
  requireRole('admin', 'quan_ly'),
  uploadExcelSafe,
  asyncWrapper(async (req, res) => {
    if (!req.file) {
      const e = new Error('Vui lòng upload file Excel');
      e.statusCode = 400; e.code = 'NO_FILE'; throw e;
    }
    const rows = await importSvc.parseExcel(req.file.buffer);
    await importSvc.resolveAndValidate(rows);
    const result = await importSvc.commitImport(rows, req.user.id);

    sendSuccess(res, {
      ...result,
      total: rows.length,
    }, `Đã thêm ${result.inserted} công nhân`);
  }),
);

module.exports = router;
