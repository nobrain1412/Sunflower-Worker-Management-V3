const { Router } = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const asyncWrapper = require('../utils/asyncWrapper');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendSuccess, sendCreated } = require('../utils/response');
const userModel = require('../models/userModel');
const congTyModel = require('../models/congTyModel');

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

router.use(authenticate);

// GET /api/users/venders — danh sách user có thể tuyển CN
router.get('/venders', requireRole('admin', 'quan_ly'), asyncWrapper(async (_req, res) => {
  const result = await db.query(
    `SELECT id, ho_ten, vai_tro, ma_vender
     FROM users
     WHERE active = TRUE
     ORDER BY ho_ten`,
  );
  sendSuccess(res, result.rows);
}));

// GET /api/users/assignable — danh sách user tối thiểu (id, ho_ten, vai_tro)
// Dùng cho dropdown gán việc todo. Mọi user authenticated đều xem được.
router.get('/assignable', asyncWrapper(async (_req, res) => {
  const result = await db.query(
    `SELECT id, ho_ten, vai_tro
     FROM users WHERE active = TRUE ORDER BY ho_ten`,
  );
  sendSuccess(res, result.rows);
}));

// GET /api/users — danh sách toàn bộ user (admin + kế toán)
// Kế toán cần đọc danh sách quản lý/vender/CTV để quản lý công ty (gán quản lý, đơn giá).
router.get('/', requireRole('admin', 'ke_toan'), asyncWrapper(async (req, res) => {
  const rows = await userModel.findAll({ vai_tro: req.query.vai_tro });
  sendSuccess(res, rows);
}));

// GET /api/users/cong-tac-vien — admin xem tất cả, quản lý xem CTV của mình
router.get('/cong-tac-vien', requireRole('admin', 'quan_ly'), asyncWrapper(async (req, res) => {
  const quanLyId = req.user.vai_tro === 'quan_ly' ? req.user.id : undefined;
  const rows = await userModel.findCongTacVien({ quanLyId });
  sendSuccess(res, rows);
}));

// GET /api/users/cong-tac-vien/:id/cong-nhan — danh sách CN CTV tuyển kèm stats thanh toán
router.get('/cong-tac-vien/:id/cong-nhan', requireRole('admin', 'quan_ly'),
  asyncWrapper(async (req, res) => {
    const id = toPositiveInt(req.params.id, 'ID cộng tác viên');
    // Quản lý chỉ xem CTV mình quản lý
    if (req.user.vai_tro === 'quan_ly') {
      const own = await db.query(
        `SELECT 1 FROM users WHERE id = $1 AND quan_ly_id = $2`,
        [id, req.user.id],
      );
      if (!own.rows[0]) {
        const e = new Error('Bạn không quản lý CTV này');
        e.statusCode = 403; throw e;
      }
    }
    const data = await userModel.findCongNhanCuaCtv(id);
    if (!data) { const e = new Error('Không tìm thấy CTV'); e.statusCode = 404; throw e; }
    sendSuccess(res, data);
  }),
);

// POST /api/users/cong-tac-vien/:id/thanh-toan
router.post('/cong-tac-vien/:id/thanh-toan',
  requireRole('admin', 'quan_ly'),
  validate(z.object({
    hinh_thuc: z.enum(['mot_lan', 'hang_thang']).optional(),
    thang: z.number().int().min(1).max(12).optional(),
    nam: z.number().int().min(2020).max(2100).optional(),
    ghi_chu: z.string().max(1000).optional(),
  })),
  asyncWrapper(async (req, res) => {
    const ctvId = toPositiveInt(req.params.id, 'ID cộng tác viên');
    const targetUser = await userModel.findById(ctvId);
    if (!targetUser || targetUser.vai_tro !== 'cong_tac_vien') {
      const e = new Error('Không tìm thấy cộng tác viên');
      e.statusCode = 404;
      throw e;
    }
    if (req.user.vai_tro === 'quan_ly' && targetUser.quan_ly_id !== req.user.id) {
      const e = new Error('Bạn chỉ được thao tác cộng tác viên thuộc quyền quản lý');
      e.statusCode = 403;
      throw e;
    }

    const payload = req.validatedBody;
    const hinhThuc = payload.hinh_thuc || targetUser.hinh_thuc_thanh_toan || 'mot_lan';
    const ketQua = await userModel.thanhToanCongTacVien({
      ctvId,
      hinhThuc,
      thang: payload.thang,
      nam: payload.nam,
      ghiChu: payload.ghi_chu,
      createdBy: req.user.id,
    });
    sendSuccess(res, ketQua, 'Tạo kỳ thanh toán thành công');
  }),
);

// GET /api/users/:id — chi tiết
router.get('/:id', requireRole('admin'), asyncWrapper(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'ID user');
  const user = await userModel.findById(id);
  if (!user) { const e = new Error('Không tìm thấy user'); e.statusCode = 404; throw e; }
  user.cong_ty_ids = await userModel.findCongTyIds(id);
  // Danh sách công ty đang quản lý (kèm tên) — hiển thị ở trang chi tiết
  user.cong_ty_quan_ly = await userModel.findCongTyQuanLy(id);
  sendSuccess(res, user);
}));

// GET /api/users/:id/rates — đơn giá thưởng theo từng công ty
router.get('/:id/rates', requireRole('admin', 'quan_ly', 'ke_toan'),
  asyncWrapper(async (req, res) => {
    const id = toPositiveInt(req.params.id, 'ID user');
    const rows = await congTyModel.findRatesByUser(id);
    sendSuccess(res, rows);
  }),
);

// PUT /api/users/:id/rates/:congTyId — set rate
const rateSchema = z.object({
  don_gia_theo_gio:    z.number().nonnegative().optional(),
  tien_cong_moi_nguoi: z.number().nonnegative().optional(),
});
router.put('/:id/rates/:congTyId', requireRole('admin'),
  validate(rateSchema),
  asyncWrapper(async (req, res) => {
    const userId   = toPositiveInt(req.params.id, 'ID user');
    const congTyId = toPositiveInt(req.params.congTyId, 'ID công ty');
    const row = await congTyModel.upsertRate({
      user_id: userId,
      cong_ty_id: congTyId,
      don_gia_theo_gio:    req.validatedBody.don_gia_theo_gio    ?? 0,
      tien_cong_moi_nguoi: req.validatedBody.tien_cong_moi_nguoi ?? 0,
    });
    sendSuccess(res, row, 'Cập nhật đơn giá thành công');
  }),
);
router.delete('/:id/rates/:congTyId', requireRole('admin'),
  asyncWrapper(async (req, res) => {
    const userId   = toPositiveInt(req.params.id, 'ID user');
    const congTyId = toPositiveInt(req.params.congTyId, 'ID công ty');
    const r = await congTyModel.deleteRate(userId, congTyId);
    if (!r) { const e = new Error('Không tìm thấy rate'); e.statusCode = 404; throw e; }
    sendSuccess(res, null, 'Đã xoá đơn giá');
  }),
);

const createSchema = z.object({
  ten_dang_nhap:        z.string().min(3).max(50),
  mat_khau:             z.string().min(6).max(100),
  ho_ten:               z.string().min(2).max(100),
  vai_tro:              z.enum(userModel.ROLE_VALUES),
  so_dien_thoai:        z.string().max(20).optional(),
  ngan_hang:            z.string().max(100).optional(),
  so_tai_khoan:         z.string().max(50).optional(),
  ten_chu_tk:           z.string().max(100).optional(),
  hinh_thuc_thanh_toan: z.enum(['mot_lan', 'hang_thang']).optional(),
  ma_vender:            z.string().max(50).optional().or(z.literal('')),
  cong_ty_ids:          z.array(z.number().int().positive()).optional(),
});

// POST /api/users — tạo user mới (admin/quan_ly)
router.post('/', requireRole('admin', 'quan_ly'), validate(createSchema), asyncWrapper(async (req, res) => {
  const body = req.validatedBody;
  if (req.user.vai_tro === 'quan_ly' && body.vai_tro !== 'cong_tac_vien') {
    const e = new Error('Quản lý chỉ được tạo tài khoản cộng tác viên');
    e.statusCode = 403;
    throw e;
  }
  // Check duplicate username
  const exist = await userModel.findByUsername(body.ten_dang_nhap);
  if (exist) { const e = new Error('Tên đăng nhập đã tồn tại'); e.statusCode = 409; throw e; }
  const hash = await bcrypt.hash(body.mat_khau, 10);
  const createPayload = { ...body, mat_khau_hash: hash };
  if (req.user.vai_tro === 'quan_ly') {
    createPayload.quan_ly_id = req.user.id;
  }
  const user = await userModel.create(createPayload);
  if (req.user.vai_tro === 'admin' && body.cong_ty_ids?.length) {
    await userModel.setCongTyIds(user.id, body.cong_ty_ids);
  }
  sendCreated(res, user, 'Tạo user thành công');
}));

const updateSchema = z.object({
  ten_dang_nhap:        z.string().min(3).max(50).optional(),
  ho_ten:               z.string().min(2).max(100).optional(),
  vai_tro:              z.enum(userModel.ROLE_VALUES).optional(),
  active:               z.boolean().optional(),
  so_dien_thoai:        z.string().max(20).optional(),
  ngan_hang:            z.string().max(100).optional(),
  so_tai_khoan:         z.string().max(50).optional(),
  ten_chu_tk:           z.string().max(100).optional(),
  hinh_thuc_thanh_toan: z.enum(['mot_lan', 'hang_thang']).optional(),
  ma_vender:            z.string().max(50).optional().or(z.literal('')),
  quyen_ktx:            z.boolean().optional(),
  mat_khau:             z.string().min(6).max(100).optional(),
  cong_ty_ids:          z.array(z.number().int().positive()).optional(),
});

// PUT /api/users/:id — cập nhật (admin/quan_ly với CTV của mình)
router.put('/:id', requireRole('admin', 'quan_ly'), validate(updateSchema), asyncWrapper(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'ID user');
  const body = { ...req.validatedBody };
  const targetUser = await userModel.findById(id);
  if (!targetUser) { const e = new Error('Không tìm thấy user'); e.statusCode = 404; throw e; }
  // Đổi tên đăng nhập: chỉ admin, và phải đảm bảo không trùng user khác.
  // Lưu ý: nguoi_tuyen_id của công nhân gán theo user.id nên đổi tên KHÔNG ảnh hưởng CN đã gán.
  if (body.ten_dang_nhap && body.ten_dang_nhap !== targetUser.ten_dang_nhap) {
    if (req.user.vai_tro !== 'admin') {
      const e = new Error('Chỉ admin được đổi tên đăng nhập'); e.statusCode = 403; throw e;
    }
    const dup = await db.query(
      `SELECT 1 FROM users WHERE LOWER(ten_dang_nhap) = LOWER($1) AND id <> $2`,
      [body.ten_dang_nhap, id],
    );
    if (dup.rows.length) {
      const e = new Error('Tên đăng nhập đã tồn tại'); e.statusCode = 409; e.code = 'DUPLICATE_USERNAME'; throw e;
    }
  }
  if (req.user.vai_tro === 'quan_ly') {
    if (targetUser.vai_tro !== 'cong_tac_vien' || targetUser.quan_ly_id !== req.user.id) {
      const e = new Error('Bạn chỉ được sửa cộng tác viên thuộc quyền quản lý');
      e.statusCode = 403;
      throw e;
    }
    // Quản lý không được đổi tên đăng nhập của CTV
    delete body.ten_dang_nhap;
    if (body.vai_tro && body.vai_tro !== 'cong_tac_vien') {
      const e = new Error('Quản lý không được thay đổi vai trò khỏi cộng tác viên');
      e.statusCode = 403;
      throw e;
    }
  }
  if (body.mat_khau) {
    const hash = await bcrypt.hash(body.mat_khau, 10);
    await db.query(`UPDATE users SET mat_khau_hash = $1 WHERE id = $2`, [hash, id]);
    delete body.mat_khau;
  }
  const congTyIds = body.cong_ty_ids;
  delete body.cong_ty_ids;
  if (req.user.vai_tro === 'quan_ly') {
    delete body.vai_tro;
    delete body.active;
    delete body.quyen_ktx; // chỉ admin được cấp quyền KTX
    body.quan_ly_id = req.user.id;
  }
  const updated = await userModel.update(id, body);
  if (!updated) { const e = new Error('Không tìm thấy user'); e.statusCode = 404; throw e; }
  if (req.user.vai_tro === 'admin' && Array.isArray(congTyIds)) {
    await userModel.setCongTyIds(id, congTyIds);
  }
  sendSuccess(res, updated, 'Cập nhật thành công');
}));

// DELETE /api/users/:id — xoá vĩnh viễn (admin/quan_ly với CTV của mình)
router.delete('/:id', requireRole('admin', 'quan_ly'), asyncWrapper(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'ID user');
  if (req.user.id === id) {
    const e = new Error('Không thể tự xoá tài khoản của chính bạn');
    e.statusCode = 400; throw e;
  }
  if (req.user.vai_tro === 'quan_ly') {
    const targetUser = await userModel.findById(id);
    if (!targetUser) { const e = new Error('Không tìm thấy user'); e.statusCode = 404; throw e; }
    if (targetUser.vai_tro !== 'cong_tac_vien' || targetUser.quan_ly_id !== req.user.id) {
      const e = new Error('Bạn chỉ được xoá cộng tác viên thuộc quyền quản lý');
      e.statusCode = 403;
      throw e;
    }
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
