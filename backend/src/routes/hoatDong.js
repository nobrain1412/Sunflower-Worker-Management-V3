/**
 * Routes đọc audit log hoạt động.
 *
 * - GET /api/hoat-dong/cong-nhan/:id    : timeline của 1 CN (cho Hệ thống tab)
 * - GET /api/hoat-dong/cua-toi          : log do CHÍNH user đăng nhập thực hiện
 *                                          (sổ hoạt động cá nhân — mọi role đều có)
 * - GET /api/hoat-dong/lien-quan         : hoạt động liên quan tới CN do user này tuyển
 *                                          (dashboard feed cho vender/CTV — semantics cũ của /cua-toi)
 * - GET /api/hoat-dong                  : log hệ thống (admin)
 *                                          mặc định lọc muc_do='quan_trong' để không bị loãng;
 *                                          ?muc_do=tat_ca để xem toàn bộ.
 */
const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');
const hoatDongLog = require('../models/hoatDongLogModel');

const router = Router();

function toPositiveInt(value, fieldName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const e = new Error(`${fieldName} không hợp lệ`);
    e.statusCode = 400; e.code = 'VALIDATION_ERROR';
    throw e;
  }
  return parsed;
}

router.use(authenticate);

router.get('/cong-nhan/:id', asyncWrapper(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'ID công nhân');
  const limit = req.query.limit ? Math.min(200, toPositiveInt(req.query.limit, 'limit')) : 50;
  const rows = await hoatDongLog.findByCongNhan(id, limit);
  sendSuccess(res, rows);
}));

// Log do chính user đăng nhập tạo ra — sổ hoạt động cá nhân.
router.get('/cua-toi', asyncWrapper(async (req, res) => {
  const limit = req.query.limit ? Math.min(200, toPositiveInt(req.query.limit, 'limit')) : 50;
  const muc_do = req.query.muc_do;
  const loai   = req.query.loai;
  const rows = await hoatDongLog.findByCreatedBy(req.user.id, { limit, muc_do, loai });
  sendSuccess(res, rows);
}));

// Hoạt động liên quan tới CN do user này tuyển — feed cho vender/CTV.
router.get('/lien-quan', asyncWrapper(async (req, res) => {
  const limit = req.query.limit ? Math.min(100, toPositiveInt(req.query.limit, 'limit')) : 20;
  const rows = await hoatDongLog.findByNguoiTuyen(req.user.id, limit);
  sendSuccess(res, rows);
}));

// Log hệ thống (admin) — mặc định chỉ muc_do='quan_trong'.
router.get('/', requireRole('admin'), asyncWrapper(async (req, res) => {
  const limit = req.query.limit ? Math.min(200, toPositiveInt(req.query.limit, 'limit')) : 50;
  const muc_do = req.query.muc_do ?? 'quan_trong';
  const rows = await hoatDongLog.findAll({ limit, loai: req.query.loai, muc_do });
  sendSuccess(res, rows);
}));

module.exports = router;
