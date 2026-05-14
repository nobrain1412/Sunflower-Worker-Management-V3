const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const now = new Date();
    const dir = path.join(
      __dirname, '../../uploads/ocr',
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
    );
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  ALLOWED_MIME.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error('Chỉ chấp nhận file ảnh JPEG, PNG hoặc WebP'), false);
}

const uploadOcr = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = { uploadOcr };
