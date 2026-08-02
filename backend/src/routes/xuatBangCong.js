/**
 * Xuất bảng công theo KHUÔN công ty (đổ số vào file mẫu người dùng upload).
 *
 *   POST /api/bao-cao/xuat-bang-cong/preview  — phân tích khuôn + đối chiếu,
 *                                               KHÔNG sinh file (xem trước kết quả)
 *   POST /api/bao-cao/xuat-bang-cong          — đổ số vào khuôn, trả file .xlsx
 *
 * Body: multipart (file: .xlsx khuôn công ty, cong_ty_id: number)
 * Kỳ công lấy TỪ file (không cần truyền thang/nam).
 */
const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadExcel } = require('../middleware/upload');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');
const svc = require('../services/xuatBangCongService');
const model = require('../models/xuatBangCongModel');
const congNhanModel = require('../models/congNhanModel');
const db = require('../utils/db');

const router = Router();

function parseCongTyId(value) {
  const id = parseInt(value, 10);
  if (!Number.isInteger(id) || id <= 0) {
    const e = new Error('cong_ty_id không hợp lệ');
    e.statusCode = 400; e.code = 'VALIDATION_ERROR';
    throw e;
  }
  return id;
}

function requireFile(req) {
  if (!req.file) {
    const e = new Error('Vui lòng upload file khuôn Excel');
    e.statusCode = 400; e.code = 'NO_FILE'; throw e;
  }
}

async function tenCongTy(congTyId) {
  const { rows } = await db.query('SELECT ten_cong_ty FROM cong_ty WHERE id = $1', [congTyId]);
  if (rows.length === 0) {
    const e = new Error('Công ty không tồn tại');
    e.statusCode = 400; e.code = 'CONG_TY_NOT_FOUND'; throw e;
  }
  return rows[0].ten_cong_ty;
}

// Phân tích khuôn + lấy dữ liệu công khớp. Dùng chung cho preview & xuất.
async function chuanBiDuLieu(buffer, congTyId) {
  const phanTich = await svc.phanTichKhuon(buffer);
  if (!phanTich.dateMin) {
    const e = new Error('Không nhận diện được bảng chấm công nào trong file');
    e.statusCode = 400; e.code = 'NO_TIMESHEET'; throw e;
  }
  const rows = await model.layCongTheoKhoang(
    congTyId, phanTich.dateMin, phanTich.dateMax, phanTich.maList,
  );
  const dataByMa = svc.buildDataMap(rows);
  return { phanTich, dataByMa };
}

router.post('/preview',
  authenticate,
  requireRole('admin', 'quan_ly'),
  uploadExcel,
  asyncWrapper(async (req, res) => {
    requireFile(req);
    const congTyId = parseCongTyId(req.body?.cong_ty_id);
    await tenCongTy(congTyId);

    const phanTich = await svc.phanTichKhuon(req.file.buffer);
    if (!phanTich.dateMin) {
      const e = new Error('Không nhận diện được bảng chấm công nào trong file');
      e.statusCode = 400; e.code = 'NO_TIMESHEET'; throw e;
    }
    const { tu, den } = phanTich.kyChuan;

    // Dữ liệu từ hệ thống trong kỳ chuẩn
    const [coCong, roster, khopMa] = await Promise.all([
      model.layNguoiCoCong(congTyId, tu, den),
      model.layRosterCongTy(congTyId, tu, den),
      model.layCongNhanTheoMa(phanTich.maList),
    ]);

    const fileMa = new Set(phanTich.maList);
    const khopMaSet = new Set(khopMa.map((c) => c.ma_van_tay));
    const congMaSet = new Set(coCong.map((c) => c.ma_van_tay).filter(Boolean));
    const congIdSet = new Set(coCong.map((c) => c.cong_nhan_id));

    // 1) Trong file nhưng KHÔNG có hồ sơ trong hệ thống
    const trongFileNgoaiHeThong = phanTich.nguoiTrongFile
      .filter((p) => !khopMaSet.has(p.ma))
      .map((p) => ({ ma_van_tay: p.ma, ho_ten: p.ten, sheet: p.sheet }));

    // 2) Có trong file + hệ thống nhưng KHÔNG có công (sẽ để trống trong file)
    const trongFileKhongCong = khopMa
      .filter((c) => !congMaSet.has(c.ma_van_tay))
      .map((c) => ({ id: c.id, ho_ten: c.ho_ten, ma_van_tay: c.ma_van_tay, trang_thai: c.trang_thai }));

    // 3) Có công trong hệ thống nhưng KHÔNG có tên trong file (dữ liệu sẽ bị bỏ sót!)
    const coCongThieuTrongFile = coCong
      .filter((c) => !c.ma_van_tay || !fileMa.has(c.ma_van_tay))
      .map((c) => ({ id: c.cong_nhan_id, ho_ten: c.ho_ten, ma_van_tay: c.ma_van_tay, tong_gio: c.tong_gio }));

    // 4) Thuộc công ty, KHÔNG có công VÀ KHÔNG trong file → gợi ý nghỉ việc (có checkbox)
    const goiYNghiViec = roster
      .filter((c) => !congIdSet.has(c.id)
        && !(c.ma_van_tay && fileMa.has(c.ma_van_tay))
        && c.trang_thai !== 'nghi_viec')
      .map((c) => ({ id: c.id, ho_ten: c.ho_ten, ma_van_tay: c.ma_van_tay, trang_thai: c.trang_thai }));

    const canhBao = phanTich.sheets
      .filter((s) => s.nhanDien && s.lechKy)
      .map((s) => `Sheet "${s.ten}" có kỳ công ${s.kyCong} khác kỳ chuẩn — kiểm tra lại ô tháng/năm trong file`);

    sendSuccess(res, {
      ky_cong: phanTich.kyChuan,
      sheets: phanTich.sheets,
      canh_bao: canhBao,
      doi_chieu: {
        trong_file_ngoai_he_thong: trongFileNgoaiHeThong,
        trong_file_khong_cong: trongFileKhongCong,
        co_cong_thieu_trong_file: coCongThieuTrongFile,
        goi_y_nghi_viec: goiYNghiViec,
      },
      tong_ket: {
        so_sheet_nhan_dien: phanTich.sheets.filter((s) => s.nhanDien).length,
        so_nguoi_trong_file: phanTich.maList.length,
        so_nguoi_khop_co_cong: phanTich.maList.filter((m) => congMaSet.has(m)).length,
        so_trong_file_ngoai_he_thong: trongFileNgoaiHeThong.length,
        so_trong_file_khong_cong: trongFileKhongCong.length,
        so_co_cong_thieu_trong_file: coCongThieuTrongFile.length,
        so_goi_y_nghi_viec: goiYNghiViec.length,
      },
    }, 'Phân tích khuôn thành công');
  }),
);

// Chuyển nhanh nhiều CN sang nghỉ việc (từ danh sách gợi ý ở preview).
router.post('/nghi-viec',
  authenticate,
  requireRole('admin', 'quan_ly'),
  asyncWrapper(async (req, res) => {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((x) => parseInt(x, 10)).filter((x) => Number.isInteger(x) && x > 0)
      : [];
    if (ids.length === 0) {
      const e = new Error('Danh sách công nhân trống');
      e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
    }
    const ngayNghiViec = req.body?.ngay_nghi_viec || null;
    const updated = await congNhanModel.nghiViecHangLoat(ids, ngayNghiViec);
    sendSuccess(res, { da_cap_nhat: updated.length, ids: updated },
      `Đã chuyển ${updated.length} công nhân sang nghỉ việc`);
  }),
);

router.post('/',
  authenticate,
  requireRole('admin', 'quan_ly'),
  uploadExcel,
  asyncWrapper(async (req, res) => {
    requireFile(req);
    const congTyId = parseCongTyId(req.body?.cong_ty_id);
    const ten = await tenCongTy(congTyId);
    const { dataByMa } = await chuanBiDuLieu(req.file.buffer, congTyId);

    const { buffer } = await svc.xuatBangCong(req.file.buffer, dataByMa);

    const safeName = String(ten || 'cong-ty')
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      `attachment; filename="bang-cong_${safeName}_${Date.now()}.xlsx"`);
    res.send(buffer);
  }),
);

module.exports = router;
