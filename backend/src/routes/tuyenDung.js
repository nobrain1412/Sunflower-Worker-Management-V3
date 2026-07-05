const { Router } = require('express');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');
const congTyService = require('../services/congTyService');

const router = Router();

// GET /api/tuyen-dung — danh sách công ty đang tuyển, CÔNG KHAI (không cần đăng nhập).
// Phục vụ trang tuyển dụng để chạy quảng cáo; chỉ trả field an toàn.
router.get('/', asyncWrapper(async (_req, res) => {
  const data = await congTyService.danhSachTuyenDung();
  sendSuccess(res, data);
}));

module.exports = router;
