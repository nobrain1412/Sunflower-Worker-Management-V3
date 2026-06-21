const { Router } = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/congTyController');

const router = Router();

function toPositiveInt(value, fieldName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const e = new Error(`${fieldName} không hợp lệ`);
    e.statusCode = 400;
    e.code = 'VALIDATION_ERROR';
    throw e;
  }
  return parsed;
}

const taoMoiSchema = z.object({
  ten_cong_ty:    z.string().min(2).max(200),
  dia_chi:        z.string().max(500).optional(),
  map_url:        z.string().url('Link Google Maps không hợp lệ').optional().or(z.literal('')),
  so_dien_thoai:  z.string().max(20).optional().or(z.literal('')),
  email:          z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  luong_co_ban:   z.number().nonnegative().optional(),
  luong_theo_gio: z.number().nonnegative().optional(),
  he_so_ot:       z.number().min(1).max(5).optional(),
  ngay_lam_chuan: z.number().int().min(1).max(31).optional(),
  // 5 mức tăng ca
  luong_tc_ngay:  z.number().nonnegative().optional(),
  luong_hc_dem:   z.number().nonnegative().optional(),
  luong_tc_dem:   z.number().nonnegative().optional(),
  luong_chu_nhat: z.number().nonnegative().optional(),
  luong_ngay_le:  z.number().nonnegative().optional(),
  // Khấu trừ mặc định
  tien_dong_phuc: z.number().nonnegative().optional(),
  tien_phat_nghi: z.number().nonnegative().optional(),
  // Trợ cấp (đơn giá vender theo từng cặp user×công ty nằm ở /api/cong-ty/:id/rates)
  tro_cap:                 z.number().nonnegative().optional(),
  chuyen_can:              z.number().nonnegative().optional(),
  ngay_chot_cong:          z.number().int().min(1).max(31).optional(),
  tien_cong_quan_ly_theo_gio: z.number().nonnegative().optional(),
  // Mô tả công việc + media (ảnh/video URL)
  mo_ta_cong_viec: z.string().max(5000).optional(),
  media_urls:      z.array(z.string().url()).max(50).optional(),
  ghi_chu:        z.string().max(1000).optional(),
});

const capNhatSchema = taoMoiSchema.extend({
  active: z.boolean().optional(),
}).partial();

// Xem: mọi role authenticated (kể cả vender, CTV) — chỉ thông tin chung
router.get('/',    authenticate, ctrl.getDanhSach);
router.get('/:id', authenticate, ctrl.getChiTiet);

// Tạo/sửa: admin + kế toán (kế toán được quyền quản lý công ty)
router.post('/',    requireRole('admin', 'ke_toan'), validate(taoMoiSchema),  ctrl.postTaoMoi);
router.put('/:id',  requireRole('admin', 'ke_toan'), validate(capNhatSchema), ctrl.putCapNhat);

// Xoá thật công ty (admin + kế toán) — kèm toàn bộ dữ liệu phụ thuộc
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');
const congTyModel = require('../models/congTyModel');
router.delete('/:id', requireRole('admin', 'ke_toan'), asyncWrapper(async (req, res) => {
  const data = await congTyModel.hardDelete(toPositiveInt(req.params.id, 'ID công ty'));
  if (!data) { const e = new Error('Không tìm thấy công ty'); e.statusCode = 404; throw e; }
  sendSuccess(res, null, 'Đã xoá công ty');
}));

// Quản lý phân công: admin + kế toán
router.post('/:id/quan-ly',           requireRole('admin', 'ke_toan'), ctrl.postGanQuanLy);
router.delete('/:id/quan-ly/:userId', requireRole('admin', 'ke_toan'), ctrl.deleteGoQuanLy);

// ─── Đơn giá thưởng theo (user × công ty) ────────────────────
// GET    /api/cong-ty/:id/rates              — danh sách rate của 1 công ty
// PUT    /api/cong-ty/:id/rates/:userId      — set/update rate
// DELETE /api/cong-ty/:id/rates/:userId      — xoá rate
const rateSchema = z.object({
  don_gia_theo_gio:    z.number().nonnegative().optional(),
  tien_cong_moi_nguoi: z.number().nonnegative().optional(),
});

router.get('/:id/rates',
  requireRole('admin', 'quan_ly', 'ke_toan'),
  asyncWrapper(async (req, res) => {
    const id = toPositiveInt(req.params.id, 'ID công ty');
    const rows = await congTyModel.findRatesByCongTy(id);
    sendSuccess(res, rows);
  }),
);

router.put('/:id/rates/:userId',
  requireRole('admin', 'ke_toan'),
  validate(rateSchema),
  asyncWrapper(async (req, res) => {
    const congTyId = toPositiveInt(req.params.id, 'ID công ty');
    const userId   = toPositiveInt(req.params.userId, 'ID user');
    const row = await congTyModel.upsertRate({
      user_id: userId,
      cong_ty_id: congTyId,
      don_gia_theo_gio:    req.validatedBody.don_gia_theo_gio    ?? 0,
      tien_cong_moi_nguoi: req.validatedBody.tien_cong_moi_nguoi ?? 0,
    });
    sendSuccess(res, row, 'Cập nhật đơn giá thành công');
  }),
);

router.delete('/:id/rates/:userId',
  requireRole('admin', 'ke_toan'),
  asyncWrapper(async (req, res) => {
    const congTyId = toPositiveInt(req.params.id, 'ID công ty');
    const userId   = toPositiveInt(req.params.userId, 'ID user');
    const r = await congTyModel.deleteRate(userId, congTyId);
    if (!r) { const e = new Error('Không tìm thấy rate'); e.statusCode = 404; throw e; }
    sendSuccess(res, null, 'Đã xoá đơn giá');
  }),
);

module.exports = router;
