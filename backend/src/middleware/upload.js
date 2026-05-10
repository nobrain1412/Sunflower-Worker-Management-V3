/**
 * Multer middleware cho upload ảnh công nhân
 * Hỗ trợ: cccd_mat_truoc, cccd_mat_sau, anh_chan_dung
 */
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/anh');

// Đảm bảo thư mục tồn tại
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE     = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh JPEG, PNG hoặc WebP'), false);
  }
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } });

// Fields: cccd_mat_truoc, cccd_mat_sau, anh_chan_dung — mỗi field tối đa 1 file
const uploadAnhCongNhan = upload.fields([
  { name: 'cccd_mat_truoc', maxCount: 1 },
  { name: 'cccd_mat_sau',   maxCount: 1 },
  { name: 'anh_chan_dung',  maxCount: 1 },
]);

module.exports = { uploadAnhCongNhan };
