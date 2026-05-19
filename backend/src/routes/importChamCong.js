/**
 * Routes import chấm công từ file Excel máy vân tay.
 *
 *   POST /api/cham-cong/import-excel/preview  — parse + validate, không ghi DB
 *   POST /api/cham-cong/import-excel/commit   — parse + UPSERT
 *
 * Body: multipart (file: .xlsx, cong_ty_id: number)
 */
const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadExcel } = require('../middleware/upload');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');
const importSvc = require('../services/importChamCongService');

const router = Router();

function parseCongTyId(value) {
  const id = parseInt(value, 10);
  if (!Number.isInteger(id) || id <= 0) {
    const e = new Error('cong_ty_id không hợp lệ');
    e.statusCode = 400; e.code = 'VALIDATION_ERROR';
    throw e;
  }
  return id;
}

router.post('/preview',
  authenticate,
  requireRole('admin', 'quan_ly'),
  uploadExcel,
  asyncWrapper(async (req, res) => {
    if (!req.file) {
      const e = new Error('Vui lòng upload file Excel');
      e.statusCode = 400; e.code = 'NO_FILE'; throw e;
    }
    const congTyId = parseCongTyId(req.body?.cong_ty_id);

    const rows = await importSvc.parseExcel(req.file.buffer);
    await importSvc.resolveAndValidate(rows, congTyId);

    const summary = {
      total:     rows.length,
      ready:     rows.filter((r) => r.errors.length === 0 && !r.skip).length,
      skipRows:  rows.filter((r) => r.skip).length,
      errorRows: rows.filter((r) => r.errors.length > 0).length,
    };

    const payload = rows.map((r) => ({
      rowNumber:        r.rowNumber,
      ma_van_tay:       r.ma_van_tay,
      display_name:     r.display_name,
      cong_nhan_ho_ten: r.cong_nhan_ho_ten ?? null,
      ngay:             r.ngay,
      so_gio:           r.so_gio ?? 0,
      so_gio_ot:        r.so_gio_ot ?? 0,
      ca_lam:           r.ca_lam,
      trang_thai:       r.trang_thai,
      errors:           r.errors,
      warnings:         r.warnings,
      skip:             !!r.skip,
    }));

    sendSuccess(res, { rows: payload, summary }, 'Parse Excel thành công');
  }),
);

router.post('/commit',
  authenticate,
  requireRole('admin', 'quan_ly'),
  uploadExcel,
  asyncWrapper(async (req, res) => {
    if (!req.file) {
      const e = new Error('Vui lòng upload file Excel');
      e.statusCode = 400; e.code = 'NO_FILE'; throw e;
    }
    const congTyId = parseCongTyId(req.body?.cong_ty_id);

    const rows = await importSvc.parseExcel(req.file.buffer);
    await importSvc.resolveAndValidate(rows, congTyId);
    const result = await importSvc.commitImport(rows, req.user.id);

    sendSuccess(res, result,
      `Import xong: thêm ${result.inserted}, cập nhật ${result.updated}, skip ${result.skipped}`);
  }),
);

module.exports = router;
