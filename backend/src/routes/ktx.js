/**
 * KTX routes — ky_tuc_xa, phong, giuong, thue_phong, hoa_don_ktx
 */
const { Router } = require('express');
const { z } = require('zod');
const validate       = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');
const asyncWrapper   = require('../utils/asyncWrapper');
const { sendSuccess, sendCreated } = require('../utils/response');
const ktxModel = require('../models/ktxModel');

const router = Router();

// ─── KY_TUC_XA ────────────────────────────────────────────
router.get('/', requireRole('admin'), asyncWrapper(async (_req, res) => {
  const data = await ktxModel.findAllKtx();
  sendSuccess(res, data);
}));

router.post('/', requireRole('admin'),
  validate(z.object({ ten: z.string().min(1).max(100), dia_chi: z.string().max(500).optional(), ghi_chu: z.string().optional() })),
  asyncWrapper(async (req, res) => {
    const data = await ktxModel.createKtx(req.validatedBody);
    sendCreated(res, data, 'Tạo khu KTX thành công');
  }),
);

// Vô hiệu hoá KTX (active = FALSE)
router.delete('/:id', requireRole('admin'), asyncWrapper(async (req, res) => {
  const data = await ktxModel.updateKtx(parseInt(req.params.id, 10), { active: false });
  if (!data) { const e = new Error('Không tìm thấy KTX'); e.statusCode = 404; throw e; }
  sendSuccess(res, null, 'Đã vô hiệu hoá KTX');
}));

router.put('/:id', requireRole('admin'),
  validate(z.object({ ten: z.string().min(1).max(100).optional(), dia_chi: z.string().max(500).optional(), ghi_chu: z.string().optional(), active: z.boolean().optional() })),
  asyncWrapper(async (req, res) => {
    const data = await ktxModel.updateKtx(parseInt(req.params.id, 10), req.validatedBody);
    if (!data) { const e = new Error('Không tìm thấy KTX'); e.statusCode = 404; throw e; }
    sendSuccess(res, data, 'Cập nhật thành công');
  }),
);

// ─── PHONG ────────────────────────────────────────────────
router.get('/:ktxId/phong', requireRole('admin'), asyncWrapper(async (req, res) => {
  const data = await ktxModel.findPhongByKtx(parseInt(req.params.ktxId, 10));
  sendSuccess(res, data);
}));

const phongSchema = z.object({
  ktx_id:    z.number().int().positive(),
  ten_phong: z.string().min(1).max(20),
  tang:      z.number().int().min(1).max(50).optional(),
  suc_chua:  z.number().int().min(1).max(20).optional(),
  tien_phong: z.number().nonnegative().optional(),
  ghi_chu:   z.string().optional(),
});

router.post('/:ktxId/phong', requireRole('admin'),
  validate(phongSchema.omit({ ktx_id: true })),
  asyncWrapper(async (req, res) => {
    const data = await ktxModel.createPhong({
      ...req.validatedBody,
      ktx_id: parseInt(req.params.ktxId, 10),
    });
    sendCreated(res, data, 'Thêm phòng thành công');
  }),
);

router.put('/phong/:phongId', requireRole('admin'),
  validate(phongSchema.omit({ ktx_id: true }).partial()),
  asyncWrapper(async (req, res) => {
    const data = await ktxModel.updatePhong(parseInt(req.params.phongId, 10), req.validatedBody);
    if (!data) { const e = new Error('Không tìm thấy phòng'); e.statusCode = 404; throw e; }
    sendSuccess(res, data, 'Cập nhật phòng thành công');
  }),
);

router.delete('/phong/:phongId', requireRole('admin'), asyncWrapper(async (req, res) => {
  const data = await ktxModel.deletePhong(parseInt(req.params.phongId, 10));
  if (!data) { const e = new Error('Không tìm thấy phòng'); e.statusCode = 404; throw e; }
  sendSuccess(res, null, 'Đã xoá phòng');
}));

// ─── GIUONG (xem chi tiết phòng) ──────────────────────────
router.get('/phong/:phongId/giuong', requireRole('admin'), asyncWrapper(async (req, res) => {
  const data = await ktxModel.findGiuongByPhong(parseInt(req.params.phongId, 10));
  sendSuccess(res, data);
}));

// ─── THUE_PHONG ────────────────────────────────────────────
const xepSchema = z.object({
  cong_nhan_id: z.number().int().positive(),
  ngay_vao:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.post('/giuong/:giuongId/xep', requireRole('admin'),
  validate(xepSchema),
  asyncWrapper(async (req, res) => {
    const data = await ktxModel.xepGiuong(
      req.validatedBody.cong_nhan_id,
      parseInt(req.params.giuongId, 10),
      req.validatedBody.ngay_vao,
    );
    sendCreated(res, data, 'Xếp giường thành công');
  }),
);

router.put('/thue-phong/:id/tra', requireRole('admin'),
  validate(z.object({ ngay_ra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })),
  asyncWrapper(async (req, res) => {
    const data = await ktxModel.traPhong(
      parseInt(req.params.id, 10),
      req.validatedBody.ngay_ra,
    );
    if (!data) { const e = new Error('Không tìm thấy bản ghi thuê phòng'); e.statusCode = 404; throw e; }
    sendSuccess(res, data, 'Trả phòng thành công');
  }),
);

// Lịch sử thuê phòng của 1 công nhân
router.get('/lich-su/:congNhanId', requireRole('admin'), asyncWrapper(async (req, res) => {
  const data = await ktxModel.findThuephongByCongNhan(parseInt(req.params.congNhanId, 10));
  sendSuccess(res, data);
}));

// ─── HOA_DON_KTX ───────────────────────────────────────────
router.get('/phong/:phongId/hoa-don', requireRole('admin'), asyncWrapper(async (req, res) => {
  const data = await ktxModel.findHoaDonByPhong(parseInt(req.params.phongId, 10));
  sendSuccess(res, data);
}));

// Lấy số điện/nước tháng trước để điền sẵn
router.get('/phong/:phongId/hoa-don/thang-truoc', requireRole('admin'), asyncWrapper(async (req, res) => {
  const { thang, nam } = req.query;
  const data = await ktxModel.findSoThangTruoc(
    parseInt(req.params.phongId, 10),
    parseInt(thang, 10),
    parseInt(nam, 10),
  );
  sendSuccess(res, data);
}));

const hoaDonSchema = z.object({
  thang:       z.number().int().min(1).max(12),
  nam:         z.number().int().min(2020).max(2100),
  dien_cu:     z.number().nonnegative(),
  dien_moi:    z.number().nonnegative(),
  don_gia_dien: z.number().nonnegative(),
  nuoc_cu:     z.number().nonnegative(),
  nuoc_moi:    z.number().nonnegative(),
  don_gia_nuoc: z.number().nonnegative(),
  tien_phong:  z.number().nonnegative(),
  ghi_chu:     z.string().optional(),
});

router.post('/phong/:phongId/hoa-don', requireRole('admin'),
  validate(hoaDonSchema),
  asyncWrapper(async (req, res) => {
    const data = await ktxModel.createHoaDon({
      ...req.validatedBody,
      phong_id: parseInt(req.params.phongId, 10),
    });
    sendCreated(res, data, 'Lưu hóa đơn thành công');
  }),
);

module.exports = router;
