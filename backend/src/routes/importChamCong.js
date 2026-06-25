/**
 * Routes import chấm công từ file Excel máy vân tay.
 *
 *   POST /api/cham-cong/import-excel/preview  — parse + validate, không ghi DB
 *   POST /api/cham-cong/import-excel/commit   — parse + UPSERT
 *
 * Body: multipart (file: .xlsx, cong_ty_id: number)
 */
const { Router } = require('express');
const ExcelJS = require('exceljs');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadExcel } = require('../middleware/upload');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');
const importSvc = require('../services/importChamCongService');
const { resolveTemplate } = require('../services/chamCongTemplates');
const db = require('../utils/db');

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

// Lấy tên công ty → template (fallback 'default' nếu công ty chưa khai báo).
async function templateForCongTy(congTyId) {
  const { rows } = await db.query(
    `SELECT ten_cong_ty FROM cong_ty WHERE id = $1`, [congTyId],
  );
  if (rows.length === 0) {
    const e = new Error('Công ty không tồn tại');
    e.statusCode = 400; e.code = 'CONG_TY_NOT_FOUND'; throw e;
  }
  return { template: resolveTemplate(rows[0].ten_cong_ty), ten_cong_ty: rows[0].ten_cong_ty };
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
    const { template } = await templateForCongTy(congTyId);

    const rows = await importSvc.parseExcel(req.file.buffer, template);
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
      bo_phan:          r.bo_phan ?? null,
      ngay:             r.ngay,
      so_gio:           r.so_gio ?? 0,
      so_gio_ot:        r.so_gio_ot ?? 0,
      gio_den:          r.gio_den ?? null,
      gio_nghi_trua:    r.gio_nghi_trua ?? null,
      gio_ve:           r.gio_ve ?? null,
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
    const { template } = await templateForCongTy(congTyId);

    const rows = await importSvc.parseExcel(req.file.buffer, template);
    await importSvc.resolveAndValidate(rows, congTyId);
    const result = await importSvc.commitImport(rows, req.user.id);

    sendSuccess(res, result,
      `Import xong: thêm ${result.inserted}, cập nhật ${result.updated}, skip ${result.skipped}`);
  }),
);

// GET /api/cham-cong/import-excel/template?cong_ty_id=  → tải file .xlsx mẫu theo công ty
router.get('/template',
  authenticate,
  requireRole('admin', 'quan_ly'),
  asyncWrapper(async (req, res) => {
    const congTyId = parseCongTyId(req.query.cong_ty_id);
    const { template, ten_cong_ty } = await templateForCongTy(congTyId);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Mau cham cong');
    ws.addRow(template.templateHeaders);
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((col) => { col.width = 16; });

    const safeName = String(ten_cong_ty || 'cong-ty')
      .normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      `attachment; filename="mau-cham-cong_${safeName}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  }),
);

module.exports = router;
