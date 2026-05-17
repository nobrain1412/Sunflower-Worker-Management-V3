/**
 * Multer middleware cho upload ảnh công nhân
 * Hỗ trợ: cccd_mat_truoc, cccd_mat_sau, anh_chan_dung, anh_xe
 * Dùng memoryStorage — file được upload lên Cloudinary trong route handler
 */
const multer = require('multer');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE     = 10 * 1024 * 1024; // 10 MB

function fileFilter(_req, file, cb) {
  ALLOWED_MIME.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error('Chỉ chấp nhận file ảnh JPEG, PNG hoặc WebP'), false);
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_SIZE },
});

// Fields: cccd_mat_truoc, cccd_mat_sau, anh_chan_dung, anh_xe — mỗi field tối đa 1 file
const uploadAnhCongNhan = upload.fields([
  { name: 'cccd_mat_truoc', maxCount: 1 },
  { name: 'cccd_mat_sau',   maxCount: 1 },
  { name: 'anh_chan_dung',  maxCount: 1 },
  { name: 'anh_xe',         maxCount: 1 },
]);

// Generic 1-file uploader cho ảnh KTX, phòng trọ, công ty — field name "file"
const uploadSingleImage = upload.single('file');

module.exports = { uploadAnhCongNhan, uploadSingleImage };
