/**
 * Phát hiện & duyệt nghỉ việc dựa trên bảng vân tay.
 *
 * Luồng:
 *   1) Upload bảng vân tay theo tháng (bang_van_tay_thang) — service khác lo.
 *   2) phanTich(): dò công nhân đã không đi làm >= NGUONG_NGAY_VANG ngày (lịch)
 *      tính tới ngày cuối cùng trong bảng, trạng thái chưa phải nghỉ việc/mới vào.
 *   3) taoDeXuat(): tạo bản ghi de_xuat_nghi_viec (chờ duyệt) cho các CN được chọn.
 *   4) duyet(): công nhân thực sự chuyển 'nghi_viec' (qua congNhanService.capNhat).
 *
 * Định danh công nhân trong bảng vân tay = cột "mã thẻ" khớp cong_nhan.ma_van_tay.
 * Công nhân chưa gán ma_van_tay không đối chiếu được → không kết luận là nghỉ.
 */
const db = require('../utils/db');
const bvt = require('./bangVanTayService');
const model = require('../models/deXuatNghiViecModel');
const congNhanModel = require('../models/congNhanModel');
const congNhanService = require('./congNhanService');

// Ngưỡng ngày vắng (lịch) để coi là ứng viên nghỉ việc.
const NGUONG_NGAY_VANG = 3;

function badRequest(message, code, statusCode = 400) {
  const e = new Error(message);
  e.statusCode = statusCode; e.code = code;
  return e;
}

// Duyệt/từ chối nghỉ việc là việc của quản lý CÔNG TY: quản lý chỉ được thao tác
// trên đề xuất thuộc công ty mình quản lý — không mở rộng theo "CN do mình tuyển".
// admin (scope 'all') không giới hạn.
function assertScopeCongTy(scope, congTyId) {
  if (!scope || scope.type === 'all') return;
  const ids = scope.type === 'cong_ty' ? (scope.ids ?? []) : [];
  if (!congTyId || !ids.includes(congTyId)) {
    throw badRequest('Bạn không quản lý công ty của đề xuất này', 'FORBIDDEN', 403);
  }
}

// Chuẩn hoá mã thẻ để so khớp (trim + bỏ dấu + lowercase). KHÔNG bỏ số 0 đứng đầu
// vì có thể là mã khác nhau tuỳ máy.
function normMa(raw) {
  return bvt.normalizeSearch(raw).replace(/\s+/g, '');
}

// Số ngày lịch giữa 2 chuỗi 'YYYY-MM-DD' (b - a). Trả null nếu thiếu.
function soNgayLich(a, b) {
  if (!a || !b) return null;
  const da = new Date(`${a}T00:00:00Z`);
  const dbb = new Date(`${b}T00:00:00Z`);
  if (isNaN(da) || isNaN(dbb)) return null;
  return Math.round((dbb - da) / 86400000);
}

// Đọc blob bảng vân tay của 1 kỳ → { lastByMa: Map<normMa, 'YYYY-MM-DD'>, ngayChot }.
async function docKyVanTay(congTyId, thang, nam) {
  const { rows } = await db.query(
    `SELECT du_lieu FROM bang_van_tay_thang
      WHERE cong_ty_id = $1 AND thang = $2 AND nam = $3`,
    [congTyId, thang, nam],
  );
  if (rows.length === 0) {
    throw badRequest('Chưa có bảng vân tay cho kỳ này — hãy upload trước', 'KY_NOT_FOUND', 404);
  }
  const du = rows[0].du_lieu || {};
  const headers = du.headers || [];
  const maH = du.ma_header || bvt.findMaHeader(headers);
  const ngayH = du.ngay_header || bvt.findNgayHeader(headers);
  if (!maH) throw badRequest('Bảng vân tay không có cột mã thẻ — không đối chiếu được', 'NO_MA_COLUMN');
  if (!ngayH) {
    throw badRequest('Bảng vân tay không có cột "Ngày" — không xác định được ngày công', 'NO_NGAY_COLUMN');
  }

  const lastByMa = new Map();
  let ngayChot = null;
  for (const r of du.rows || []) {
    const ma = normMa(r[maH]);
    if (!ma) continue;
    const d = r[ngayH]; // đã chuẩn hoá 'YYYY-MM-DD' ở bước parse
    if (!d || typeof d !== 'string') continue;
    if (!lastByMa.has(ma) || d > lastByMa.get(ma)) lastByMa.set(ma, d);
    if (!ngayChot || d > ngayChot) ngayChot = d;
  }
  if (!ngayChot) throw badRequest('Bảng vân tay không có dữ liệu ngày hợp lệ', 'NO_DATA_NGAY');
  return { lastByMa, ngayChot };
}

/**
 * Dò danh sách công nhân nghi đã nghỉ (chưa ghi DB).
 * @returns { ky, ngay_chot, de_xuat[], khong_doi_chieu[] }
 */
async function phanTich(congTyId, thang, nam) {
  const { lastByMa, ngayChot } = await docKyVanTay(congTyId, thang, nam);

  // Roster: CN của công ty, còn hiệu lực, KHÔNG tính người đã nghỉ việc / mới vào.
  const { rows: workers } = await db.query(
    `SELECT id, ho_ten, ma_van_tay, trang_thai, so_dien_thoai, nguoi_tuyen_id, ngay_vao_lam
       FROM cong_nhan
      WHERE cong_ty_id = $1 AND deleted_at IS NULL
        AND trang_thai NOT IN ('nghi_viec', 'moi_vao')`,
    [congTyId],
  );

  const deXuat = [];
  const khongDoiChieu = [];
  for (const w of workers) {
    if (w.ma_van_tay == null || String(w.ma_van_tay).trim() === '') {
      khongDoiChieu.push({
        cong_nhan_id: w.id, ho_ten: w.ho_ten, trang_thai: w.trang_thai,
        ngay_vao_lam: w.ngay_vao_lam, ly_do: 'Chưa gán mã vân tay',
      });
      continue;
    }
    const last = lastByMa.get(normMa(w.ma_van_tay)) || null;
    const soNgayVang = last ? soNgayLich(last, ngayChot) : null;
    // Có mã nhưng không có công nào trong kỳ → coi như vắng cả kỳ (ứng viên).
    const laUngVien = last ? soNgayVang >= NGUONG_NGAY_VANG : true;
    if (!laUngVien) continue;
    deXuat.push({
      cong_nhan_id: w.id,
      ho_ten: w.ho_ten,
      ma_van_tay: w.ma_van_tay,
      trang_thai: w.trang_thai,
      so_dien_thoai: w.so_dien_thoai,
      ngay_cuoi_cung_di_lam: last,
      so_ngay_vang: soNgayVang,
    });
  }

  // Đánh dấu ai đã có đề xuất chờ duyệt (để FE không tạo trùng / hiển thị khác).
  const daCo = await model.pendingCongNhanIds(deXuat.map((d) => d.cong_nhan_id));
  for (const d of deXuat) d.da_co_de_xuat = daCo.has(d.cong_nhan_id);

  return {
    ky: { thang, nam },
    ngay_chot: ngayChot,
    nguong_ngay_vang: NGUONG_NGAY_VANG,
    de_xuat: deXuat,
    khong_doi_chieu: khongDoiChieu,
  };
}

/**
 * Tạo đề xuất nghỉ việc cho các công nhân được chọn (mặc định: tất cả ứng viên).
 * Chạy lại phân tích ở server để lấy số liệu tin cậy (không tin client).
 * Đồng thời tự gỡ đề xuất 'cho_duyet' của những người đã đi làm lại (không còn ứng viên).
 */
async function taoDeXuat(congTyId, thang, nam, congNhanIds, nguoiTaoId) {
  const kq = await phanTich(congTyId, thang, nam);
  const ungVienTheoId = new Map(kq.de_xuat.map((d) => [d.cong_nhan_id, d]));

  // Lọc theo lựa chọn của người dùng; nếu không truyền → dùng tất cả ứng viên.
  let chon = kq.de_xuat;
  if (Array.isArray(congNhanIds) && congNhanIds.length > 0) {
    const set = new Set(congNhanIds);
    chon = kq.de_xuat.filter((d) => set.has(d.cong_nhan_id));
  }

  let daTao = 0;
  const ghiChu = `Phát hiện từ bảng vân tay T${thang}/${nam}`;
  for (const d of chon) {
    await model.upsert({
      cong_nhan_id: d.cong_nhan_id,
      cong_ty_id: congTyId,
      ngay_cuoi_cung_di_lam: d.ngay_cuoi_cung_di_lam,
      so_ngay_vang: d.so_ngay_vang,
      ngay_chot_bang: kq.ngay_chot,
      ky_thang: thang,
      ky_nam: nam,
      ghi_chu: ghiChu,
      nguoi_tao_id: nguoiTaoId,
    });
    daTao += 1;
  }

  // Idempotent: những người trong công ty đang có đề xuất chờ duyệt NHƯNG lần này
  // không còn là ứng viên (đã đi làm lại) → gỡ đề xuất cũ.
  const { rows: dangCho } = await db.query(
    `SELECT cong_nhan_id FROM de_xuat_nghi_viec
      WHERE trang_thai = 'cho_duyet' AND cong_ty_id = $1`,
    [congTyId],
  );
  const canGo = dangCho
    .map((r) => r.cong_nhan_id)
    .filter((id) => !ungVienTheoId.has(id));
  const daGo = await model.xoaChoDuyetTheoCongNhan(canGo);

  return { da_tao: daTao, da_go: daGo, ngay_chot: kq.ngay_chot };
}

/**
 * Duyệt nghỉ việc TRỰC TIẾP (không qua hàng đợi đề xuất) cho các công nhân được
 * tích chọn: chạy lại phân tích ở server để lấy số liệu tin cậy, chỉ duyệt những
 * người thực sự là ứng viên, đặt trang_thai = 'nghi_viec' + ngày nghỉ = ngày công
 * cuối (fallback ngày chốt bảng). Tự gỡ đề xuất 'cho_duyet' cũ (nếu có).
 */
async function duyetTrucTiep(congTyId, thang, nam, congNhanIds, user, scope) {
  assertScopeCongTy(scope, congTyId);
  if (!Array.isArray(congNhanIds) || congNhanIds.length === 0) {
    return { da_duyet: 0, tong_chon: 0 };
  }

  const kq = await phanTich(congTyId, thang, nam);
  const ungVienTheoId = new Map(kq.de_xuat.map((d) => [d.cong_nhan_id, d]));
  const chon = [...new Set(congNhanIds)].filter((id) => ungVienTheoId.has(id));

  let daDuyet = 0;
  for (const id of chon) {
    const d = ungVienTheoId.get(id);
    const goc = d.ngay_cuoi_cung_di_lam || kq.ngay_chot;
    const ngayNghi = goc ? new Date(goc).toISOString().slice(0, 10) : null;
    // capNhat tự kiểm tra scope + đồng bộ phan_cong + ghi audit log.
    await congNhanService.capNhat(
      id,
      { trang_thai: 'nghi_viec', ngay_nghi_viec: ngayNghi },
      user?.id ?? null,
      scope,
    );
    daDuyet += 1;
  }

  // Gỡ đề xuất 'cho_duyet' cũ (nếu có) của những người vừa duyệt.
  await model.xoaChoDuyetTheoCongNhan(chon);

  return { da_duyet: daDuyet, tong_chon: congNhanIds.length };
}

/**
 * Gán mã vân tay cho 1 công nhân (đang chưa có mã) rồi ĐỐI CHIẾU ngay với bảng vân
 * tay của kỳ: lưu mã vào hồ sơ, tính số ngày vắng, trả về công nhân có phải ứng
 * viên nghỉ việc hay không (để FE đưa lên danh sách phía trên).
 *
 * @returns {
 *   la_ung_vien, ma_ton_tai, ngay_chot,
 *   cong_nhan: { cong_nhan_id, ho_ten, ma_van_tay, trang_thai, so_dien_thoai,
 *               ngay_cuoi_cung_di_lam, so_ngay_vang, da_co_de_xuat }
 * }
 */
async function ganMaKiemTra(congTyId, thang, nam, congNhanId, maVanTay, user, scope) {
  const ma = String(maVanTay ?? '').trim();
  if (!ma) throw badRequest('Vui lòng nhập mã vân tay', 'VALIDATION_ERROR');

  const cn = await congNhanModel.findById(congNhanId);
  if (!cn || cn.deleted_at) throw badRequest('Không tìm thấy công nhân', 'NOT_FOUND', 404);
  if (Number(cn.cong_ty_id) !== Number(congTyId)) {
    throw badRequest('Công nhân không thuộc công ty đang phân tích', 'VALIDATION_ERROR');
  }

  // Mã vân tay phải là DUY NHẤT trong cùng công ty (tránh gán trùng máy chấm công).
  const { rows: trung } = await db.query(
    `SELECT id, ho_ten FROM cong_nhan
      WHERE cong_ty_id = $1 AND id <> $2 AND deleted_at IS NULL
        AND ma_van_tay IS NOT NULL AND LOWER(TRIM(ma_van_tay)) = LOWER($3)`,
    [congTyId, congNhanId, ma],
  );
  if (trung.length > 0) {
    throw badRequest(`Mã vân tay đã gán cho công nhân khác (${trung[0].ho_ten})`, 'DUPLICATE_MA_VAN_TAY', 409);
  }

  // Đối chiếu với bảng vân tay của kỳ.
  const { lastByMa, ngayChot } = await docKyVanTay(congTyId, thang, nam);
  const maTonTai = lastByMa.has(normMa(ma));
  const last = lastByMa.get(normMa(ma)) || null;
  const soNgayVang = last ? soNgayLich(last, ngayChot) : null;
  // Có mã nhưng không có công nào trong kỳ → coi như vắng cả kỳ (ứng viên).
  const laUngVien = last ? soNgayVang >= NGUONG_NGAY_VANG : true;

  // LƯU mã vào hồ sơ (qua capNhat để kiểm tra scope + ghi audit log).
  await congNhanService.capNhat(congNhanId, { ma_van_tay: ma }, user?.id ?? null, scope);

  const daCo = await model.pendingCongNhanIds([congNhanId]);
  return {
    la_ung_vien: laUngVien,
    ma_ton_tai: maTonTai,
    ngay_chot: ngayChot,
    cong_nhan: {
      cong_nhan_id: cn.id,
      ho_ten: cn.ho_ten,
      ma_van_tay: ma,
      trang_thai: cn.trang_thai,
      so_dien_thoai: cn.so_dien_thoai,
      ngay_cuoi_cung_di_lam: last,
      so_ngay_vang: soNgayVang,
      da_co_de_xuat: daCo.has(congNhanId),
    },
  };
}

/**
 * Gán mã + kiểm tra HÀNG LOẠT cho nhiều công nhân trong 1 lần bấm.
 * Chạy tuần tự (để bắt mã trùng ngay trong lô) và trả kết quả từng người.
 * @returns { ket_qua: [{ cong_nhan_id, ok, la_ung_vien?, cong_nhan?, error? }] }
 */
async function ganMaHangLoat(congTyId, thang, nam, items, user, scope) {
  const ketQua = [];
  for (const it of items || []) {
    try {
      const r = await ganMaKiemTra(congTyId, thang, nam, it.cong_nhan_id, it.ma_van_tay, user, scope);
      ketQua.push({ cong_nhan_id: it.cong_nhan_id, ok: true, ...r });
    } catch (err) {
      ketQua.push({ cong_nhan_id: it.cong_nhan_id, ok: false, error: err.message || 'Kiểm tra thất bại' });
    }
  }
  return { ket_qua: ketQua };
}

/**
 * Duyệt 1 đề xuất → công nhân chuyển 'nghi_viec' (ngày nghỉ = ngày cuối đi làm,
 * fallback ngày chốt bảng). Dùng lại congNhanService.capNhat để đồng bộ phan_cong
 * + ghi audit log. scope để đảm bảo quyền (admin: all, quan_ly: cty mình / CN mình tuyển).
 */
async function duyet(id, user, scope) {
  const dx = await model.findById(id);
  if (!dx) throw badRequest('Không tìm thấy đề xuất', 'NOT_FOUND', 404);
  if (dx.trang_thai !== 'cho_duyet') {
    throw badRequest('Đề xuất đã được xử lý', 'ALREADY_RESOLVED', 409);
  }
  // Chỉ quản lý của đúng công ty (hoặc admin) mới được duyệt.
  assertScopeCongTy(scope, dx.cong_ty_id);

  const ngayNghi = (dx.ngay_cuoi_cung_di_lam || dx.ngay_chot_bang)
    ? new Date(dx.ngay_cuoi_cung_di_lam || dx.ngay_chot_bang).toISOString().slice(0, 10)
    : null;

  // capNhat tự kiểm tra scope (ném 403 nếu quản lý không có quyền với CN này).
  await congNhanService.capNhat(
    dx.cong_nhan_id,
    { trang_thai: 'nghi_viec', ngay_nghi_viec: ngayNghi },
    user?.id ?? null,
    scope,
  );
  const updated = await model.markApproved(id, user?.id ?? null);
  return updated;
}

async function tuChoi(id, user, ghiChu, scope) {
  const dx = await model.findById(id);
  if (!dx) throw badRequest('Không tìm thấy đề xuất', 'NOT_FOUND', 404);
  if (dx.trang_thai !== 'cho_duyet') {
    throw badRequest('Đề xuất đã được xử lý', 'ALREADY_RESOLVED', 409);
  }
  // Chỉ quản lý của đúng công ty (hoặc admin) mới được từ chối.
  assertScopeCongTy(scope, dx.cong_ty_id);
  return model.markRejected(id, user?.id ?? null, ghiChu);
}

module.exports = {
  phanTich, taoDeXuat, duyetTrucTiep, ganMaKiemTra, ganMaHangLoat,
  duyet, tuChoi, NGUONG_NGAY_VANG,
};
