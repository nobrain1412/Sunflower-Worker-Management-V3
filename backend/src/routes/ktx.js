/**
 * KTX routes — ky_tuc_xa, phong, giuong, thue_phong, hoa_don_ktx
 */
const { Router } = require('express');
const { z } = require('zod');
const validate       = require('../middleware/validate');
const { requireKtxAccess } = require('../middleware/auth');
const asyncWrapper   = require('../utils/asyncWrapper');
const { sendSuccess, sendCreated } = require('../utils/response');
const ktxModel = require('../models/ktxModel');

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

// ─── KY_TUC_XA ────────────────────────────────────────────
router.get('/', requireKtxAccess, asyncWrapper(async (_req, res) => {
  const data = await ktxModel.findAllKtx();
  sendSuccess(res, data);
}));

router.post('/', requireKtxAccess,
  validate(z.object({
    ten: z.string().min(1).max(100),
    dia_chi: z.string().max(500).optional(),
    ghi_chu: z.string().optional(),
    media_urls: z.array(z.string().url()).max(50).optional(),
  })),
  asyncWrapper(async (req, res) => {
    const data = await ktxModel.createKtx(req.validatedBody);
    sendCreated(res, data, 'Tạo khu KTX thành công');
  }),
);

// Vô hiệu hoá KTX (active = FALSE)
router.delete('/:id', requireKtxAccess, asyncWrapper(async (req, res) => {
  const data = await ktxModel.updateKtx(toPositiveInt(req.params.id, 'ID KTX'), { active: false });
  if (!data) { const e = new Error('Không tìm thấy KTX'); e.statusCode = 404; throw e; }
  sendSuccess(res, null, 'Đã vô hiệu hoá KTX');
}));

router.put('/:id', requireKtxAccess,
  validate(z.object({
    ten: z.string().min(1).max(100).optional(),
    dia_chi: z.string().max(500).optional(),
    ghi_chu: z.string().optional(),
    media_urls: z.array(z.string().url()).max(50).optional(),
    active: z.boolean().optional(),
  })),
  asyncWrapper(async (req, res) => {
    const data = await ktxModel.updateKtx(toPositiveInt(req.params.id, 'ID KTX'), req.validatedBody);
    if (!data) { const e = new Error('Không tìm thấy KTX'); e.statusCode = 404; throw e; }
    sendSuccess(res, data, 'Cập nhật thành công');
  }),
);

// ─── PHONG ────────────────────────────────────────────────
router.get('/:ktxId/phong', requireKtxAccess, asyncWrapper(async (req, res) => {
  const data = await ktxModel.findPhongByKtx(toPositiveInt(req.params.ktxId, 'ID KTX'));
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

router.post('/:ktxId/phong', requireKtxAccess,
  validate(phongSchema.omit({ ktx_id: true })),
  asyncWrapper(async (req, res) => {
    const data = await ktxModel.createPhong({
      ...req.validatedBody,
      ktx_id: toPositiveInt(req.params.ktxId, 'ID KTX'),
    });
    sendCreated(res, data, 'Thêm phòng thành công');
  }),
);

router.put('/phong/:phongId', requireKtxAccess,
  validate(phongSchema.omit({ ktx_id: true }).partial()),
  asyncWrapper(async (req, res) => {
    const data = await ktxModel.updatePhong(toPositiveInt(req.params.phongId, 'ID phòng'), req.validatedBody);
    if (!data) { const e = new Error('Không tìm thấy phòng'); e.statusCode = 404; throw e; }
    sendSuccess(res, data, 'Cập nhật phòng thành công');
  }),
);

router.delete('/phong/:phongId', requireKtxAccess, asyncWrapper(async (req, res) => {
  const data = await ktxModel.deletePhong(toPositiveInt(req.params.phongId, 'ID phòng'));
  if (!data) { const e = new Error('Không tìm thấy phòng'); e.statusCode = 404; throw e; }
  sendSuccess(res, null, 'Đã xoá phòng');
}));

// ─── GIUONG (xem chi tiết phòng) ──────────────────────────
router.get('/phong/:phongId/giuong', requireKtxAccess, asyncWrapper(async (req, res) => {
  const data = await ktxModel.findGiuongByPhong(toPositiveInt(req.params.phongId, 'ID phòng'));
  sendSuccess(res, data);
}));

// Sửa thông tin giường (số thứ tự, ghi chú)
router.put('/giuong/:giuongId', requireKtxAccess,
  validate(z.object({
    so_thu_tu: z.number().int().min(1).max(50).optional(),
    ghi_chu:   z.string().max(200).nullable().optional(),
  })),
  asyncWrapper(async (req, res) => {
    const data = await ktxModel.updateGiuong(toPositiveInt(req.params.giuongId, 'ID giường'), req.validatedBody);
    if (!data) { const e = new Error('Không tìm thấy giường'); e.statusCode = 404; throw e; }
    sendSuccess(res, data, 'Cập nhật giường thành công');
  }),
);

// ─── THUE_PHONG ────────────────────────────────────────────
const xepSchema = z.object({
  cong_nhan_id: z.number().int().positive(),
  ngay_vao:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày vào không hợp lệ (định dạng YYYY-MM-DD)'),
});

router.post('/giuong/:giuongId/xep', requireKtxAccess,
  validate(xepSchema),
  asyncWrapper(async (req, res) => {
    const data = await ktxModel.xepGiuong(
      req.validatedBody.cong_nhan_id,
      toPositiveInt(req.params.giuongId, 'ID giường'),
      req.validatedBody.ngay_vao,
    );
    sendCreated(res, data, 'Xếp giường thành công');
  }),
);

router.put('/thue-phong/:id/tra', requireKtxAccess,
  validate(z.object({ ngay_ra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày ra không hợp lệ (định dạng YYYY-MM-DD)') })),
  asyncWrapper(async (req, res) => {
    const data = await ktxModel.traPhong(
      toPositiveInt(req.params.id, 'ID thuê phòng'),
      req.validatedBody.ngay_ra,
    );
    if (!data) { const e = new Error('Không tìm thấy bản ghi thuê phòng'); e.statusCode = 404; throw e; }
    sendSuccess(res, data, 'Trả phòng thành công');
  }),
);

// Lịch sử thuê phòng của 1 công nhân
router.get('/lich-su/:congNhanId', requireKtxAccess, asyncWrapper(async (req, res) => {
  const data = await ktxModel.findThuephongByCongNhan(toPositiveInt(req.params.congNhanId, 'ID công nhân'));
  sendSuccess(res, data);
}));

// Danh sách công nhân có thể xếp phòng (chưa có KTX/phòng trọ active)
router.get('/cong-nhan/co-the-xep', requireKtxAccess, asyncWrapper(async (req, res) => {
  const data = await ktxModel.findUngVienXepPhong({
    search: req.query.search,
    limit: req.query.limit,
  });
  sendSuccess(res, data);
}));

// ─── HOA_DON_KTX ───────────────────────────────────────────
router.get('/phong/:phongId/hoa-don', requireKtxAccess, asyncWrapper(async (req, res) => {
  const data = await ktxModel.findHoaDonByPhong(toPositiveInt(req.params.phongId, 'ID phòng'));
  sendSuccess(res, data);
}));

// Lấy số điện/nước tháng trước để điền sẵn
router.get('/phong/:phongId/hoa-don/thang-truoc', requireKtxAccess, asyncWrapper(async (req, res) => {
  const { thang, nam } = req.query;
  const thangNum = toPositiveInt(thang, 'Tháng');
  const namNum = toPositiveInt(nam, 'Năm');
  if (thangNum < 1 || thangNum > 12) {
    const e = new Error('Tháng không hợp lệ');
    e.statusCode = 400;
    e.code = 'VALIDATION_ERROR';
    throw e;
  }
  const data = await ktxModel.findSoThangTruoc(
    toPositiveInt(req.params.phongId, 'ID phòng'),
    thangNum,
    namNum,
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

router.post('/phong/:phongId/hoa-don', requireKtxAccess,
  validate(hoaDonSchema),
  asyncWrapper(async (req, res) => {
    const data = await ktxModel.createHoaDon({
      ...req.validatedBody,
      phong_id: toPositiveInt(req.params.phongId, 'ID phòng'),
    });
    sendCreated(res, data, 'Lưu hóa đơn thành công');
  }),
);

module.exports = router;
