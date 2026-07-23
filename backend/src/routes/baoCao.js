/**
 * Routes xuất báo cáo.
 *
 *   GET /api/bao-cao/danh-sach-cong-nhan  → xuất Excel danh sách công nhân
 *
 * Phân quyền:
 *   - admin / kế toán : xuất mọi công ty (hoặc chọn 1 công ty cụ thể)
 *   - quản lý          : chỉ xuất công ty mình quản lý (scope tự giới hạn)
 *   - vender / CTV      : KHÔNG được dùng (bị requireRole chặn)
 *
 * Bộ lọc query:
 *   cong_ty_id = <id> | 'all'      (mặc định: tất cả trong phạm vi quyền)
 *   chua_nghi  = 'true' | 'false'  (true = chỉ CN chưa báo nghỉ việc)
 *   loai       = 'chinh_thuc' | 'thoi_vu' | 'ca_hai'  (mặc định: cả 2)
 */
const { Router } = require('express');
const { requireRole, scopeByRole, requireKtxAccess } = require('../middleware/auth');
const asyncWrapper = require('../utils/asyncWrapper');
const congNhanModel = require('../models/congNhanModel');
const ktxModel = require('../models/ktxModel');
const baoCaoSvc = require('../services/baoCaoService');
const baoCaoKtxSvc = require('../services/baoCaoKtxService');
const baoCaoAnhCccdSvc = require('../services/baoCaoAnhCccdService');
const db = require('../utils/db');

function toThangNam(req) {
  const thang = parseInt(req.query.thang, 10);
  const nam = parseInt(req.query.nam, 10);
  if (!Number.isInteger(thang) || thang < 1 || thang > 12
      || !Number.isInteger(nam) || nam < 2020 || nam > 2100) {
    const e = new Error('Tháng/năm không hợp lệ');
    e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
  }
  return { thang, nam };
}

const router = Router();

// Bỏ dấu tiếng Việt + gọn về chuỗi an toàn cho tên file
function slugify(raw) {
  return String(raw || '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'tat-ca';
}

router.get('/danh-sach-cong-nhan',
  requireRole('admin', 'ke_toan', 'quan_ly'),
  scopeByRole,
  asyncWrapper(async (req, res) => {
    const { cong_ty_id, chua_nghi, loai } = req.query;
    const congTyId = cong_ty_id && cong_ty_id !== 'all' ? parseInt(cong_ty_id, 10) : null;
    if (cong_ty_id && cong_ty_id !== 'all' && (!Number.isInteger(congTyId) || congTyId <= 0)) {
      const e = new Error('cong_ty_id không hợp lệ');
      e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
    }
    const chuaNghi = chua_nghi === 'true' || chua_nghi === '1';
    const loaiCongNhan = ['chinh_thuc', 'thoi_vu'].includes(loai) ? loai : undefined;

    const rows = await congNhanModel.findForExport({
      scope: req.scope, congTyId, chuaNghi, loaiCongNhan,
    });

    // Tên công ty cho tiêu đề + tên file (khi lọc đúng 1 công ty)
    let tenCongTy = null;
    if (congTyId) {
      const ct = await db.query('SELECT ten_cong_ty FROM cong_ty WHERE id = $1', [congTyId]);
      tenCongTy = ct.rows[0]?.ten_cong_ty ?? null;
    }

    const buffer = await baoCaoSvc.buildDanhSachCongNhan(rows, { tenCongTy, chuaNghi, loaiCongNhan });

    const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `danh-sach-cong-nhan_${slugify(tenCongTy)}_${ts}.xlsx`;
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(buffer));
  }),
);

// Xuất Excel ẢNH CCCD — nhúng ảnh 2 mặt, lọc theo công ty + tháng vào làm.
router.get('/anh-cccd',
  requireRole('admin', 'ke_toan', 'quan_ly'),
  scopeByRole,
  asyncWrapper(async (req, res) => {
    const { cong_ty_id } = req.query;
    const congTyId = cong_ty_id && cong_ty_id !== 'all' ? parseInt(cong_ty_id, 10) : null;
    if (cong_ty_id && cong_ty_id !== 'all' && (!Number.isInteger(congTyId) || congTyId <= 0)) {
      const e = new Error('cong_ty_id không hợp lệ');
      e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
    }
    const { thang, nam } = toThangNam(req);

    const rows = await congNhanModel.findCccdImagesForExport({
      scope: req.scope, congTyId, thang, nam,
    });

    let tenCongTy = null;
    if (congTyId) {
      const ct = await db.query('SELECT ten_cong_ty FROM cong_ty WHERE id = $1', [congTyId]);
      tenCongTy = ct.rows[0]?.ten_cong_ty ?? null;
    }

    const buffer = await baoCaoAnhCccdSvc.buildAnhCccd(rows, { tenCongTy, thang, nam });

    const fileName = `anh-cccd_${slugify(tenCongTy)}_T${thang}-${nam}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(buffer));
  }),
);

// Hóa đơn KTX theo tháng — kỳ tính từ ngày đầu tháng đến ngày cuối tháng.
// Truy cập theo quyền KTX (admin hoặc user được cấp quyen_ktx).
router.get('/hoa-don-ktx',
  requireKtxAccess,
  asyncWrapper(async (req, res) => {
    const { thang, nam } = toThangNam(req);
    const report = await ktxModel.findHoaDonKtxReport(thang, nam);
    const buffer = await baoCaoKtxSvc.buildHoaDonKtx(report, { thang, nam });

    const fileName = `hoa-don-ktx_T${thang}-${nam}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(buffer));
  }),
);

module.exports = router;
