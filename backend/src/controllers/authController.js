const authService = require('../services/authService');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày
};

const postLogin = asyncWrapper(async (req, res) => {
  const { ten_dang_nhap, mat_khau } = req.validatedBody;
  const result = await authService.login(ten_dang_nhap, mat_khau);

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
  const result = await authService.refreshToken(token);
  sendSuccess(res, result, 'Token đã được làm mới');
});

const postLogout = asyncWrapper(async (req, res) => {
  res.clearCookie('refresh_token');
  sendSuccess(res, null, 'Đăng xuất thành công');
});

module.exports = { postLogin, postRefresh, postLogout };
