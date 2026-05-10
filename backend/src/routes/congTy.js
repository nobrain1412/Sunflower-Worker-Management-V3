const { Router } = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { requireRole, blockVender } = require('../middleware/auth');
const ctrl = require('../controllers/congTyController');

const router = Router();

const taoMoiSchema = z.object({
  ten_cong_ty:    z.string().min(2).max(200),
  dia_chi:        z.string().max(500).optional(),
  so_dien_thoai:  z.string().max(20).optional(),
  email:          z.string().email('Email không hợp lệ').optional(),
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
  // Vender / trợ cấp
  don_gia_theo_gio_vender: z.number().nonnegative().optional(),
  tro_cap:                 z.number().nonnegative().optional(),
  chuyen_can:              z.number().nonnegative().optional(),
  ngay_chot_cong:          z.number().int().min(1).max(31).optional(),
  // Mô tả công việc + media (ảnh/video URL)
  mo_ta_cong_viec: z.string().max(5000).optional(),
  media_urls:      z.array(z.string().url()).max(50).optional(),
  ghi_chu:        z.string().max(1000).optional(),
});

const capNhatSchema = taoMoiSchema.extend({
  active: z.boolean().optional(),
}).partial();

// Vender không được xem thông tin công ty
router.use(blockVender);

// Xem: admin và quan_ly
router.get('/',    requireRole('admin', 'quan_ly'), ctrl.getDanhSach);
router.get('/:id', requireRole('admin', 'quan_ly'), ctrl.getChiTiet);

// Tạo/sửa: chỉ admin
router.post('/',    requireRole('admin'), validate(taoMoiSchema),  ctrl.postTaoMoi);
router.put('/:id',  requireRole('admin'), validate(capNhatSchema), ctrl.putCapNhat);

// Vô hiệu hoá công ty (active = FALSE)
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');
const congTyModel = require('../models/congTyModel');
router.delete('/:id', requireRole('admin'), asyncWrapper(async (req, res) => {
  const data = await congTyModel.update(parseInt(req.params.id, 10), { active: false });
  if (!data) { const e = new Error('Không tìm thấy công ty'); e.statusCode = 404; throw e; }
  sendSuccess(res, null, 'Đã vô hiệu hoá công ty');
}));

// Quản lý phân công: chỉ admin
router.post('/:id/quan-ly',           requireRole('admin'), ctrl.postGanQuanLy);
router.delete('/:id/quan-ly/:userId', requireRole('admin'), ctrl.deleteGoQuanLy);

module.exports = router;
