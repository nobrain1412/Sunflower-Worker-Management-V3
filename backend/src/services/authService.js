const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

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

async function buildTokenPayload(user) {
  const base = { id: user.id, vai_tro: user.vai_tro, ho_ten: user.ho_ten };
  // Đính kèm danh sách cong_ty vào JWT cho quan_ly để tránh query DB mỗi request
  if (user.vai_tro === 'quan_ly') {
    base.cong_ty_ids = await userModel.findCongTyIds(user.id);
  }
  return base;
}

async function login(ten_dang_nhap, mat_khau) {
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
  const access_token  = signAccessToken(payload);
  const refresh_token = signRefreshToken({ id: user.id });

  return {
    access_token,
    refresh_token,
    user: {
      id: user.id,
      ten_dang_nhap: user.ten_dang_nhap,
      ho_ten: user.ho_ten,
      vai_tro: user.vai_tro,
      cong_ty_ids: payload.cong_ty_ids ?? [],
    },
  };
}

async function refreshToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
  } catch {
    const err = new Error('Refresh token không hợp lệ');
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

  const newPayload = await buildTokenPayload(user);
  return { access_token: signAccessToken(newPayload) };
}

module.exports = { login, refreshToken };
