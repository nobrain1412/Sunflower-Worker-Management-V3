const db     = require('../utils/db');
const { scanCCCD, scanCCCDSides, scanDanhSach } = require('../services/ocrService');
const { uploadBuffer }           = require('../utils/cloudinary');
const { sendSuccess }            = require('../utils/response');
const logger = require('../utils/logger');

// Lấy file đầu tiên của 1 field từ req.files (multer .fields → object mảng theo field).
function pickFile(req, field) {
  const arr = req.files?.[field];
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

async function postScan(req, res) {
  const { loai } = req.body;
  if (!['cccd', 'danh_sach'].includes(loai)) {
    const e = new Error('Loại OCR không hợp lệ (cccd | danh_sach)'); e.statusCode = 400; throw e;
  }

  // CCCD: ưu tiên quét đủ 2 mặt (anh_truoc + anh_sau); vẫn nhận 1 ảnh `anh` (camera).
  const fTruoc = pickFile(req, 'anh_truoc');
  const fSau   = pickFile(req, 'anh_sau');
  const fDon   = pickFile(req, 'anh');
  const files  = [fTruoc, fSau, fDon].filter(Boolean);

  if (files.length === 0) {
    const e = new Error('Chưa upload file ảnh'); e.statusCode = 400; throw e;
  }
  // Quét CCCD từ ảnh tải lên bắt buộc đủ 2 mặt để dữ liệu đầy đủ & chính xác.
  if (loai === 'cccd' && (fTruoc || fSau) && !(fTruoc && fSau)) {
    const e = new Error('Vui lòng tải lên đủ cả 2 mặt CCCD (mặt trước và mặt sau) trước khi quét');
    e.statusCode = 400; throw e;
  }

  const now    = new Date();
  const folder = `workeros/ocr/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Chạy song song: OCR + upload (các) ảnh lên Cloudinary
  let ketQua, uploaded;
  try {
    const ocrJob = loai === 'cccd'
      ? (files.length > 1 ? scanCCCDSides(files.map((f) => f.buffer)) : scanCCCD(files[0].buffer))
      : scanDanhSach(files[0].buffer);
    const uploadJob = Promise.all(files.map((f) => uploadBuffer(f.buffer, { folder })));
    [ketQua, uploaded] = await Promise.all([ocrJob, uploadJob]);
  } catch (err) {
    if (err.statusCode) throw err;
    logger.error({ originalMessage: err.message, originalCode: err.code, stack: err.stack }, 'OCR scan/upload failed');
    const e = new Error(`OCR lỗi: ${err.message}`); e.statusCode = 502; throw e;
  }

  // Ảnh mặt trước = ảnh đầu tiên; mặt sau (nếu quét 2 mặt) = ảnh thứ hai.
  const duongDanAnh    = uploaded[0]?.secure_url ?? null;
  const duongDanAnhSau = (fTruoc && fSau) ? (uploaded[1]?.secure_url ?? null) : null;

  const { rows } = await db.query(
    `INSERT INTO ocr_quet (loai, duong_dan_anh, ket_qua_json, trang_thai, created_by)
     VALUES ($1, $2, $3, 'cho_duyet', $4)
     RETURNING id`,
    [loai, duongDanAnh, JSON.stringify(ketQua), req.user.id],
  );

  sendSuccess(res, {
    ocr_id: rows[0].id,
    loai,
    ket_qua: ketQua,
    duong_dan_anh: duongDanAnh,
    duong_dan_anh_sau: duongDanAnhSau,
  }, 'OCR thành công');
}

// Chỉ upload ảnh CCCD lên Cloudinary (KHÔNG chạy OCR) — dùng cho luồng quét QR.
// Trả URL để frontend gắn vào anh_cccd_truoc khi tạo công nhân.
async function postUploadAnh(req, res) {
  const file = req.file;
  if (!file) {
    const e = new Error('Chưa upload file ảnh'); e.statusCode = 400; throw e;
  }

  const now    = new Date();
  const folder = `workeros/cccd/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;

  let duongDanAnh;
  try {
    ({ secure_url: duongDanAnh } = await uploadBuffer(file.buffer, { folder }));
  } catch (err) {
    logger.error({ originalMessage: err.message, stack: err.stack }, 'Upload ảnh CCCD failed');
    const e = new Error(`Upload ảnh lỗi: ${err.message}`); e.statusCode = 502; throw e;
  }

  sendSuccess(res, { duong_dan_anh: duongDanAnh }, 'Upload ảnh thành công');
}

async function postApprove(req, res) {
  const id = parseInt(req.params.id, 10);
  const { rows } = await db.query(
    `UPDATE ocr_quet SET trang_thai = 'da_duyet', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id],
  );
  if (!rows.length) {
    const e = new Error('Không tìm thấy bản ghi OCR'); e.statusCode = 404; throw e;
  }
  sendSuccess(res, rows[0], 'Duyệt thành công');
}

async function postReject(req, res) {
  const id = parseInt(req.params.id, 10);
  const { rows } = await db.query(
    `UPDATE ocr_quet SET trang_thai = 'tu_choi', ghi_chu = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, req.body.ghi_chu ?? ''],
  );
  if (!rows.length) {
    const e = new Error('Không tìm thấy bản ghi OCR'); e.statusCode = 404; throw e;
  }
  sendSuccess(res, rows[0], 'Từ chối thành công');
}

module.exports = { postScan, postUploadAnh, postApprove, postReject };
