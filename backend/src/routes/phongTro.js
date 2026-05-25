/**
 * Phòng trọ routes — quản lý các căn trọ thuê ngoài
 */
const { Router } = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess, sendCreated } = require('../utils/response');
const model = require('../models/phongTroModel');

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

const createSchema = z.object({
  ten:         z.string().min(1).max(200),
  dia_chi:     z.string().max(1000).optional(),
  map_url:     z.string().max(2000).optional(),
  chu_tro:     z.string().max(200).optional(),
  sdt_chu_tro: z.string().max(20).optional(),
  so_phong:    z.number().int().nonnegative().optional(),
  tien_phong:  z.number().nonnegative().optional(),
  ghi_chu:     z.string().max(1000).optional(),
  media_urls:  z.array(z.string().url()).max(50).optional(),
  // Tài khoản ngân hàng chủ trọ
  ngan_hang:    z.string().max(100).optional(),
  so_tai_khoan: z.string().max(50).optional(),
  ten_chu_tk:   z.string().max(100).optional(),
});

const updateSchema = createSchema.extend({
  active: z.boolean().optional(),
}).partial();

const ganSchema = z.object({
  cong_nhan_id: z.number().int().positive(),
  ngay_vao:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ghi_chu:      z.string().max(500).optional(),
});

const traSchema = z.object({
  ngay_ra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Nhà trọ riêng tư: chỉ admin hoặc người tạo mới được xem/sửa/xoá 1 nhà trọ cụ thể.
async function assertCanAccess(req, id) {
  const data = await model.findById(id);
  if (!data) { const e = new Error('Không tìm thấy phòng trọ'); e.statusCode = 404; throw e; }
  const isAdmin = req.user.vai_tro === 'admin';
  if (!isAdmin && data.nguoi_tao_id !== req.user.id) {
    const e = new Error('Bạn không có quyền truy cập nhà trọ này');
    e.statusCode = 403; throw e;
  }
  return data;
}

// ─── CRUD phong_tro ───────────────────────────────────────
router.get('/', requireRole('admin', 'quan_ly', 'vender'), asyncWrapper(async (req, res) => {
  const scope = { isAdmin: req.user.vai_tro === 'admin', userId: req.user.id };
  const data = await model.findAll({ active: req.query.active, scope });
  sendSuccess(res, data);
}));

router.get('/:id', requireRole('admin', 'quan_ly', 'vender'), asyncWrapper(async (req, res) => {
  const data = await assertCanAccess(req, toPositiveInt(req.params.id, 'ID phòng trọ'));
  sendSuccess(res, data);
}));

router.post('/', requireRole('admin', 'quan_ly', 'vender'),
  validate(createSchema),
  asyncWrapper(async (req, res) => {
    // Gắn người tạo để áp quyền riêng tư
    const data = await model.create({ ...req.validatedBody, nguoi_tao_id: req.user.id });
    sendCreated(res, data, 'Tạo phòng trọ thành công');
  }),
);

router.put('/:id', requireRole('admin', 'quan_ly', 'vender'),
  validate(updateSchema),
  asyncWrapper(async (req, res) => {
    const id = toPositiveInt(req.params.id, 'ID phòng trọ');
    await assertCanAccess(req, id);
    const data = await model.update(id, req.validatedBody);
    if (!data) { const e = new Error('Không tìm thấy phòng trọ'); e.statusCode = 404; throw e; }
    sendSuccess(res, data, 'Cập nhật thành công');
  }),
);

router.delete('/:id', requireRole('admin', 'quan_ly', 'vender'), asyncWrapper(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'ID phòng trọ');
  await assertCanAccess(req, id);
  const data = await model.remove(id);
  if (!data) { const e = new Error('Không tìm thấy phòng trọ'); e.statusCode = 404; throw e; }
  sendSuccess(res, null, 'Đã xoá phòng trọ');
}));

// ─── Thuê phòng trọ ───────────────────────────────────────
router.get('/:id/thue', requireRole('admin', 'quan_ly', 'vender'), asyncWrapper(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'ID phòng trọ');
  await assertCanAccess(req, id);
  const data = await model.listThue(id);
  sendSuccess(res, data);
}));

router.post('/:id/thue', requireRole('admin', 'quan_ly', 'vender'),
  validate(ganSchema),
  asyncWrapper(async (req, res) => {
    const id = toPositiveInt(req.params.id, 'ID phòng trọ');
    await assertCanAccess(req, id);
    const data = await model.ganCongNhan({
      ...req.validatedBody,
      phong_tro_id: id,
    });
    sendCreated(res, data, 'Đã gán công nhân vào phòng trọ');
  }),
);

router.put('/thue/:thueId/tra', requireRole('admin', 'quan_ly', 'vender'),
  validate(traSchema),
  asyncWrapper(async (req, res) => {
    const data = await model.traPhong(
      toPositiveInt(req.params.thueId, 'ID thuê phòng trọ'),
      req.validatedBody.ngay_ra,
    );
    if (!data) { const e = new Error('Không tìm thấy bản ghi thuê đang active'); e.statusCode = 404; throw e; }
    sendSuccess(res, data, 'Đã trả phòng');
  }),
);

module.exports = router;
