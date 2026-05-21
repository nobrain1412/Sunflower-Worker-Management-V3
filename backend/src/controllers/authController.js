const authService = require('../services/authService');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày
};

const CLEAR_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth',
};

function getSessionInfo(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ipAddress = typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0].trim()
    : req.ip;

  return {
    ipAddress: ipAddress || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

const postLogin = asyncWrapper(async (req, res) => {
  const { ten_dang_nhap, mat_khau } = req.validatedBody;
  const result = await authService.login(ten_dang_nhap, mat_khau, getSessionInfo(req));

  // Refresh token lưu trong HttpOnly cookie
  res.cookie('refresh_token', result.refresh_token, COOKIE_OPTS);

  sendSuccess(res, {
    access_token: result.access_token,
    user: result.user,
  }, 'Đăng nhập thành công');
});

const postRefresh = asyncWrapper(async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'NO_REFRESH_TOKEN', message: 'Chưa đăng nhập' },
    });
  }
  const result = await authService.refreshToken(token, getSessionInfo(req));
  res.cookie('refresh_token', result.refresh_token, COOKIE_OPTS);
  sendSuccess(res, {
    access_token: result.access_token,
    user: result.user,
  }, 'Token đã được làm mới');
});

const postLogout = asyncWrapper(async (req, res) => {
  const token = req.cookies?.refresh_token;
  await authService.logout(token);
  res.clearCookie('refresh_token', CLEAR_COOKIE_OPTS);
  sendSuccess(res, null, 'Đăng xuất thành công');
});

const postDoiMatKhau = asyncWrapper(async (req, res) => {
  const { mat_khau_cu, mat_khau_moi } = req.validatedBody;
  await authService.changePassword(req.user.id, mat_khau_cu, mat_khau_moi);
  sendSuccess(res, null, 'Đổi mật khẩu thành công');
});

const postDangKy = asyncWrapper(async (req, res) => {
  const { ten_dang_nhap, ho_ten, so_dien_thoai, mat_khau } = req.validatedBody;
  const result = await authService.register(
    { ten_dang_nhap, ho_ten, so_dien_thoai, mat_khau },
    getSessionInfo(req),
  );

  res.cookie('refresh_token', result.refresh_token, COOKIE_OPTS);
  sendSuccess(res, {
    access_token: result.access_token,
    user: result.user,
  }, 'Đăng ký tài khoản thành công');
});

module.exports = { postLogin, postRefresh, postLogout, postDoiMatKhau, postDangKy };
