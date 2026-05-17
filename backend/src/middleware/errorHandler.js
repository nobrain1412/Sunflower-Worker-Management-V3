const logger = require('../utils/logger');
const { sendError } = require('../utils/response');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isProd = process.env.NODE_ENV === 'production';

  // Log lỗi server — không log stack trace ở production log để tránh lộ thông tin
  logger.error({
    err: isProd ? { message: err.message, code: err.code, reason: err.reason } : err,
    method: req.method,
    url: req.originalUrl,
  }, 'Unhandled error');

  // PostgreSQL duplicate key
  if (err.code === '23505') {
    return sendError(res, 409, 'DUPLICATE_ERROR', 'Dữ liệu đã tồn tại trong hệ thống');
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return sendError(res, 400, 'FOREIGN_KEY_ERROR', 'Dữ liệu liên kết không hợp lệ');
  }

  const statusCode = err.statusCode || 500;
  const message = isProd && statusCode === 500
    ? 'Lỗi hệ thống, vui lòng thử lại sau'
    : err.message || 'Lỗi không xác định';

  return sendError(res, statusCode, err.code || 'INTERNAL_ERROR', message);
}

module.exports = errorHandler;
