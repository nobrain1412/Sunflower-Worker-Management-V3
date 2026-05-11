/**
 * Tài chính routes — giao_dich_tai_chinh, danh_muc_giao_dich
 */
const { Router } = require('express');
const { z } = require('zod');
const validate       = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');
const asyncWrapper   = require('../utils/asyncWrapper');
const { sendSuccess, sendCreated } = require('../utils/response');
const model = require('../models/taiChinhModel');

const router = Router();

const LOAI_VALUES = [
  // Mới: 3 nhóm chính
  'thu','chi','tieu',
  // Cũ (giữ tương thích)
  'luong','thuong','phu_cap','hoan_ung',
  'khau_tru','tam_ung','tien_phong_ktx',
  'bao_hiem','dong_phuc','phat_nghi','khac',
];

// ─── DANH MỤC ─────────────────────────────────────────────
router.get('/danh-muc', requireRole('admin', 'quan_ly', 'vender'), asyncWrapper(async (req, res) => {
  const data = await model.findAllDanhMuc(req.query.loai);
  sendSuccess(res, data);
}));

router.post('/danh-muc', requireRole('admin'),
  validate(z.object({
    ten:   z.string().min(1).max(100),
    loai:  z.enum(['thu', 'chi', 'tieu']),
    mo_ta: z.string().optional(),
  })),
  asyncWrapper(async (req, res) => {
    const data = await model.createDanhMuc(req.validatedBody);
    sendCreated(res, data, 'Tạo danh mục thành công');
  }),
);

router.put('/danh-muc/:id', requireRole('admin'),
  validate(z.object({
    ten:    z.string().min(1).max(100).optional(),
    loai:   z.enum(['thu', 'chi', 'tieu']).optional(),
    mo_ta:  z.string().optional(),
    active: z.boolean().optional(),
  })),
  asyncWrapper(async (req, res) => {
    const data = await model.updateDanhMuc(parseInt(req.params.id, 10), req.validatedBody);
    if (!data) { const e = new Error('Không tìm thấy danh mục'); e.statusCode = 404; throw e; }
    sendSuccess(res, data, 'Cập nhật thành công');
  }),
);

// ─── GIAO DỊCH ────────────────────────────────────────────
router.get('/', requireRole('admin', 'quan_ly', 'vender'), asyncWrapper(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
  const createdBy = req.user.vai_tro === 'vender' ? req.user.id : undefined;
  const { rows, total } = await model.findAll({
    page, limit,
    thang:       req.query.thang ? parseInt(req.query.thang, 10) : undefined,
    nam:         req.query.nam   ? parseInt(req.query.nam, 10)   : undefined,
    loai:        req.query.loai,
    cong_nhan_id: req.query.cong_nhan_id ? parseInt(req.query.cong_nhan_id, 10) : undefined,
    created_by: createdBy,
  });
  sendSuccess(res, rows, 'Thành công', 200, {
    page, limit, total, total_pages: Math.ceil(total / limit),
  });
}));

router.get('/tong-theo-thang', requireRole('admin', 'quan_ly', 'vender'), asyncWrapper(async (req, res) => {
  const soThang = Math.min(24, Math.max(1, parseInt(req.query.so_thang || '5', 10)));
  if (req.user.vai_tro === 'vender') {
    const now = new Date();
    const data = [];
    for (let i = soThang - 1; i >= 0; i -= 1) {
      const current = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const thang = current.getMonth() + 1;
      const nam = current.getFullYear();
      const { rows } = await model.findAll({
        page: 1,
        limit: 1000,
        thang,
        nam,
        created_by: req.user.id,
      });
      const thu = rows
        .filter((g) => model.LOAI_THU.includes(g.loai))
        .reduce((sum, g) => sum + Number(g.so_tien || 0), 0);
      const chi = rows
        .filter((g) => model.LOAI_CHI.includes(g.loai) && !g.da_hoan_tien)
        .reduce((sum, g) => sum + Number(g.so_tien || 0), 0);
      data.push({ thang, nam, thu, chi });
    }
    return sendSuccess(res, data);
  }
  const data = await model.tongTheoThang(soThang);
  sendSuccess(res, data);
}));

router.get('/tong-thang', requireRole('admin', 'quan_ly', 'vender'), asyncWrapper(async (req, res) => {
  const thang = parseInt(req.query.thang || new Date().getMonth() + 1, 10);
  const nam   = parseInt(req.query.nam   || new Date().getFullYear(),  10);
  if (req.user.vai_tro === 'vender') {
    const { rows } = await model.findAll({
      page: 1,
      limit: 1000,
      thang,
      nam,
      created_by: req.user.id,
    });
    const tong_thu = rows
      .filter((g) => model.LOAI_THU.includes(g.loai))
      .reduce((sum, g) => sum + Number(g.so_tien || 0), 0);
    const tong_chi = rows
      .filter((g) => model.LOAI_CHI.includes(g.loai) && !g.da_hoan_tien)
      .reduce((sum, g) => sum + Number(g.so_tien || 0), 0);
    const da_hoan = rows
      .filter((g) => model.LOAI_CHI.includes(g.loai) && g.da_hoan_tien)
      .reduce((sum, g) => sum + Number(g.so_tien || 0), 0);
    return sendSuccess(res, { tong_thu, tong_chi, da_hoan });
  }
  const data  = await model.tinhTongThang(thang, nam);
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

router.post('/', requireRole('admin', 'quan_ly', 'vender'),
  validate(taoMoiSchema),
  asyncWrapper(async (req, res) => {
    const { vai_tro, id: userId } = req.user;

    // Vender chỉ được tạo khoản tạm ứng (tam_ung) cho CN mình tuyển
    if (vai_tro === 'vender') {
      if (req.validatedBody.loai !== 'tam_ung') {
        const e = new Error('Vender chỉ được tạo khoản tạm ứng');
        e.statusCode = 403; throw e;
      }
      if (req.validatedBody.cong_nhan_id) {
        // Kiểm tra CN có phải do vender này tuyển không
        const db = require('../utils/db');
        const check = await db.query(
          `SELECT id FROM cong_nhan WHERE id = $1 AND nguoi_tuyen_id = $2 AND deleted_at IS NULL`,
          [req.validatedBody.cong_nhan_id, userId],
        );
        if (!check.rows.length) {
          const e = new Error('Bạn không có quyền tạo ứng tiền cho công nhân này');
          e.statusCode = 403; throw e;
        }
      }
    }

    const data = await model.create({
      ...req.validatedBody,
      created_by: userId,
    });
    sendCreated(res, data, 'Thêm giao dịch thành công');
  }),
);

// Xem giao dịch của 1 CN (vender chỉ được xem CN mình tuyển)
router.get('/cong-nhan/:congNhanId', requireRole('admin', 'quan_ly', 'vender'), asyncWrapper(async (req, res) => {
  const cnId   = parseInt(req.params.congNhanId, 10);
  const { vai_tro, id: userId } = req.user;

  if (vai_tro === 'vender') {
    const db = require('../utils/db');
    const check = await db.query(
      `SELECT id FROM cong_nhan WHERE id = $1 AND nguoi_tuyen_id = $2 AND deleted_at IS NULL`,
      [cnId, userId],
    );
    if (!check.rows.length) {
      const e = new Error('Không có quyền xem'); e.statusCode = 403; throw e;
    }
  }

  const { rows, total } = await model.findAll({ cong_nhan_id: cnId, limit: 50 });
  sendSuccess(res, rows, 'Thành công', 200, { total });
}));

// Toggle đã hoàn tiền
router.patch('/:id/hoan-tien', requireRole('admin', 'quan_ly'),
  validate(z.object({ da_hoan_tien: z.boolean() })),
  asyncWrapper(async (req, res) => {
    const data = await model.toggleHoanTien(
      parseInt(req.params.id, 10),
      req.validatedBody.da_hoan_tien,
    );
    if (!data) {
      const e = new Error('Không tìm thấy giao dịch chi hoặc không thể toggle');
      e.statusCode = 404; throw e;
    }
    sendSuccess(res, data, data.da_hoan_tien ? 'Đã đánh dấu hoàn tiền' : 'Đã bỏ đánh dấu hoàn tiền');
  }),
);

// Xoá giao dịch (admin/quan_ly)
router.delete('/:id', requireRole('admin', 'quan_ly'),
  asyncWrapper(async (req, res) => {
    const data = await model.deleteOne(parseInt(req.params.id, 10));
    if (!data) {
      const e = new Error('Không tìm thấy giao dịch'); e.statusCode = 404; throw e;
    }
    sendSuccess(res, null, 'Đã xoá giao dịch');
  }),
);

module.exports = router;
