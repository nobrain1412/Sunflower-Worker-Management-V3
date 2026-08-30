/**
 * Routes đề xuất nghỉ việc (phát hiện từ bảng vân tay).
 *
 * Phân quyền: chỉ admin + quan_ly. Quản lý chỉ được xem/tạo/duyệt/từ chối đề xuất
 * thuộc CÔNG TY MÌNH QUẢN LÝ (không mở rộng theo "công nhân do mình tuyển" — duyệt
 * nghỉ việc là việc của quản lý công ty đó).
 *
 *   POST /api/de-xuat-nghi-viec/phan-tich   — dò ứng viên nghỉ (không ghi DB)
 *   POST /api/de-xuat-nghi-viec/tao         — tạo đề xuất cho các CN được chọn
 *   GET  /api/de-xuat-nghi-viec             — danh sách đề xuất (lọc theo scope)
 *   POST /api/de-xuat-nghi-viec/:id/duyet   — duyệt → CN chuyển 'nghi_viec'
 *   POST /api/de-xuat-nghi-viec/:id/tu-choi — từ chối → gỡ đề xuất
 */
const { Router } = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate, requireRole, scopeByRole } = require('../middleware/auth');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess, sendCreated } = require('../utils/response');
const svc = require('../services/nghiViecVanTayService');
const model = require('../models/deXuatNghiViecModel');

const router = Router();

function toPositiveInt(value, fieldName) {
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n <= 0) {
    const e = new Error(`${fieldName} không hợp lệ`);
    e.statusCode = 400; e.code = 'VALIDATION_ERROR';
    throw e;
  }
  return n;
}

// Quản lý chỉ được thao tác trên công ty mình quản lý; admin không giới hạn.
function assertCanManageCongTy(req, congTyId) {
  if (req.user.vai_tro === 'admin') return;
  const ids = req.user.cong_ty_ids ?? [];
  if (!ids.includes(congTyId)) {
    const e = new Error('Bạn không quản lý công ty này');
    e.statusCode = 403; e.code = 'FORBIDDEN';
    throw e;
  }
}

const kySchema = z.object({
  cong_ty_id: z.number().int().positive(),
  thang:      z.number().int().min(1).max(12),
  nam:        z.number().int().min(2000).max(2100),
});

const taoSchema = kySchema.extend({
  // Danh sách CN được chọn để tạo đề xuất; bỏ trống = tất cả ứng viên dò được.
  cong_nhan_ids: z.array(z.number().int().positive()).max(1000).optional(),
});

const ganMaSchema = kySchema.extend({
  cong_nhan_id: z.number().int().positive(),
  ma_van_tay:   z.string().trim().min(1).max(50),
});

const duyetTrucTiepSchema = kySchema.extend({
  cong_nhan_ids: z.array(z.number().int().positive()).min(1).max(1000),
});

const ganMaHangLoatSchema = kySchema.extend({
  items: z.array(z.object({
    cong_nhan_id: z.number().int().positive(),
    ma_van_tay:   z.string().trim().min(1).max(50),
  })).min(1).max(1000),
});

const tuChoiSchema = z.object({
  ghi_chu: z.preprocess((v) => (v === '' ? null : v), z.string().max(500).nullable().optional()),
});

router.use(authenticate);

// Dò ứng viên nghỉ việc từ bảng vân tay đã upload (không ghi DB).
router.post('/phan-tich',
  requireRole('admin', 'quan_ly'),
  validate(kySchema),
  asyncWrapper(async (req, res) => {
    const { cong_ty_id, thang, nam } = req.validatedBody;
    assertCanManageCongTy(req, cong_ty_id);
    const kq = await svc.phanTich(cong_ty_id, thang, nam);
    sendSuccess(res, kq, 'Phân tích thành công');
  }),
);

// Tạo đề xuất nghỉ việc cho các CN được chọn.
router.post('/tao',
  requireRole('admin', 'quan_ly'),
  validate(taoSchema),
  asyncWrapper(async (req, res) => {
    const { cong_ty_id, thang, nam, cong_nhan_ids } = req.validatedBody;
    assertCanManageCongTy(req, cong_ty_id);
    const kq = await svc.taoDeXuat(cong_ty_id, thang, nam, cong_nhan_ids, req.user.id);
    sendCreated(res, kq,
      `Đã tạo ${kq.da_tao} đề xuất nghỉ việc`
      + (kq.da_go ? `, gỡ ${kq.da_go} đề xuất cũ (đã đi làm lại)` : ''));
  }),
);

// Gán mã vân tay cho 1 CN chưa có mã → lưu hồ sơ + đối chiếu kỳ ngay.
router.post('/gan-ma',
  requireRole('admin', 'quan_ly'),
  scopeByRole,
  validate(ganMaSchema),
  asyncWrapper(async (req, res) => {
    const { cong_ty_id, thang, nam, cong_nhan_id, ma_van_tay } = req.validatedBody;
    assertCanManageCongTy(req, cong_ty_id);
    const kq = await svc.ganMaKiemTra(cong_ty_id, thang, nam, cong_nhan_id, ma_van_tay, req.user, req.scope);
    sendSuccess(res, kq,
      kq.la_ung_vien
        ? 'Đã gán mã — công nhân đủ điều kiện nghỉ việc'
        : 'Đã gán mã — công nhân vẫn đang đi làm');
  }),
);

// Duyệt nghỉ việc TRỰC TIẾP cho các CN được tích chọn (không qua hàng đợi đề xuất).
router.post('/duyet-truc-tiep',
  requireRole('admin', 'quan_ly'),
  scopeByRole,
  validate(duyetTrucTiepSchema),
  asyncWrapper(async (req, res) => {
    const { cong_ty_id, thang, nam, cong_nhan_ids } = req.validatedBody;
    assertCanManageCongTy(req, cong_ty_id);
    const kq = await svc.duyetTrucTiep(cong_ty_id, thang, nam, cong_nhan_ids, req.user, req.scope);
    sendSuccess(res, kq, `Đã duyệt nghỉ việc cho ${kq.da_duyet} công nhân`);
  }),
);

// Gán mã + kiểm tra HÀNG LOẠT cho nhiều CN chưa có mã trong 1 lần bấm.
router.post('/gan-ma-hang-loat',
  requireRole('admin', 'quan_ly'),
  scopeByRole,
  validate(ganMaHangLoatSchema),
  asyncWrapper(async (req, res) => {
    const { cong_ty_id, thang, nam, items } = req.validatedBody;
    assertCanManageCongTy(req, cong_ty_id);
    const kq = await svc.ganMaHangLoat(cong_ty_id, thang, nam, items, req.user, req.scope);
    sendSuccess(res, kq, 'Đã kiểm tra hàng loạt');
  }),
);

// Danh sách đề xuất theo trạng thái + scope quyền.
router.get('/',
  requireRole('admin', 'quan_ly'),
  scopeByRole,
  asyncWrapper(async (req, res) => {
    const trang_thai = req.query.trang_thai || 'cho_duyet';
    const data = await model.findAll({ trang_thai, scope: req.scope });
    sendSuccess(res, data, 'Danh sách đề xuất nghỉ việc');
  }),
);

// Duyệt đề xuất → công nhân chuyển 'nghi_viec'.
router.post('/:id/duyet',
  requireRole('admin', 'quan_ly'),
  scopeByRole,
  asyncWrapper(async (req, res) => {
    const id = toPositiveInt(req.params.id, 'ID đề xuất');
    const updated = await svc.duyet(id, req.user, req.scope);
    sendSuccess(res, updated, 'Đã duyệt nghỉ việc');
  }),
);

// Từ chối đề xuất → gỡ khỏi hàng đợi, giữ nguyên công nhân.
router.post('/:id/tu-choi',
  requireRole('admin', 'quan_ly'),
  scopeByRole,
  validate(tuChoiSchema),
  asyncWrapper(async (req, res) => {
    const id = toPositiveInt(req.params.id, 'ID đề xuất');
    const updated = await svc.tuChoi(id, req.user, req.validatedBody?.ghi_chu ?? null, req.scope);
    sendSuccess(res, updated, 'Đã từ chối đề xuất nghỉ việc');
  }),
);

module.exports = router;
