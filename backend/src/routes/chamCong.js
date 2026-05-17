/**
 * Chấm công routes.
 *
 * - GET  /api/cham-cong                      : danh sách CN + chấm công tháng theo scope
 * - GET  /api/cham-cong/cong-nhan/:id        : chi tiết 1 CN (theo phan_cong) trong tháng
 * - POST /api/cham-cong/batch                : upsert nhiều entries cho 1 phan_cong
 *                                              (gửi notify nếu có báo nghỉ_phep/nghỉ_viec)
 */
const { Router } = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate, requireRole, scopeByRole } = require('../middleware/auth');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');
const chamCongModel = require('../models/chamCongModel');
const hoatDongLog = require('../models/hoatDongLogModel');
const db = require('../utils/db');

const router = Router();

function toPositiveInt(value, fieldName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const e = new Error(`${fieldName} không hợp lệ`);
    e.statusCode = 400; e.code = 'VALIDATION_ERROR';
    throw e;
  }
  return parsed;
}

router.use(authenticate, scopeByRole);

// GET /api/cham-cong?thang=&nam=&cong_ty_id=&nguoi_tuyen_id=
router.get('/', requireRole('admin', 'quan_ly'),
  asyncWrapper(async (req, res) => {
    const thang = toPositiveInt(req.query.thang, 'Tháng');
    const nam   = toPositiveInt(req.query.nam,   'Năm');
    if (thang < 1 || thang > 12) {
      const e = new Error('Tháng phải từ 1-12');
      e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
    }
    const congTyId    = req.query.cong_ty_id    ? toPositiveInt(req.query.cong_ty_id, 'cong_ty_id') : null;
    const nguoiTuyen  = req.query.nguoi_tuyen_id ? toPositiveInt(req.query.nguoi_tuyen_id, 'nguoi_tuyen_id') : null;

    const rows = await chamCongModel.findThangByScope({
      thang, nam, scope: req.scope, cong_ty_id: congTyId, nguoi_tuyen_id: nguoiTuyen,
    });
    sendSuccess(res, rows);
  }),
);

// GET /api/cham-cong/cong-nhan/:congNhanId?thang=&nam=
router.get('/cong-nhan/:congNhanId',
  asyncWrapper(async (req, res) => {
    const congNhanId = toPositiveInt(req.params.congNhanId, 'ID công nhân');
    const thang = toPositiveInt(req.query.thang, 'Tháng');
    const nam   = toPositiveInt(req.query.nam,   'Năm');

    const phanCongs = await chamCongModel.findPhanCongByCongNhan(congNhanId, { thang, nam });
    const chiTiet = await Promise.all(
      phanCongs.map(async (pc) => ({
        ...pc,
        cham_cong: await chamCongModel.findByPhanCongThang(pc.id, thang, nam),
      })),
    );
    sendSuccess(res, chiTiet);
  }),
);

const entrySchema = z.object({
  ngay:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  so_gio:     z.number().min(0).max(24).optional(),
  so_gio_ot:  z.number().min(0).max(24).optional(),
  ca_lam:     z.string().max(20).nullable().optional(),
  ghi_chu:    z.string().max(500).nullable().optional(),
});

// POST /api/cham-cong/batch
router.post('/batch', requireRole('admin', 'quan_ly'),
  validate(z.object({
    phan_cong_id: z.number().int().positive(),
    entries:      z.array(entrySchema),
  })),
  asyncWrapper(async (req, res) => {
    const { phan_cong_id, entries } = req.validatedBody;

    // Lấy thông tin phan_cong để biết cong_nhan + nguoi_tuyen + cong_ty
    const meta = await db.query(
      `SELECT pc.cong_nhan_id, pc.cong_ty_id, cn.ho_ten, cn.nguoi_tuyen_id, ct.ten_cong_ty
       FROM phan_cong pc
       JOIN cong_nhan cn ON cn.id = pc.cong_nhan_id
       LEFT JOIN cong_ty ct ON ct.id = pc.cong_ty_id
       WHERE pc.id = $1`,
      [phan_cong_id],
    );
    if (!meta.rows[0]) {
      const e = new Error('Không tìm thấy phân công');
      e.statusCode = 404; throw e;
    }
    const { cong_nhan_id, ho_ten, nguoi_tuyen_id, ten_cong_ty } = meta.rows[0];

    const result = await chamCongModel.upsertBatch(phan_cong_id, entries);

    // Ghi 1 activity log cho cả batch
    await hoatDongLog.create({
      loai: 'cham_cong_batch',
      cong_nhan_id,
      nguoi_tuyen_id,
      du_lieu: {
        phan_cong_id,
        cong_ty: ten_cong_ty,
        so_ngay_them: result.inserted,
        so_ngay_sua:  result.updated,
        so_ngay_xoa:  result.deleted,
      },
      ghi_chu: `Cập nhật chấm công cho ${ho_ten}`,
      created_by: req.user.id,
    });

    // Nếu có báo nghỉ phép / nghỉ việc → 1 log riêng cho từng ngày
    for (const nghi of result.baoNghi) {
      await hoatDongLog.create({
        loai: nghi.ca_lam === 'nghi_viec' ? 'bao_nghi_viec' : 'bao_nghi_phep',
        cong_nhan_id,
        nguoi_tuyen_id,
        du_lieu: { ngay: nghi.ngay, ca_lam: nghi.ca_lam, cong_ty: ten_cong_ty },
        ghi_chu: `${ho_ten} ${nghi.ca_lam === 'nghi_viec' ? 'nghỉ việc' : 'nghỉ phép'} ngày ${nghi.ngay}`,
        created_by: req.user.id,
      });
    }

    sendSuccess(res, result, 'Đã lưu chấm công');
  }),
);

module.exports = router;
