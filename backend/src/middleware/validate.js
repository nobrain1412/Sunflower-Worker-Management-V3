const { sendValidationError } = require('../utils/response');

/**
 * Middleware factory: validate req.body bằng Zod schema
 * Dùng: router.post('/', validate(mySchema), controller)
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return sendValidationError(res, details);
    }
    // Gán dữ liệu đã được parse/coerce vào req.validatedBody
    req.validatedBody = result.data;
    return next();
  };
}

module.exports = validate;
