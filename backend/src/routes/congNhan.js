const { Router } = require('express');
const { z } = require('zod');
const path = require('path');
const validate = require('../middleware/validate');
const { authenticate, requireRole, scopeByRole } = require('../middleware/auth');
const { uploadAnhCongNhan } = require('../middleware/upload');
const ctrl = require('../controllers/congNhanController');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');
const congNhanModel = require('../models/congNhanModel');
const db = require('../utils/db');

const router = Router();

// --- Zod Schemas ---

// Regex chuẩn CCCD 12 số
const cccdRegex = /^\d{12}$/;
// Số điện thoại VN: 09x / 08x / 07x / 05x / 03x
const sdtRegex  = /^(0[3578]\d{8}|0[6789]\d{8})$/;

const taoMoiSchema = z.object({
  ho_ten:           z.string().min(2, 'Họ tên tối thiểu 2 ký tự').max(100),
  cccd:             z.string().regex(cccdRegex, 'CCCD phải gồm đúng 12 chữ số').optional().or(z.literal('').transform(() => undefined)),
  ngay_sinh:        z.string().date('Ngày sinh không hợp lệ (YYYY-MM-DD)').optional(),
  gioi_tinh:        z.enum(['Nam', 'Nữ', 'Khác']).optional(),
  que_quan:         z.string().max(200).optional(),
  dia_chi_hien_tai: z.string().max(500).optional(),
  so_dien_thoai:    z.string().regex(sdtRegex, 'Số điện thoại không hợp lệ').optional().or(z.literal('').transform(() => undefined)),
  ngay_cap_cccd:    z.string().date('Ngày cấp CCCD không hợp lệ (YYYY-MM-DD)').optional(),
  noi_cap_cccd:     z.string().max(200).optional(),
  trang_thai:       z.enum(['dang_lam', 'nghi_phep', 'moi_vao', 'nghi_viec']).default('moi_vao'),
  ngay_vao_lam:     z.string().date('Ngày vào làm không hợp lệ (YYYY-MM-DD)').optional(),
  ngay_nghi_viec:   z.string().date('Ngày nghỉ không hợp lệ (YYYY-MM-DD)').optional(),
  ghi_chu:          z.string().max(1000).optional(),
  cong_ty_id:       z.number().int().positive().optional(),
  // Admin/quan_ly có thể chỉ định người tuyển; vender bị bỏ qua ở controller
  nguoi_tuyen_id:   z.number().int().positive().optional(),
  da_tra_dong_phuc: z.boolean().optional(),
  da_viet_don_nghi: z.boolean().optional(),
  // Mới: thông tin tài khoản ngân hàng
  ngan_hang:        z.string().max(100).optional(),
  so_tai_khoan:     z.string().max(50).optional(),
  ten_chu_tk:       z.string().max(100).optional(),
  // Mới: trạng thái CCCD đã trả & mượn xe
  cccd_da_tra:      z.boolean().optional(),
  muon_xe:          z.boolean().optional(),
  loai_xe:          z.enum(['xe_dap', 'xe_dien', 'xe_may']).optional().or(z.literal('').transform(() => undefined)),
  xe_da_tra:        z.boolean().optional(),
});

// PUT cho phép partial update (mọi trường optional)
const capNhatSchema = taoMoiSchema.partial();

// --- Routes ---

// Tất cả route yêu cầu đăng nhập + gắn scope
router.use(authenticate, scopeByRole);

// Xem: tất cả role (dữ liệu được lọc theo scope)
router.get('/',    ctrl.getDanhSach);
router.get('/:id', ctrl.getChiTiet);

// Tuyển CN: tất cả role đều được (nguoi_tuyen_id tự động = người đăng nhập)
router.post('/',
  requireRole('admin', 'quan_ly', 'vender'),
  validate(taoMoiSchema),
  ctrl.postTaoMoi,
);

// Cập nhật: chỉ admin và quan_ly
router.put('/:id',
  requireRole('admin', 'quan_ly'),
  validate(capNhatSchema),
  ctrl.putCapNhat,
);

// Xoá: chỉ admin
router.delete('/:id',
  requireRole('admin'),
  ctrl.deleteXoa,
);

// ─── Upload ảnh CCCD + chân dung ─────────────────────────────────────────────
// POST /api/cong-nhan/:id/upload-anh
// Form-data fields: cccd_mat_truoc, cccd_mat_sau, anh_chan_dung (optional)
router.post('/:id/upload-anh',
  requireRole('admin', 'quan_ly'),
  uploadAnhCongNhan,
  asyncWrapper(async (req, res) => {
    const id    = parseInt(req.params.id, 10);
    const files = req.files ?? {};
    const UPLOAD_PATH = '/uploads/anh/'; // URL path served statically

    const update = {};
    if (files.cccd_mat_truoc?.[0]) update.anh_cccd_truoc = UPLOAD_PATH + files.cccd_mat_truoc[0].filename;
    if (files.cccd_mat_sau?.[0])   update.anh_cccd_sau   = UPLOAD_PATH + files.cccd_mat_sau[0].filename;
    if (files.anh_chan_dung?.[0])  update.anh_chan_dung   = UPLOAD_PATH + files.anh_chan_dung[0].filename;

    if (!Object.keys(update).length) {
      const err = new Error('Không có file nào được upload');
      err.statusCode = 400; throw err;
    }

    const cn = await congNhanModel.updateAnh(id, update);
    if (!cn) { const e = new Error('Không tìm thấy công nhân'); e.statusCode = 404; throw e; }
    sendSuccess(res, cn, 'Upload ảnh thành công');
  }),
);

// ─── Tổng hợp cho trang chi tiết: nơi ở (KTX + phòng trọ) + tổng tạm ứng ────
router.get('/:id/noi-o', asyncWrapper(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [ktxRow, ptRow] = await Promise.all([
    db.query(
      `SELECT tp.id AS thue_phong_id, tp.ngay_vao, tp.ngay_ra,
              g.so_thu_tu, p.ten_phong, p.tang, k.ten AS ktx_ten
       FROM thue_phong tp
       JOIN giuong g    ON g.id = tp.giuong_id
       JOIN phong p     ON p.id = g.phong_id
       JOIN ky_tuc_xa k ON k.id = p.ktx_id
       WHERE tp.cong_nhan_id = $1 AND tp.ngay_ra IS NULL
       ORDER BY tp.ngay_vao DESC LIMIT 1`,
      [id],
    ),
    db.query(
      `SELECT tpt.id AS thue_id, tpt.ngay_vao, tpt.ngay_ra,
              pt.id AS phong_tro_id, pt.ten, pt.dia_chi, pt.chu_tro, pt.sdt_chu_tro
       FROM thue_phong_tro tpt
       JOIN phong_tro pt ON pt.id = tpt.phong_tro_id
       WHERE tpt.cong_nhan_id = $1 AND tpt.ngay_ra IS NULL
       ORDER BY tpt.ngay_vao DESC LIMIT 1`,
      [id],
    ),
  ]);
  sendSuccess(res, {
    ktx:       ktxRow.rows[0] ?? null,
    phong_tro: ptRow.rows[0]  ?? null,
  });
}));

router.get('/:id/tong-ung', asyncWrapper(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const taiChinhModel = require('../models/taiChinhModel');
  const data = await taiChinhModel.tinhTongDaUng(id);
  sendSuccess(res, data);
}));

// Phục vụ file ảnh tĩnh (fallback nếu không dùng nginx)
// Đã được mount ở app.js

module.exports = router;
