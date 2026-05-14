const db     = require('../utils/db');
const { scanCCCD, scanDanhSach } = require('../services/ocrService');
const { uploadBuffer }           = require('../utils/cloudinary');
const { sendSuccess }            = require('../utils/response');
const logger = require('../utils/logger');

async function postScan(req, res) {
  const { loai } = req.body;
  const file = req.file;

  if (!file) {
    const e = new Error('Chưa upload file ảnh'); e.statusCode = 400; throw e;
  }
  if (!['cccd', 'danh_sach'].includes(loai)) {
    const e = new Error('Loại OCR không hợp lệ (cccd | danh_sach)'); e.statusCode = 400; throw e;
  }

  const now    = new Date();
  const folder = `workeros/ocr/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Chạy song song: OCR + upload ảnh lên Cloudinary
  let ketQua, duongDanAnh;
  try {
    [ketQua, { secure_url: duongDanAnh }] = await Promise.all([
      loai === 'cccd'
        ? scanCCCD(file.buffer)
        : scanDanhSach(file.buffer),
      uploadBuffer(file.buffer, { folder }),
    ]);
  } catch (err) {
    if (err.statusCode) throw err;
    logger.error({ originalMessage: err.message, originalCode: err.code, stack: err.stack }, 'OCR scan/upload failed');
    const e = new Error(`OCR lỗi: ${err.message}`); e.statusCode = 502; throw e;
  }

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
  }, 'OCR thành công');
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

module.exports = { postScan, postApprove, postReject };
