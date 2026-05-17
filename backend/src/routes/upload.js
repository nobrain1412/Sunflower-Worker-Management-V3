/**
 * Generic upload endpoint — nhận 1 file ảnh, đẩy lên Cloudinary, trả về secure_url.
 * Dùng cho ảnh KTX / phòng trọ / công ty (các nơi lưu media_urls JSONB array).
 */
const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadSingleImage } = require('../middleware/upload');
const { uploadBuffer } = require('../utils/cloudinary');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');

const router = Router();

router.use(authenticate);

// POST /api/upload/image  (multipart, field "file", query ?folder=ktx)
router.post('/image',
  requireRole('admin', 'quan_ly', 'vender'),
  uploadSingleImage,
  asyncWrapper(async (req, res) => {
    if (!req.file) {
      const e = new Error('Chưa chọn file ảnh');
      e.statusCode = 400; e.code = 'VALIDATION_ERROR';
      throw e;
    }
    const allowedFolders = new Set(['ktx', 'phong-tro', 'cong-ty']);
    const folder = allowedFolders.has(req.query.folder) ? req.query.folder : 'misc';
    const result = await uploadBuffer(req.file.buffer, { folder: `workeros/${folder}` });
    sendSuccess(res, { url: result.secure_url, public_id: result.public_id }, 'Upload thành công');
  }),
);

module.exports = router;
