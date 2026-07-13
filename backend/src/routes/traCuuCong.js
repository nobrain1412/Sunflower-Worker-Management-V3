/**
 * Tra cứu ngày công CÔNG KHAI (không cần đăng nhập) — cho công nhân tự kiểm tra.
 *
 *   GET /api/tra-cuu-cong?ma=<mã vân tay>
 *
 * Khớp ĐÚNG mã (exact) để công nhân chỉ xem được đúng dòng của mã mình nhập,
 * hạn chế việc dò/quét hàng loạt so với khớp chứa như bản nội bộ.
 */
const { Router } = require('express');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');
const svc = require('../services/bangVanTayService');

const router = Router();

router.get('/', asyncWrapper(async (req, res) => {
  const ma = String(req.query.ma || '').trim();
  if (!ma) {
    const e = new Error('Vui lòng nhập mã vân tay');
    e.statusCode = 400; e.code = 'VALIDATION_ERROR';
    throw e;
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));

  const result = await svc.lookupByMa(ma, { page, limit, exact: true });
  sendSuccess(res, { headers: result.headers, rows: result.rows },
    'Tra cứu thành công', 200, result.meta);
}));

module.exports = router;
