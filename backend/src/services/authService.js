const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
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
  } catch {
    const err = new Error('Refresh token không hợp lệ');
    err.statusCode = 401;
    err.code = 'INVALID_REFRESH_TOKEN';
    throw err;
  }

  const tokenHash = hashToken(token);
  const activeToken = await refreshTokenModel.findActiveByHash(tokenHash);
  if (!activeToken || activeToken.user_id !== payload.id) {
    const err = new Error('Refresh token không hợp lệ hoặc đã bị thu hồi');
    err.statusCode = 401;
    err.code = 'INVALID_REFRESH_TOKEN';
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

module.exports = { login, refreshToken, logout };
