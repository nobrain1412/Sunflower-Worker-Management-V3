const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../utils/db');
const userModel = require('../models/userModel');
const refreshTokenModel = require('../models/refreshTokenModel');

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function toDateFromJwtExp(token) {
  const decoded = jwt.decode(token);
  if (!decoded?.exp) {
    const err = new Error('Không thể xác định hạn refresh token');
    err.statusCode = 500;
    err.code = 'TOKEN_EXP_MISSING';
    throw err;
  }
  return new Date(decoded.exp * 1000);
}

async function buildTokenPayload(user) {
  const base = { id: user.id, vai_tro: user.vai_tro, ho_ten: user.ho_ten };
  // Quyền dùng module KTX — đính vào JWT để middleware khỏi query DB mỗi request
  if (user.quyen_ktx) base.quyen_ktx = true;
  // Đính kèm danh sách cong_ty vào JWT cho quan_ly để tránh query DB mỗi request
  if (user.vai_tro === 'quan_ly') {
    base.cong_ty_ids = await userModel.findCongTyIds(user.id);
  }
  return base;
}

function mapUserResponse(user, payload) {
  return {
    id: user.id,
    ten_dang_nhap: user.ten_dang_nhap,
    ho_ten: user.ho_ten,
    vai_tro: user.vai_tro,
    quyen_ktx: !!user.quyen_ktx,
    cong_ty_ids: payload.cong_ty_ids ?? [],
  };
}

async function issueRefreshToken(userId, session = {}) {
  const token = signRefreshToken({ id: userId, jti: crypto.randomUUID() });
  const tokenHash = hashToken(token);
  const expiresAt = toDateFromJwtExp(token);

  await refreshTokenModel.create({
    userId,
    tokenHash,
    expiresAt,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
  });

  return token;
}

async function login(ten_dang_nhap, mat_khau, session = {}) {
  const user = await userModel.findByUsername(ten_dang_nhap);
  if (!user) {
    const err = new Error('Tên đăng nhập hoặc mật khẩu không đúng');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const dung = await bcrypt.compare(mat_khau, user.mat_khau_hash);
  if (!dung) {
    const err = new Error('Tên đăng nhập hoặc mật khẩu không đúng');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  if (!user.active) {
    const err = new Error('Tài khoản đã bị vô hiệu hoá');
    err.statusCode = 401;
    err.code = 'ACCOUNT_DISABLED';
    throw err;
  }

  const payload = await buildTokenPayload(user);
  const access_token = signAccessToken(payload);
  const refresh_token = await issueRefreshToken(user.id, session);

  return {
    access_token,
    refresh_token,
    user: mapUserResponse(user, payload),
  };
}

async function refreshToken(token, session = {}) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
  } catch (verifyErr) {
    // Phân biệt rõ để log: jwt sai chữ ký / hết hạn / malformed
    const err = new Error('Refresh token không hợp lệ');
    err.statusCode = 401;
    err.code = 'INVALID_REFRESH_TOKEN';
    err.reason = verifyErr?.name || 'jwt_verify_failed';
    throw err;
  }

  const tokenHash = hashToken(token);
  const activeToken = await refreshTokenModel.findActiveByHash(tokenHash);
  if (!activeToken) {
    // Không tìm thấy trong DB (hoặc đã revoke quá grace period)
    const err = new Error('Refresh token đã bị thu hồi hoặc không tồn tại');
    err.statusCode = 401;
    err.code = 'INVALID_REFRESH_TOKEN';
    err.reason = 'not_found_or_revoked';
    throw err;
  }
  if (activeToken.user_id !== payload.id) {
    const err = new Error('Refresh token không khớp user');
    err.statusCode = 401;
    err.code = 'INVALID_REFRESH_TOKEN';
    err.reason = 'user_mismatch';
    throw err;
  }

  const user = await userModel.findById(payload.id);
  if (!user || !user.active) {
    const err = new Error('Tài khoản không tồn tại hoặc đã bị vô hiệu hoá');
    err.statusCode = 401;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  await refreshTokenModel.revokeByHash(tokenHash);

  const newPayload = await buildTokenPayload(user);
  const newRefreshToken = await issueRefreshToken(user.id, session);

  return {
    access_token: signAccessToken(newPayload),
    refresh_token: newRefreshToken,
    user: mapUserResponse(user, newPayload),
  };
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await refreshTokenModel.revokeByHash(tokenHash);
}

// Đổi mật khẩu cho user đang đăng nhập. Yêu cầu nhập đúng mật khẩu cũ để xác thực.
async function changePassword(userId, matKhauCu, matKhauMoi) {
  const user = await userModel.findById(userId);
  if (!user) {
    const err = new Error('Không tìm thấy user');
    err.statusCode = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  // findById không trả mat_khau_hash → query thẳng để có hash
  const { rows } = await db.query(
    `SELECT mat_khau_hash FROM users WHERE id = $1`,
    [userId],
  );
  const matKhauHash = rows[0]?.mat_khau_hash;
  if (!matKhauHash) {
    const err = new Error('Không tìm thấy user');
    err.statusCode = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const dung = await bcrypt.compare(matKhauCu, matKhauHash);
  if (!dung) {
    const err = new Error('Mật khẩu hiện tại không đúng');
    err.statusCode = 401;
    err.code = 'WRONG_CURRENT_PASSWORD';
    throw err;
  }

  if (matKhauCu === matKhauMoi) {
    const err = new Error('Mật khẩu mới phải khác mật khẩu hiện tại');
    err.statusCode = 400;
    err.code = 'SAME_PASSWORD';
    throw err;
  }

  const newHash = await bcrypt.hash(matKhauMoi, 10);
  await db.query(
    `UPDATE users SET mat_khau_hash = $1 WHERE id = $2`,
    [newHash, userId],
  );
}

// Đăng ký tài khoản công khai — luôn tạo với vai_tro = cong_tac_vien.
// Quản lý/admin sẽ phân quyền sau qua trang Nhân sự.
async function register({ ten_dang_nhap, ho_ten, so_dien_thoai, mat_khau }, session = {}) {
  const existed = await userModel.findByUsername(ten_dang_nhap);
  if (existed) {
    const err = new Error('Tên đăng nhập đã tồn tại');
    err.statusCode = 409;
    err.code = 'USERNAME_TAKEN';
    throw err;
  }

  const mat_khau_hash = await bcrypt.hash(mat_khau, 10);
  const created = await userModel.create({
    ten_dang_nhap,
    mat_khau_hash,
    ho_ten,
    vai_tro: 'cong_tac_vien',
    so_dien_thoai,
  });

  const user = await userModel.findById(created.id);
  const payload = await buildTokenPayload(user);
  const access_token = signAccessToken(payload);
  const refresh_token = await issueRefreshToken(user.id, session);

  return {
    access_token,
    refresh_token,
    user: mapUserResponse(user, payload),
  };
}

module.exports = { login, refreshToken, logout, changePassword, register };
