/**
 * Tài chính routes — sổ thu/chi cá nhân của từng user.
 *
 * Quy tắc:
 *   - Mỗi user có sổ riêng → chỉ thấy/sửa/xoá giao dịch do chính mình tạo.
 *   - Admin/quan_ly/ke_toan KHÔNG can thiệp sổ của user khác.
 *   - Danh mục thu/chi: dùng chung danh mục mặc định hệ thống + danh mục riêng của
 *     từng user. User chỉ sửa/xoá được danh mục của chính mình.
 *   - Vender chỉ tạo được khoản 'tam_ung' và chỉ với CN do mình tuyển.
 *
 * Vì là sổ cá nhân, route chặn cong_tac_vien (đã bị blockVender) — các role còn lại
 * đều được vào sổ của mình. Riêng ke_toan: không tham gia ghi sổ tài chính cá nhân.
 */
const { Router } = require('express');
const { z } = require('zod');
const validate       = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const asyncWrapper   = require('../utils/asyncWrapper');
const { sendSuccess, sendCreated, sendForbidden } = require('../utils/response');
const model = require('../models/taiChinhModel');

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

// User có sổ tài chính cá nhân: admin, quan_ly, vender, cong_tac_vien.
// (CTV cần ghi sổ tạm ứng cho CN mình tuyển.) ke_toan không có sổ riêng.
function allowOwnLedger(req, res, next) {
  const v = req.user?.vai_tro;
  if (v === 'admin' || v === 'quan_ly' || v === 'vender' || v === 'cong_tac_vien') return next();
  return sendForbidden(res, 'Bạn không có sổ tài chính cá nhân');
}

router.use(authenticate, allowOwnLedger);

const LOAI_VALUES = [
  // Mới: 3 nhóm chính
  'thu','chi','tieu',
  // Cũ (giữ tương thích)
  'luong','thuong','phu_cap','hoan_ung',
  'khau_tru','tam_ung','tien_phong_ktx',
  'bao_hiem','dong_phuc','phat_nghi','khac',
];

// ─── DANH MỤC (riêng từng user) ───────────────────────────
// Trả về danh mục hệ thống + của chính user
router.get('/danh-muc', asyncWrapper(async (req, res) => {
  const data = await model.findAllDanhMuc(req.query.loai, req.user.id);
  sendSuccess(res, data);
}));

router.post('/danh-muc',
  validate(z.object({
    ten:   z.string().min(1).max(100),
    loai:  z.enum(['thu', 'chi', 'tieu']),
    mo_ta: z.string().optional(),
  })),
  asyncWrapper(async (req, res) => {
    const data = await model.createDanhMuc(req.validatedBody, req.user.id);
    sendCreated(res, data, 'Tạo danh mục thành công');
  }),
);

router.put('/danh-muc/:id',
  validate(z.object({
    ten:    z.string().min(1).max(100).optional(),
    loai:   z.enum(['thu', 'chi', 'tieu']).optional(),
    mo_ta:  z.string().optional(),
    active: z.boolean().optional(),
  })),
  asyncWrapper(async (req, res) => {
    const id = toPositiveInt(req.params.id, 'ID danh mục');
    const existing = await model.findDanhMucById(id);
    if (!existing) { const e = new Error('Không tìm thấy danh mục'); e.statusCode = 404; throw e; }
    // Chỉ chủ danh mục mới được sửa; không ai được sửa danh mục hệ thống
    if (existing.user_id !== req.user.id) {
      return sendForbidden(res, 'Bạn chỉ có thể sửa danh mục của chính mình');
    }
    const data = await model.updateDanhMuc(id, req.validatedBody);
    sendSuccess(res, data, 'Cập nhật thành công');
  }),
);

router.delete('/danh-muc/:id', asyncWrapper(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'ID danh mục');
  const existing = await model.findDanhMucById(id);
  if (!existing) { const e = new Error('Không tìm thấy danh mục'); e.statusCode = 404; throw e; }
  if (existing.user_id !== req.user.id) {
    return sendForbidden(res, 'Bạn chỉ có thể xoá danh mục của chính mình');
  }
  await model.deleteDanhMuc(id);
  sendSuccess(res, null, 'Đã xoá danh mục');
}));

// ─── GIAO DỊCH ────────────────────────────────────────────
// LUÔN filter theo created_by = user hiện tại — kể cả admin.
router.get('/', asyncWrapper(async (req, res) => {
  const page  = Math.max(1, toPositiveInt(req.query.page || '1', 'Trang'));
  const limit = Math.min(100, Math.max(1, toPositiveInt(req.query.limit || '50', 'Giới hạn')));
  const { rows, total } = await model.findAll({
    page, limit,
    thang:       req.query.thang ? toPositiveInt(req.query.thang, 'Tháng') : undefined,
    nam:         req.query.nam   ? toPositiveInt(req.query.nam, 'Năm')   : undefined,
    loai:        req.query.loai,
    cong_nhan_id: req.query.cong_nhan_id ? toPositiveInt(req.query.cong_nhan_id, 'ID công nhân') : undefined,
    created_by: req.user.id,
  });
  sendSuccess(res, rows, 'Thành công', 200, {
    page, limit, total, total_pages: Math.ceil(total / limit),
  });
}));

router.get('/tong-theo-thang', asyncWrapper(async (req, res) => {
  const soThang = Math.min(24, Math.max(1, toPositiveInt(req.query.so_thang || '5', 'Số tháng')));
  const data = await model.tongTheoThang(soThang, req.user.id);
  sendSuccess(res, data);
}));

router.get('/tong-thang', asyncWrapper(async (req, res) => {
  const thang = toPositiveInt(req.query.thang || String(new Date().getMonth() + 1), 'Tháng');
  const nam   = toPositiveInt(req.query.nam   || String(new Date().getFullYear()),  'Năm');
  if (thang < 1 || thang > 12) {
    const e = new Error('Tháng không hợp lệ');
    e.statusCode = 400;
    e.code = 'VALIDATION_ERROR';
    throw e;
  }
  const data = await model.tinhTongThang(thang, nam, req.user.id);
  sendSuccess(res, data);
}));

const taoMoiSchema = z.object({
  cong_nhan_id: z.number().int().positive().optional(),
  danh_muc_id:  z.number().int().positive().optional(),
  loai:         z.enum(LOAI_VALUES),
  so_tien:      z.number().positive(),
  ngay:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ghi_chu:      z.string().max(500).optional(),
});

router.post('/',
  validate(taoMoiSchema),
  asyncWrapper(async (req, res) => {
    const { vai_tro, id: userId } = req.user;

    // Phân quyền cho khoản tạm ứng theo CN cụ thể:
    // - vender / cong_tac_vien : chỉ CN mình tuyển
    // - quan_ly                : chỉ CN thuộc công ty mình quản lý
    // - admin                  : không giới hạn
    if (req.validatedBody.loai === 'tam_ung' && req.validatedBody.cong_nhan_id) {
      const db = require('../utils/db');
      const cnId = req.validatedBody.cong_nhan_id;

      if (vai_tro === 'vender' || vai_tro === 'cong_tac_vien') {
        const check = await db.query(
          `SELECT id FROM cong_nhan WHERE id = $1 AND nguoi_tuyen_id = $2 AND deleted_at IS NULL`,
          [cnId, userId],
        );
        if (!check.rows.length) {
          const e = new Error('Bạn chỉ được cho ứng công nhân do mình tuyển');
          e.statusCode = 403; throw e;
        }
      } else if (vai_tro === 'quan_ly') {
        const check = await db.query(
          `SELECT cn.id FROM cong_nhan cn
             JOIN quan_ly_cong_ty qlct ON qlct.cong_ty_id = cn.cong_ty_id
            WHERE cn.id = $1 AND qlct.user_id = $2 AND cn.deleted_at IS NULL`,
          [cnId, userId],
        );
        if (!check.rows.length) {
          const e = new Error('Bạn chỉ được cho ứng công nhân thuộc công ty mình quản lý');
          e.statusCode = 403; throw e;
        }
      }
    }

    // Vender / CTV chỉ được tạo khoản tạm ứng (không các loại khác)
    if ((vai_tro === 'vender' || vai_tro === 'cong_tac_vien')
        && req.validatedBody.loai !== 'tam_ung') {
      const e = new Error('Bạn chỉ được tạo khoản tạm ứng');
      e.statusCode = 403; throw e;
    }

    // Nếu user chỉ định danh_muc_id, danh mục đó phải là của chính họ hoặc danh mục hệ thống
    if (req.validatedBody.danh_muc_id) {
      const dm = await model.findDanhMucById(req.validatedBody.danh_muc_id);
      if (!dm || (dm.user_id !== null && dm.user_id !== userId)) {
        const e = new Error('Danh mục không thuộc sổ của bạn');
        e.statusCode = 403; throw e;
      }
    }

    const data = await model.create({
      ...req.validatedBody,
      created_by: userId,
    });
    sendCreated(res, data, 'Thêm giao dịch thành công');
  }),
);

// Giao dịch của 1 CN.
// - admin / ke_toan       : thấy mọi sổ
// - người tuyển CN         : thấy mọi sổ (vì là chính chủ quản lý CN)
// - role khác (kể cả QL)   : chỉ thấy entries do CHÍNH MÌNH tạo (sổ riêng)
router.get('/cong-nhan/:congNhanId', asyncWrapper(async (req, res) => {
  const cnId   = toPositiveInt(req.params.congNhanId, 'ID công nhân');
  const { vai_tro, id: userId } = req.user;
  const db = require('../utils/db');

  let filterCreatedBy = undefined;
  if (vai_tro !== 'admin' && vai_tro !== 'ke_toan') {
    const check = await db.query(
      `SELECT id FROM cong_nhan WHERE id = $1 AND nguoi_tuyen_id = $2 AND deleted_at IS NULL`,
      [cnId, userId],
    );
    if (!check.rows.length) {
      // Không phải người tuyển → chỉ thấy sổ riêng của mình
      filterCreatedBy = userId;
    }
  }

  const { rows, total } = await model.findAll({
    cong_nhan_id: cnId, limit: 50, created_by: filterCreatedBy,
  });
  sendSuccess(res, rows, 'Thành công', 200, { total });
}));

// Toggle đã hoàn tiền — chỉ chủ giao dịch.
router.patch('/:id/hoan-tien',
  validate(z.object({ da_hoan_tien: z.boolean() })),
  asyncWrapper(async (req, res) => {
    const id = toPositiveInt(req.params.id, 'ID giao dịch');
    const existing = await model.findById(id);
    if (!existing) { const e = new Error('Không tìm thấy giao dịch'); e.statusCode = 404; throw e; }
    if (existing.created_by !== req.user.id) {
      return sendForbidden(res, 'Bạn chỉ có thể chỉnh sổ của chính mình');
    }
    const data = await model.toggleHoanTien(id, req.validatedBody.da_hoan_tien);
    if (!data) {
      const e = new Error('Giao dịch không phải khoản chi — không thể toggle');
      e.statusCode = 400; throw e;
    }
    // Audit khi đánh dấu hoàn (chỉ false → true) — muc_do 'thuong' vì là sổ cá nhân
    if (req.validatedBody.da_hoan_tien && data.cong_nhan_id) {
      try {
        const hoatDongLog = require('../models/hoatDongLogModel');
        const cnRow = await require('../utils/db').query(
          `SELECT nguoi_tuyen_id, ho_ten FROM cong_nhan WHERE id = $1`,
          [data.cong_nhan_id],
        );
        await hoatDongLog.create({
          loai: 'hoan_ung',
          muc_do: 'thuong',
          cong_nhan_id: data.cong_nhan_id,
          nguoi_tuyen_id: cnRow.rows[0]?.nguoi_tuyen_id ?? null,
          du_lieu: {
            giao_dich_id: data.id,
            loai: data.loai,
            so_tien: Number(data.so_tien),
            ngay_hoan: data.ngay_hoan,
          },
          ghi_chu: `Hoàn ứng ${Number(data.so_tien).toLocaleString('vi-VN')}đ cho ${cnRow.rows[0]?.ho_ten ?? 'CN'}`,
          created_by: req.user?.id ?? null,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('hoat_dong_log write failed (hoan_ung):', e.message);
      }
    }
    sendSuccess(res, data, data.da_hoan_tien ? 'Đã đánh dấu hoàn tiền' : 'Đã bỏ đánh dấu hoàn tiền');
  }),
);

// Xoá giao dịch — chỉ chủ giao dịch.
router.delete('/:id', asyncWrapper(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'ID giao dịch');
  const existing = await model.findById(id);
  if (!existing) { const e = new Error('Không tìm thấy giao dịch'); e.statusCode = 404; throw e; }
  if (existing.created_by !== req.user.id) {
    return sendForbidden(res, 'Bạn chỉ có thể xoá khỏi sổ của chính mình');
  }
  await model.deleteOne(id);
  sendSuccess(res, null, 'Đã xoá giao dịch');
}));

module.exports = router;
