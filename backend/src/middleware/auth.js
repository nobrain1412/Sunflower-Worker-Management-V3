const jwt = require('jsonwebtoken');
const { sendUnauthorized, sendForbidden } = require('../utils/response');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendUnauthorized(res);
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return sendUnauthorized(res, 'Token không hợp lệ hoặc đã hết hạn');
  }
}

function requireRole(...roles) {
  return [
    authenticate,
    (req, res, next) => {
      if (!roles.includes(req.user.vai_tro)) {
        return sendForbidden(res, 'Bạn không có quyền thực hiện thao tác này');
      }
      return next();
    },
  ];
}

// Gắn req.scope để model biết cần filter dữ liệu theo role nào
// - admin   → { type: 'all' }
// - quan_ly → { type: 'cong_ty', ids: [...] }  (lấy từ JWT)
// - vender  → { type: 'vender', userId: id }
function scopeByRole(req, res, next) {
  const { vai_tro, id, cong_ty_ids } = req.user;
  if (vai_tro === 'admin' || vai_tro === 'ke_toan') {
    req.scope = { type: 'all' };
  } else if (vai_tro === 'quan_ly') {
    req.scope = { type: 'cong_ty', ids: cong_ty_ids ?? [] };
  } else {
    // vender, cong_tac_vien — chỉ thấy CN do mình tuyển
    req.scope = { type: 'vender', userId: id };
  }
  return next();
}

// Block vender + cong_tac_vien khỏi tài chính (chỉ admin/quan_ly/ke_toan xem được)
function blockVender(req, res, next) {
  if (req.user?.vai_tro === 'vender' || req.user?.vai_tro === 'cong_tac_vien') {
    return sendForbidden(res, 'Bạn không có quyền xem thông tin tài chính');
  }
  return next();
}

module.exports = { authenticate, requireRole, scopeByRole, blockVender };
