/**
 * Bọc async controller để tự bắt lỗi, không cần try/catch trong mỗi controller
 */
const asyncWrapper = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncWrapper;
