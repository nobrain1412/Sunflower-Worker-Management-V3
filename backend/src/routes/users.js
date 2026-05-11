const { Router } = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const asyncWrapper = require('../utils/asyncWrapper');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendSuccess, sendCreated } = require('../utils/response');
const userModel = require('../models/userModel');

const router = Router();

router.use(authenticate);

// GET /api/users/venders — danh sách user có thể tuyển CN
router.get('/venders', requireRole('admin', 'quan_ly'), asyncWrapper(async (_req, res) => {
  const result = await db.query(
    `SELECT id, ho_ten, vai_tro
     FROM users
     WHERE active = TRUE
     ORDER BY ho_ten`,
  );
  sendSuccess(res, result.rows);
}));

// GET /api/users — danh sách toàn bộ user (admin)
router.get('/', requireRole('admin'), asyncWrapper(async (req, res) => {
  const rows = await userModel.findAll({ vai_tro: req.query.vai_tro });
  sendSuccess(res, rows);
}));

// GET /api/users/cong-tac-vien — danh sách CTV (admin) — kèm tổng tiền
router.get('/cong-tac-vien', requireRole('admin'), asyncWrapper(async (_req, res) => {
  const rows = await userModel.findAll({ vai_tro: 'cong_tac_vien' });
  const enriched = rows.map((u) => ({
    ...u,
    tong_tien_cong: Number(u.so_cn_tuyen || 0) * Number(u.tien_cong_moi_nguoi || 0),
  }));
  sendSuccess(res, enriched);
}));

// GET /api/users/:id — chi tiết
router.get('/:id', requireRole('admin'), asyncWrapper(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const user = await userModel.findById(id);
  if (!user) { const e = new Error('Không tìm thấy user'); e.statusCode = 404; throw e; }
  user.cong_ty_ids = await userModel.findCongTyIds(id);
  sendSuccess(res, user);
}));

const createSchema = z.object({
  ten_dang_nhap:        z.string().min(3).max(50),
  mat_khau:             z.string().min(6).max(100),
  ho_ten:               z.string().min(2).max(100),
  vai_tro:              z.enum(userModel.ROLE_VALUES),
  so_dien_thoai:        z.string().max(20).optional(),
  ngan_hang:            z.string().max(100).optional(),
  so_tai_khoan:         z.string().max(50).optional(),
  ten_chu_tk:           z.string().max(100).optional(),
  tien_cong_moi_nguoi:  z.number().nonnegative().optional(),
  cong_ty_ids:          z.array(z.number().int().positive()).optional(),
});

// POST /api/users — tạo user mới (admin)
router.post('/', requireRole('admin'), validate(createSchema), asyncWrapper(async (req, res) => {
  const body = req.validatedBody;
  // Check duplicate username
  const exist = await userModel.findByUsername(body.ten_dang_nhap);
  if (exist) { const e = new Error('Tên đăng nhập đã tồn tại'); e.statusCode = 409; throw e; }
  const hash = await bcrypt.hash(body.mat_khau, 10);
  const user = await userModel.create({ ...body, mat_khau_hash: hash });
  if (body.cong_ty_ids?.length) {
    await userModel.setCongTyIds(user.id, body.cong_ty_ids);
  }
  sendCreated(res, user, 'Tạo user thành công');
}));

const updateSchema = z.object({
  ho_ten:               z.string().min(2).max(100).optional(),
  vai_tro:              z.enum(userModel.ROLE_VALUES).optional(),
  active:               z.boolean().optional(),
  so_dien_thoai:        z.string().max(20).optional(),
  ngan_hang:            z.string().max(100).optional(),
  so_tai_khoan:         z.string().max(50).optional(),
  ten_chu_tk:           z.string().max(100).optional(),
  tien_cong_moi_nguoi:  z.number().nonnegative().optional(),
  mat_khau:             z.string().min(6).max(100).optional(),
  cong_ty_ids:          z.array(z.number().int().positive()).optional(),
});

// PUT /api/users/:id — cập nhật (admin)
router.put('/:id', requireRole('admin'), validate(updateSchema), asyncWrapper(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const body = { ...req.validatedBody };
  if (body.mat_khau) {
    const u = await userModel.update(id, {});
    if (!u) { const e = new Error('Không tìm thấy user'); e.statusCode = 404; throw e; }
    const hash = await bcrypt.hash(body.mat_khau, 10);
    await db.query(`UPDATE users SET mat_khau_hash = $1 WHERE id = $2`, [hash, id]);
    delete body.mat_khau;
  }
  const congTyIds = body.cong_ty_ids;
  delete body.cong_ty_ids;
  const updated = await userModel.update(id, body);
  if (!updated) { const e = new Error('Không tìm thấy user'); e.statusCode = 404; throw e; }
  if (Array.isArray(congTyIds)) {
    await userModel.setCongTyIds(id, congTyIds);
  }
  sendSuccess(res, updated, 'Cập nhật thành công');
}));

// DELETE /api/users/:id — xoá vĩnh viễn (admin)
router.delete('/:id', requireRole('admin'), asyncWrapper(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (req.user.id === id) {
    const e = new Error('Không thể tự xoá tài khoản của chính bạn');
    e.statusCode = 400; throw e;
  }
  let r;
  try {
    r = await userModel.hardDelete(id);
  } catch (error) {
    if (error.code === '23503') {
      const e = new Error('User đang có dữ liệu liên kết (công nhân, giao dịch...). Vui lòng xoá hoặc chuyển dữ liệu liên quan trước.');
      e.statusCode = 409;
      e.code = 'USER_HAS_RELATIONS';
      throw e;
    }
    throw error;
  }
  if (!r) { const e = new Error('Không tìm thấy user'); e.statusCode = 404; throw e; }
  sendSuccess(res, null, 'Đã xoá user');
}));

module.exports = router;
