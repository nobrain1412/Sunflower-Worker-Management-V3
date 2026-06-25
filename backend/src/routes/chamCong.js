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
router.get('/', requireRole('admin', 'quan_ly', 'ke_toan', 'vender', 'cong_tac_vien'),
  asyncWrapper(async (req, res) => {
    const thang = toPositiveInt(req.query.thang, 'Tháng');
    const nam   = toPositiveInt(req.query.nam,   'Năm');
    if (thang < 1 || thang > 12) {
      const e = new Error('Tháng phải từ 1-12');
      e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
    }
    const congTyId    = req.query.cong_ty_id    ? toPositiveInt(req.query.cong_ty_id, 'Công ty') : null;
    const nguoiTuyen  = req.query.nguoi_tuyen_id ? toPositiveInt(req.query.nguoi_tuyen_id, 'Người tuyển') : null;

    const rows = await chamCongModel.findThangByScope({
      thang, nam, scope: req.scope, cong_ty_id: congTyId, nguoi_tuyen_id: nguoiTuyen,
    });
    sendSuccess(res, rows);
  }),
);

// Kiểm tra quyền xem bảng công của 1 công nhân theo scope của user.
// - admin/ke_toan (type 'all'): xem tất cả
// - quan_ly (type 'cong_ty'): chỉ CN thuộc công ty mình quản lý
// - vender/cong_tac_vien (type 'vender'/'nguoi_tuyen'): chỉ CN mình tuyển
async function assertCanViewCongNhan(req, congNhanId) {
  const cnRes = await db.query(
    `SELECT cong_ty_id, nguoi_tuyen_id FROM cong_nhan WHERE id = $1 AND deleted_at IS NULL`,
    [congNhanId],
  );
  const cn = cnRes.rows[0];
  if (!cn) { const e = new Error('Không tìm thấy công nhân'); e.statusCode = 404; throw e; }

  const scope = req.scope;
  let allowed = scope?.type === 'all';
  if (!allowed && scope?.type === 'cong_ty') {
    allowed = Array.isArray(scope.ids) && cn.cong_ty_id != null && scope.ids.includes(cn.cong_ty_id);
  }
  if (!allowed && (scope?.type === 'vender' || scope?.type === 'nguoi_tuyen')) {
    allowed = cn.nguoi_tuyen_id === scope.userId;
  }
  if (!allowed) {
    const e = new Error('Bạn không có quyền xem bảng công của công nhân này');
    e.statusCode = 403; throw e;
  }
}

// GET /api/cham-cong/cong-nhan/:congNhanId?thang=&nam=
router.get('/cong-nhan/:congNhanId',
  asyncWrapper(async (req, res) => {
    const congNhanId = toPositiveInt(req.params.congNhanId, 'ID công nhân');
    const thang = toPositiveInt(req.query.thang, 'Tháng');
    const nam   = toPositiveInt(req.query.nam,   'Năm');

    await assertCanViewCongNhan(req, congNhanId);

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
  ngay:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ (định dạng YYYY-MM-DD)'),
  // 4 loại giờ — hành chính / tăng ca × ca ngày / ca đêm
  gio_hc_ngay: z.number().min(0).max(24).optional(),
  gio_tc_ngay: z.number().min(0).max(24).optional(),
  gio_hc_dem:  z.number().min(0).max(24).optional(),
  gio_tc_dem:  z.number().min(0).max(24).optional(),
  // Giữ tương thích ngược với client cũ (so_gio = HC ngày, so_gio_ot = TC ngày)
  so_gio:      z.number().min(0).max(24).optional(),
  so_gio_ot:   z.number().min(0).max(24).optional(),
  // Mốc giờ chấm (giờ đến / nghỉ trưa / về) — string 'HH:MM', để trống = null
  gio_den:       z.string().max(8).nullable().optional(),
  gio_nghi_trua: z.string().max(8).nullable().optional(),
  gio_ve:        z.string().max(8).nullable().optional(),
  ca_lam:      z.string().max(20).nullable().optional(),
  ghi_chu:     z.string().max(500).nullable().optional(),
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
    const { cong_nhan_id, cong_ty_id, ho_ten, nguoi_tuyen_id, ten_cong_ty } = meta.rows[0];

    // Quản lý chỉ được chấm công cho CN thuộc công ty mình quản lý
    if (req.scope?.type === 'cong_ty') {
      const ok = Array.isArray(req.scope.ids) && cong_ty_id != null && req.scope.ids.includes(cong_ty_id);
      if (!ok) {
        const e = new Error('Bạn không có quyền chấm công cho công nhân này');
        e.statusCode = 403; throw e;
      }
    }

    const result = await chamCongModel.upsertBatch(phan_cong_id, entries);

    // Ghi 1 activity log cho cả batch — log thường, không cần làm phiền admin
    await hoatDongLog.create({
      loai: 'cham_cong_batch',
      muc_do: 'thuong',
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
      const isNghiViec = nghi.ca_lam === 'nghi_viec';
      await hoatDongLog.create({
        loai: isNghiViec ? 'bao_nghi_viec' : 'bao_nghi_phep',
        // Nghỉ việc là sự kiện đáng chú ý, nghỉ phép thì là routine
        muc_do: isNghiViec ? 'quan_trong' : 'thuong',
        cong_nhan_id,
        nguoi_tuyen_id,
        du_lieu: { ngay: nghi.ngay, ca_lam: nghi.ca_lam, cong_ty: ten_cong_ty },
        ghi_chu: `${ho_ten} ${isNghiViec ? 'nghỉ việc' : 'nghỉ phép'} ngày ${nghi.ngay}`,
        created_by: req.user.id,
      });
    }

    sendSuccess(res, result, 'Đã lưu chấm công');
  }),
);

module.exports = router;
