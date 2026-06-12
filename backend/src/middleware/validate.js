const { sendValidationError } = require('../utils/response');
// Require để kích hoạt error map tiếng Việt cho toàn bộ Zod schema
const { ghepNhanField } = require('../utils/zodViLocale');

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
        message: ghepNhanField(e.path, e.message),
      }));
      // FE đa số chỉ hiển thị error.message → message tổng phải mô tả được lỗi
      // đầu tiên thay vì câu chung chung "Dữ liệu không hợp lệ"
      const message = details.length > 1
        ? `${details[0].message} (và ${details.length - 1} lỗi khác)`
        : details[0]?.message;
      return sendValidationError(res, details, message);
    }
    // Gán dữ liệu đã được parse/coerce vào req.validatedBody
    req.validatedBody = result.data;
    return next();
  };
}

module.exports = validate;
