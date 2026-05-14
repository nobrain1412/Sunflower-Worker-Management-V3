/**
 * Multer middleware cho upload ảnh OCR
 * Dùng memoryStorage — file được upload lên Cloudinary trong ocrController
 */
const multer = require('multer');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

function fileFilter(_req, file, cb) {
  ALLOWED_MIME.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error('Chỉ chấp nhận file ảnh JPEG, PNG hoặc WebP'), false);
}

const uploadOcr = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = { uploadOcr };
