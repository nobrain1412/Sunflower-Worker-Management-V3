/**
 * Workflow đề xuất công ty:
 *   - POST   /api/cong-ty/de-xuat           — quan_ly/admin submit (tao_moi hoặc sua_doi)
 *   - GET    /api/cong-ty/de-xuat           — list (admin: all, quan_ly: của mình)
 *   - GET    /api/cong-ty/de-xuat/pending-count — đếm cho badge sidebar admin
 *   - GET    /api/cong-ty/de-xuat/:id       — chi tiết
 *   - POST   /api/cong-ty/de-xuat/:id/duyet     — admin duyệt → tạo/sửa công ty
 *   - POST   /api/cong-ty/de-xuat/:id/tu-choi   — admin từ chối
 */
const { Router } = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess, sendCreated } = require('../utils/response');
const db = require('../utils/db');
const deXuatModel = require('../models/congTyDeXuatModel');
const congTyModel = require('../models/congTyModel');

const router = Router();
router.use(authenticate);

function toPositiveInt(value, fieldName) {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id <= 0) {
    const e = new Error(`${fieldName} không hợp lệ`);
    e.statusCode = 400; e.code = 'VALIDATION_ERROR';
    throw e;
  }
  return id;
}

// Cùng schema với taoMoi/capNhat trong congTy.js — duy trì validation thống nhất
const congTyDataSchema = z.object({
  ten_cong_ty:    z.string().min(2).max(200),
  dia_chi:        z.string().max(500).optional(),
  map_url:        z.string().url('Link Google Maps không hợp lệ').optional().or(z.literal('')),
  so_dien_thoai:  z.string().max(20).optional(),
  email:          z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  luong_co_ban:   z.number().nonnegative().optional(),
  luong_theo_gio: z.number().nonnegative().optional(),
  he_so_ot:       z.number().min(1).max(5).optional(),
  ngay_lam_chuan: z.number().int().min(1).max(31).optional(),
  luong_tc_ngay:  z.number().nonnegative().optional(),
  luong_hc_dem:   z.number().nonnegative().optional(),
  luong_tc_dem:   z.number().nonnegative().optional(),
  luong_chu_nhat: z.number().nonnegative().optional(),
  luong_ngay_le:  z.number().nonnegative().optional(),
  tien_dong_phuc: z.number().nonnegative().optional(),
  tien_phat_nghi: z.number().nonnegative().optional(),
  tro_cap:                 z.number().nonnegative().optional(),
  chuyen_can:              z.number().nonnegative().optional(),
  ngay_chot_cong:          z.number().int().min(1).max(31).optional(),
  mo_ta_cong_viec: z.string().max(5000).optional(),
  media_urls:      z.array(z.string().url()).max(50).optional(),
  ghi_chu:        z.string().max(1000).optional(),
});

const submitSchema = z.object({
  loai:        z.enum(['tao_moi', 'sua_doi']),
  cong_ty_id:  z.number().int().positive().optional(),
  du_lieu:     congTyDataSchema.partial(), // sua_doi có thể chỉ gửi field thay đổi
  ghi_chu:     z.string().max(1000).optional(),
});

// Submit đề xuất — quan_ly hoặc admin (admin có thể dùng để track lịch sử)
router.post('/',
  requireRole('admin', 'quan_ly'),
  validate(submitSchema),
  asyncWrapper(async (req, res) => {
    const { loai, cong_ty_id, du_lieu, ghi_chu } = req.validatedBody;

    if (loai === 'sua_doi' && !cong_ty_id) {
      const e = new Error('sua_doi phải kèm cong_ty_id');
      e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
    }
    if (loai === 'tao_moi' && !du_lieu?.ten_cong_ty) {
      const e = new Error('Tên công ty bắt buộc khi tao_moi');
      e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
    }

    // Quản lý chỉ được sửa công ty thuộc quyền mình
    if (loai === 'sua_doi' && req.user.vai_tro === 'quan_ly') {
      const own = await db.query(
        `SELECT 1 FROM quan_ly_cong_ty WHERE user_id = $1 AND cong_ty_id = $2`,
        [req.user.id, cong_ty_id],
      );
      if (own.rows.length === 0) {
        const e = new Error('Bạn không quản lý công ty này');
        e.statusCode = 403; throw e;
      }
    }

    // Kiểm tra công ty tồn tại nếu sua_doi
    if (loai === 'sua_doi') {
      const ct = await db.query(`SELECT id FROM cong_ty WHERE id = $1`, [cong_ty_id]);
      if (ct.rows.length === 0) {
        const e = new Error('Công ty không tồn tại');
        e.statusCode = 404; throw e;
      }
    }

    const data = await deXuatModel.create({
      loai,
      cong_ty_id: cong_ty_id ?? null,
      du_lieu,
      ghi_chu,
      nguoi_de_xuat_id: req.user.id,
    });
    sendCreated(res, data, 'Đã gửi đề xuất chờ admin duyệt');
  }),
);

// List — admin xem tất cả, quan_ly chỉ xem của mình
router.get('/',
  requireRole('admin', 'quan_ly'),
  asyncWrapper(async (req, res) => {
    const filter = {
      trang_thai: req.query.trang_thai,
      cong_ty_id: req.query.cong_ty_id ? toPositiveInt(req.query.cong_ty_id, 'cong_ty_id') : undefined,
    };
    if (req.user.vai_tro === 'quan_ly') {
      filter.nguoi_de_xuat_id = req.user.id;
    }
    const data = await deXuatModel.findAll(filter);
    sendSuccess(res, data);
  }),
);

// Đếm pending — dùng cho badge admin
router.get('/pending-count',
  requireRole('admin'),
  asyncWrapper(async (_req, res) => {
    const n = await deXuatModel.countPending();
    sendSuccess(res, { count: n });
  }),
);

// Chi tiết
router.get('/:id',
  requireRole('admin', 'quan_ly'),
  asyncWrapper(async (req, res) => {
    const id = toPositiveInt(req.params.id, 'ID đề xuất');
    const data = await deXuatModel.findById(id);
    if (!data) { const e = new Error('Không tìm thấy đề xuất'); e.statusCode = 404; throw e; }
    if (req.user.vai_tro === 'quan_ly' && data.nguoi_de_xuat_id !== req.user.id) {
      const e = new Error('Bạn không xem được đề xuất này');
      e.statusCode = 403; throw e;
    }
    sendSuccess(res, data);
  }),
);

// Duyệt — admin
router.post('/:id/duyet',
  requireRole('admin'),
  asyncWrapper(async (req, res) => {
    const id = toPositiveInt(req.params.id, 'ID đề xuất');
    const ghiChuAdmin = req.body?.ghi_chu_admin;

    const dx = await deXuatModel.findById(id);
    if (!dx) { const e = new Error('Không tìm thấy đề xuất'); e.statusCode = 404; throw e; }
    if (dx.trang_thai !== 'cho_duyet') {
      const e = new Error('Đề xuất đã được xử lý'); e.statusCode = 400; throw e;
    }

    // Thực hiện thay đổi trong transaction: tạo/sửa công ty + mark approved
    await db.query('BEGIN');
    try {
      let congTyResult;
      if (dx.loai === 'tao_moi') {
        congTyResult = await congTyModel.create(dx.du_lieu);
      } else {
        congTyResult = await congTyModel.update(dx.cong_ty_id, dx.du_lieu);
        if (!congTyResult) {
          const e = new Error('Công ty cần sửa không tồn tại nữa');
          e.statusCode = 404; throw e;
        }
      }
      const approved = await deXuatModel.markApproved(id, req.user.id, ghiChuAdmin);
      await db.query('COMMIT');
      sendSuccess(res, { de_xuat: approved, cong_ty: congTyResult }, 'Đã duyệt đề xuất');
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  }),
);

// Từ chối — admin
router.post('/:id/tu-choi',
  requireRole('admin'),
  asyncWrapper(async (req, res) => {
    const id = toPositiveInt(req.params.id, 'ID đề xuất');
    const ghiChuAdmin = req.body?.ghi_chu_admin;
    if (!ghiChuAdmin) {
      const e = new Error('Vui lòng nêu lý do từ chối');
      e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
    }
    const rejected = await deXuatModel.markRejected(id, req.user.id, ghiChuAdmin);
    if (!rejected) {
      const e = new Error('Đề xuất không tồn tại hoặc đã xử lý');
      e.statusCode = 400; throw e;
    }
    sendSuccess(res, rejected, 'Đã từ chối đề xuất');
  }),
);

module.exports = router;
