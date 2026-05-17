/**
 * Routes đọc audit log hoạt động.
 *
 * - GET /api/hoat-dong/cong-nhan/:id   : timeline của 1 CN (cho Hệ thống tab)
 * - GET /api/hoat-dong/cua-toi          : hoạt động của các CN do user đang đăng nhập tuyển
 *                                         (cho Dashboard "hoạt động gần đây" của vender/CTV)
 * - GET /api/hoat-dong                  : tất cả (admin)
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

router.get('/cua-toi', asyncWrapper(async (req, res) => {
  const limit = req.query.limit ? Math.min(100, toPositiveInt(req.query.limit, 'limit')) : 20;
  const rows = await hoatDongLog.findByNguoiTuyen(req.user.id, limit);
  sendSuccess(res, rows);
}));

router.get('/', requireRole('admin'), asyncWrapper(async (req, res) => {
  const limit = req.query.limit ? Math.min(200, toPositiveInt(req.query.limit, 'limit')) : 50;
  const rows = await hoatDongLog.findAll({ limit, loai: req.query.loai });
  sendSuccess(res, rows);
}));

module.exports = router;
