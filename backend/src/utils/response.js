/**
 * Chuẩn hoá response theo WorkerOS API spec
 */

function sendSuccess(res, data, message = 'Thành công', statusCode = 200, meta = null) {
  const body = { success: true, data, message };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function sendCreated(res, data, message = 'Tạo thành công') {
  return sendSuccess(res, data, message, 201);
}

function sendError(res, statusCode, code, message, details = []) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message, details },
  });
}

function sendValidationError(res, details, message = 'Dữ liệu không hợp lệ') {
  return sendError(res, 422, 'VALIDATION_ERROR', message, details);
}

function sendNotFound(res, message = 'Không tìm thấy') {
  return sendError(res, 404, 'NOT_FOUND', message);
}

function sendUnauthorized(res, message = 'Chưa đăng nhập') {
  return sendError(res, 401, 'UNAUTHORIZED', message);
}

function sendForbidden(res, message = 'Không có quyền') {
  return sendError(res, 403, 'FORBIDDEN', message);
}

module.exports = {
  sendSuccess,
  sendCreated,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
};
