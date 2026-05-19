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
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadExcel } = require('../middleware/upload');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');
const importSvc = require('../services/importCongNhanService');

const router = Router();

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
  uploadExcel,
  asyncWrapper(async (req, res) => {
    if (!req.file) {
      const e = new Error('Vui lòng upload file Excel');
      e.statusCode = 400; e.code = 'NO_FILE'; throw e;
    }
    const rows = await importSvc.parseExcel(req.file.buffer);
    await importSvc.resolveAndValidate(rows);

    const summary = {
      total:      rows.length,
      ready:      rows.filter((r) => r.errors.length === 0 && !r.skip).length,
      errorRows:  rows.filter((r) => r.errors.length > 0).length,
      skipRows:   rows.filter((r) => r.skip).length,
    };

    // Trả về dữ liệu để FE hiển thị bảng preview
    const payload = rows.map((r) => ({
      rowNumber:   r.rowNumber,
      data:        r.data,
      vender_name: r._venderName ?? null,
      cong_ty_name: r._congTyName ?? null,
      errors:      r.errors,
      warnings:    r.warnings,
      skip:        !!r.skip,
    }));

    sendSuccess(res, { rows: payload, summary }, 'Parse Excel thành công');
  }),
);

// Commit: parse + validate + insert. Skip các row có error hoặc trùng CCCD.
router.post('/commit',
  authenticate,
  requireRole('admin', 'quan_ly'),
  uploadExcel,
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
