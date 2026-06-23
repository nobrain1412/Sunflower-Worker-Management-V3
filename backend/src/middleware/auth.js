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
// - quan_ly → { type: 'cong_ty', ids: [...], userId }  (lấy từ JWT)
//             quản lý thấy CN thuộc công ty mình quản lý HOẶC do chính mình tuyển
// - vender  → { type: 'vender', userId: id }
function scopeByRole(req, res, next) {
  const { vai_tro, id, cong_ty_ids } = req.user;
  if (vai_tro === 'admin' || vai_tro === 'ke_toan') {
    req.scope = { type: 'all' };
  } else if (vai_tro === 'quan_ly') {
    // userId để quản lý cũng thấy được CN do chính mình tuyển (dù ở công ty khác)
    req.scope = { type: 'cong_ty', ids: cong_ty_ids ?? [], userId: id };
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

// Cho phép dùng module Ký túc xá: admin LUÔN được; user khác cần được admin
// cấp quyền (users.quyen_ktx = TRUE, đính kèm trong JWT).
const requireKtxAccess = [
  authenticate,
  (req, res, next) => {
    if (req.user?.vai_tro === 'admin' || req.user?.quyen_ktx === true) return next();
    return sendForbidden(res, 'Bạn chưa được cấp quyền sử dụng chức năng Ký túc xá');
  },
];

module.exports = { authenticate, requireRole, scopeByRole, blockVender, requireKtxAccess };
