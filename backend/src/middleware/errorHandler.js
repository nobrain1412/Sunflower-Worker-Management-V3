const logger = require('../utils/logger');
const { sendError } = require('../utils/response');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isProd = process.env.NODE_ENV === 'production';

  // Map PostgreSQL error code sang HTTP status để phân loại log đúng
  let statusCode = err.statusCode;
  if (!statusCode) {
    if (err.code === '23505') statusCode = 409;
    else if (err.code === '23503') statusCode = 400;
    else statusCode = 500;
  }

  // 4xx = lỗi client (sai mật khẩu, validate fail, hết hạn token...) → log warn, gọn.
  // 5xx = bug thật → log error kèm stack để điều tra.
  if (statusCode >= 500) {
    logger.error({
      err: isProd ? { message: err.message, code: err.code, reason: err.reason } : err,
      method: req.method,
      url: req.originalUrl,
    }, 'Unhandled error');
  } else {
    logger.warn({
      code: err.code,
      reason: err.reason,
      message: err.message,
      method: req.method,
      url: req.originalUrl,
    }, 'Client error');
  }

  // PostgreSQL duplicate key
  if (err.code === '23505') {
    return sendError(res, 409, 'DUPLICATE_ERROR', 'Dữ liệu đã tồn tại trong hệ thống');
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return sendError(res, 400, 'FOREIGN_KEY_ERROR', 'Dữ liệu liên kết không hợp lệ');
  }

  const message = isProd && statusCode === 500
    ? 'Lỗi hệ thống, vui lòng thử lại sau'
    : err.message || 'Lỗi không xác định';

  return sendError(res, statusCode, err.code || 'INTERNAL_ERROR', message);
}

module.exports = errorHandler;
