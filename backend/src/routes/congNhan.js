const { Router } = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate, requireRole, scopeByRole } = require('../middleware/auth');
const { uploadAnhCongNhan } = require('../middleware/upload');
const { uploadBuffer } = require('../utils/cloudinary');
const ctrl = require('../controllers/congNhanController');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');
const congNhanModel = require('../models/congNhanModel');
const ktxModel = require('../models/ktxModel');
const phongTroModel = require('../models/phongTroModel');
const db = require('../utils/db');

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

// --- Zod Schemas ---

// Regex chuẩn CCCD 12 số
const cccdRegex = /^\d{12}$/;
// Số điện thoại VN: 09x / 08x / 07x / 05x / 03x
const sdtRegex  = /^(0[3578]\d{8}|0[6789]\d{8})$/;

// Helper: cho phép '' → null (FE thường gửi '' khi user xoá field)
const nullableStr = (max) => z.preprocess(
  (v) => (v === '' || v === null ? null : v),
  z.string().max(max).nullable().optional(),
);
const nullableDate = (msg) => z.preprocess(
  (v) => (v === '' || v === null ? null : v),
  z.string().date(msg).nullable().optional(),
);
const nullableEnum = (values) => z.preprocess(
  (v) => (v === '' || v === null ? null : v),
  z.enum(values).nullable().optional(),
);
const nullableRegex = (re, msg, max = 100) => z.preprocess(
  (v) => (v === '' || v === null ? null : v),
  z.string().regex(re, msg).max(max).nullable().optional(),
);

const taoMoiSchema = z.object({
  ho_ten:           z.string().min(2, 'Họ tên tối thiểu 2 ký tự').max(100),
  cccd:             nullableRegex(cccdRegex, 'CCCD phải gồm đúng 12 chữ số', 12),
  ngay_sinh:        nullableDate('Ngày sinh không hợp lệ (YYYY-MM-DD)'),
  gioi_tinh:        nullableEnum(['Nam', 'Nữ', 'Khác']),
  dia_chi_hien_tai: nullableStr(500),
  so_dien_thoai:    nullableRegex(sdtRegex, 'Số điện thoại không hợp lệ', 20),
  ngay_cap_cccd:    nullableDate('Ngày cấp CCCD không hợp lệ (YYYY-MM-DD)'),
  trang_thai:       z.enum(['dang_lam', 'nghi_phep', 'moi_vao', 'nghi_viec', 'doi_viec', 'cho_duyet']).default('moi_vao'),
  ngay_vao_lam:     nullableDate('Ngày vào làm không hợp lệ (YYYY-MM-DD)'),
  ngay_nghi_viec:   nullableDate('Ngày nghỉ không hợp lệ (YYYY-MM-DD)'),
  ghi_chu:          nullableStr(1000),
  cong_ty_id:       z.number().int().positive().nullable().optional(),
  // Admin/quan_ly có thể chỉ định người tuyển; vender bị bỏ qua ở controller
  nguoi_tuyen_id:   z.number().int().positive().nullable().optional(),
  da_tra_dong_phuc: z.boolean().optional(),
  da_viet_don_nghi: z.boolean().optional(),
  // Thông tin tài khoản ngân hàng
  ngan_hang:        nullableStr(100),
  so_tai_khoan:     nullableStr(50),
  ten_chu_tk:       nullableStr(100),
  // Trạng thái CCCD đã trả & mượn xe
  cccd_da_tra:      z.boolean().optional(),
  trang_thai_noi_o: nullableEnum(['chua_co_phong', 'tu_tuc', 'ktx', 'phong_tro']),
  muon_xe:          z.boolean().optional(),
  loai_xe:          nullableEnum(['xe_dap', 'xe_dien', 'xe_may']),
  xe_da_tra:        z.boolean().optional(),
  ngay_muon_xe:     nullableDate('Ngày mượn xe không hợp lệ (YYYY-MM-DD)'),
  // Mã vân tay máy chấm công
  ma_van_tay:       nullableStr(50),
  // Bộ phận / phòng ban (thường lấy từ import vân tay)
  bo_phan:          nullableStr(100),
  // URL ảnh từ OCR flow — đã upload lên Cloudinary trước khi tạo CN
  anh_cccd_truoc:   nullableStr(500),
  anh_cccd_sau:     nullableStr(500),
  anh_chan_dung:    nullableStr(500),
  // Loại công nhân và thông tin lợi nhuận (chính thức)
  loai_cong_nhan:           z.enum(['thoi_vu', 'chinh_thuc']).default('thoi_vu').optional(),
  loi_nhuan_thang:          z.preprocess(
    (v) => (v === '' || v === null ? null : Number(v)),
    z.number().positive().nullable().optional(),
  ),
  so_thang_huong_loi_nhuan: z.preprocess(
    (v) => (v === '' || v === null ? null : Number(v)),
    z.number().int().positive().nullable().optional(),
  ),
  ngay_chinh_thuc: nullableDate('Ngày chính thức không hợp lệ (YYYY-MM-DD)'),
});

// PUT cho phép partial update (mọi trường optional, chấp nhận null để xoá)
const capNhatSchema = taoMoiSchema.partial();

// Gán công ty hàng loạt
const ganCongTySchema = z.object({
  ids:        z.array(z.number().int().positive()).min(1, 'Chọn ít nhất 1 công nhân').max(500),
  cong_ty_id: z.number().int().positive(),
  // Trạng thái sau khi gán (mặc định xử lý ở service: đợi việc/chờ duyệt → mới vào)
  trang_thai: z.enum(['moi_vao', 'doi_viec', 'dang_lam']).optional(),
});

// --- Routes ---

// Tất cả route yêu cầu đăng nhập + gắn scope
router.use(authenticate, scopeByRole);

// Xem: tất cả role (dữ liệu được lọc theo scope)
router.get('/',    ctrl.getDanhSach);
router.get('/noi-o/truy-cap', asyncWrapper(async (req, res) => {
  const vaiTro = req.user?.vai_tro;
  // Kế toán không cần biết CN ở phòng nào — chỉ cần số tiền để trừ lương
  const ktx = vaiTro === 'admin' ? await ktxModel.findAllKtx() : [];
  const phongTro = await phongTroModel.findAll({ active: true });
  sendSuccess(res, { ktx, phong_tro: phongTro });
}));
router.get('/:id', ctrl.getChiTiet);

// Tuyển CN: tất cả role đều được (nguoi_tuyen_id tự động = người đăng nhập)
router.post('/',
  requireRole('admin', 'quan_ly', 'vender'),
  validate(taoMoiSchema),
  ctrl.postTaoMoi,
);

// Gán công ty hàng loạt cho CN chưa có công ty (admin / quản lý).
// Đặt trước '/:id' để không bị nuốt bởi route param.
router.post('/gan-cong-ty',
  requireRole('admin', 'quan_ly'),
  validate(ganCongTySchema),
  ctrl.postGanCongTy,
);

// Cập nhật: mọi role (scope check ở service layer).
// - admin: tất cả CN
// - quan_ly: CN trong cty mình quản lý
// - vender / cong_tac_vien: CN mình tuyển
router.put('/:id',
  requireRole('admin', 'quan_ly', 'vender', 'cong_tac_vien'),
  validate(capNhatSchema),
  ctrl.putCapNhat,
);

// Duyệt CN đang "đợi việc" → chuyển sang "moi_vao".
// admin: duyệt bất kỳ; quan_ly: chỉ CN thuộc công ty mình (check ở service).
router.post('/:id/duyet',
  requireRole('admin', 'quan_ly'),
  ctrl.postDuyet,
);

// Xoá: admin xoá bất kỳ; vender/CTV chỉ xoá CN mình tuyển khi đang "đợi việc"
// (quyền chi tiết kiểm tra ở service layer theo req.user).
router.delete('/:id',
  requireRole('admin', 'quan_ly', 'vender', 'cong_tac_vien'),
  ctrl.deleteXoa,
);

// ─── Upload ảnh CCCD + chân dung ─────────────────────────────────────────────
// POST /api/cong-nhan/:id/upload-anh
// Form-data fields: cccd_mat_truoc, cccd_mat_sau, anh_chan_dung, anh_xe (optional)
router.post('/:id/upload-anh',
  requireRole('admin', 'quan_ly'),
  uploadAnhCongNhan,
  asyncWrapper(async (req, res) => {
    const id    = toPositiveInt(req.params.id, 'ID công nhân');
    const files = req.files ?? {};

    const toUpload = [
      { field: 'cccd_mat_truoc', key: 'anh_cccd_truoc' },
      { field: 'cccd_mat_sau',   key: 'anh_cccd_sau' },
      { field: 'anh_chan_dung',  key: 'anh_chan_dung' },
      { field: 'anh_xe',         key: 'anh_xe' },
    ].filter(({ field }) => files[field]?.[0]);

    if (!toUpload.length) {
      const err = new Error('Không có file nào được upload');
      err.statusCode = 400; throw err;
    }

    // Chỉ cho upload ảnh xe khi công nhân thực sự có mượn xe
    if (toUpload.some(({ field }) => field === 'anh_xe')) {
      const cnHienTai = await congNhanModel.findById(id);
      if (!cnHienTai) { const e = new Error('Không tìm thấy công nhân'); e.statusCode = 404; throw e; }
      if (!cnHienTai.muon_xe) {
        const e = new Error('Công nhân không mượn xe — không thể upload ảnh xe');
        e.statusCode = 400; e.code = 'VEHICLE_NOT_BORROWED';
        throw e;
      }
    }

    const results = await Promise.all(
      toUpload.map(({ field }) =>
        uploadBuffer(files[field][0].buffer, { folder: 'workeros/anh-cong-nhan' }),
      ),
    );

    const update = {};
    toUpload.forEach(({ key }, i) => { update[key] = results[i].secure_url; });

    const cn = await congNhanModel.updateAnh(id, update);
    if (!cn) { const e = new Error('Không tìm thấy công nhân'); e.statusCode = 404; throw e; }
    sendSuccess(res, cn, 'Upload ảnh thành công');
  }),
);

// ─── Tổng hợp cho trang chi tiết: nơi ở (KTX + phòng trọ) + tổng tạm ứng ────
// Kế toán không thấy chỗ ở cụ thể — chỉ cần biết tiền trọ qua endpoint khác.
router.get('/:id/noi-o', asyncWrapper(async (req, res) => {
  if (req.user?.vai_tro === 'ke_toan') {
    return sendSuccess(res, { ktx: null, phong_tro: null });
  }
  const id = toPositiveInt(req.params.id, 'ID công nhân');
  const [ktxRow, ptRow] = await Promise.all([
    db.query(
      `SELECT tp.id AS thue_phong_id, tp.ngay_vao, tp.ngay_ra,
              g.id AS giuong_id, g.so_thu_tu, p.id AS phong_id, p.ten_phong, p.tang, k.id AS ktx_id, k.ten AS ktx_ten
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
  const id = toPositiveInt(req.params.id, 'ID công nhân');
  // Chỉ admin hoặc người tuyển CN mới xem được tổng tạm ứng
  if (req.user.vai_tro !== 'admin') {
    const db = require('../utils/db');
    const check = await db.query(
      `SELECT 1 FROM cong_nhan WHERE id = $1 AND nguoi_tuyen_id = $2 AND deleted_at IS NULL`,
      [id, req.user.id],
    );
    if (!check.rows.length) {
      // Không cho phép → trả 0 (FE không cần xử lý 403 phức tạp)
      return sendSuccess(res, { tong_ung: 0, con_no: 0 });
    }
  }
  const taiChinhModel = require('../models/taiChinhModel');
  const data = await taiChinhModel.tinhTongDaUng(id);
  sendSuccess(res, data);
}));

// Phục vụ file ảnh tĩnh (fallback nếu không dùng nginx)
// Đã được mount ở app.js

module.exports = router;
