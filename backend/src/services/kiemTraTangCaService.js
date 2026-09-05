/**
 * Kiểm tra ĐỀ XUẤT TĂNG CA — nhánh phụ của Bù vân tay (chỉ LỌC danh sách, không in phiếu).
 *
 * Cơ chế:
 *   - Giờ hành chính kết thúc 17:00; làm sau 17:00 là tăng ca (OT) và CẦN đề xuất.
 *     Không có đề xuất → giờ OT không được tính vào bảng công dù vân tay có chấm.
 *   - Lọc người có OT thực tế NHƯNG: không có đề xuất, hoặc đề xuất < OT thực tế.
 *   - Chủ nhật / ngày lễ: không có giờ hành chính → cần đề xuất cho CẢ NGÀY làm việc.
 *
 * OT thực tế tự tính từ giờ chấm (không tin cột OT máy tính sẵn):
 *   - Ngày thường (ca ngày): OT = giờ về − 17:00 (gross).
 *   - Ngày thường (ca đêm) : OT = số giờ làm − 8h (trừ 1h nghỉ nếu có chấm nghỉ).
 *   - CN / lễ            : OT = cả ngày = (giờ về − giờ vào) − 1h nghỉ (nếu có).
 *   - OT luôn LÀM TRÒN XUỐNG theo bội số 0.5h (1 · 1.5 · 2 · 2.5 · 3 …).
 * Đề xuất lấy từ cột "ĐỀ XUẤT TĂNG CA" (giờ) trong bảng vân tay.
 */
const db = require('../utils/db');
const bvt = require('./bangVanTayService');
const bu = require('./buVanTayService');
const pl = require('./phanLoaiVanTay');

const HC_KET_THUC = 1020;  // 17:00 tính bằng phút
const EPS = 0.25;          // dung sai 15 phút để tránh nhiễu làm tròn

// Làm tròn XUỐNG theo bội số 0.5h: 1.4 → 1.0, 1.6 → 1.5, 2.9 → 2.5 …
const floorHalf = (n) => Math.floor(n * 2 + 1e-9) / 2;

// Ô số (giờ) → number; chấp nhận '4,5' hoặc '4.5'.
function toNum(v) {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
const round2 = (n) => Math.round(n * 100) / 100;

function findDeXuatCol(headers) {
  return bu.findByAliases(headers, ['de xuat tang ca', 'de xuat tc', 'de xuat ot']);
}
function findNgayLeCol(headers) {
  return bu.findByAliases(headers, ['ngay le', 'tang ca ngay le', 'le']);
}

// OT thực tế (giờ) của 1 phiên đã phân loại, theo loại ngày (thuong/cn/le).
function tinhTangCaGio(cls, loaiNgay) {
  const den = pl.hhmmToMin(cls.gio_den);
  const rawVe = pl.hhmmToMin(cls.gio_ve);
  if (rawVe == null) return 0; // chưa có giờ về → không suy được OT (thiếu chấm về)
  let ve = rawVe;
  if (den != null && ve < den) ve += 1440; // vắt qua nửa đêm (ca đêm)
  const coNghi = cls.gio_nghi_trua != null;

  if (loaiNgay === 'cn' || loaiNgay === 'le') {
    if (den == null) return 0;
    return floorHalf(Math.max(0, (ve - den) / 60 - (coNghi ? 1 : 0))); // cả ngày (trừ nghỉ)
  }
  if (cls.ca === 'dem') {
    if (den == null) return 0;
    return floorHalf(Math.max(0, (ve - den) / 60 - (coNghi ? 1 : 0) - 8)); // vượt 8h chuẩn
  }
  return floorHalf(Math.max(0, (ve - HC_KET_THUC) / 60)); // ca ngày: sau 17:00 (gross)
}

function loaiNgayCua(iso, row, ngayLeH) {
  if (ngayLeH && toNum(row?.[ngayLeH]) > 0) return 'le';
  const d = new Date(`${iso}T00:00:00Z`);
  if (!isNaN(d) && d.getUTCDay() === 0) return 'cn';
  return 'thuong';
}

/**
 * Kiểm tra thiếu đề xuất tăng ca cho 1 kỳ.
 * @returns { cong_ty, ky, co_cot, so_cn_co_ma, records[] }
 */
async function kiemTra(congTyId, thang, nam, { ma } = {}) {
  const { duLieu, tenCongTy } = await bu.docKy(congTyId, thang, nam);
  const headers = duLieu.headers || [];
  const maH = duLieu.ma_header || bvt.findMaHeader(headers);
  const ngayH = duLieu.ngay_header || bvt.findNgayHeader(headers);
  const tenH = bu.findTenCol(headers);
  const boPhanH = bu.findBoPhanCol(headers);
  const lichSuH = bu.findLichSuCol(headers);
  const deXuatH = findDeXuatCol(headers);
  const ngayLeH = findNgayLeCol(headers);

  if (!maH || !ngayH) {
    const e = new Error('Bảng vân tay thiếu cột mã thẻ hoặc cột ngày'); e.statusCode = 400; e.code = 'THIEU_COT_CO_BAN'; throw e;
  }
  // Không có cột lịch sử chấm → không tự tính OT được.
  const coCot = !!lichSuH && !!deXuatH;

  const { rows: cnRows } = await db.query(
    `SELECT ma_van_tay, ho_ten FROM cong_nhan
      WHERE cong_ty_id = $1 AND deleted_at IS NULL
        AND ma_van_tay IS NOT NULL AND TRIM(ma_van_tay) <> ''`,
    [congTyId],
  );
  const normMa = (v) => bvt.normalizeSearch(v).replace(/\s+/g, '');
  const tenTheoMa = new Map();
  for (const cn of cnRows) tenTheoMa.set(normMa(cn.ma_van_tay), cn.ho_ten);
  const soCnCoMa = tenTheoMa.size;
  const needle = ma ? normMa(ma) : null;

  // Gom dòng theo mã (roster) để phân loại theo ngày + ghép ca đêm.
  const rowsTheoMa = new Map();
  for (const row of duLieu.rows || []) {
    const card = row[maH];
    if (card == null || String(card).trim() === '') continue;
    const cardNorm = normMa(card);
    if (!tenTheoMa.has(cardNorm)) continue;
    if (needle && cardNorm !== needle) continue;
    if (!rowsTheoMa.has(cardNorm)) rowsTheoMa.set(cardNorm, { card: String(card).trim(), rows: [] });
    rowsTheoMa.get(cardNorm).rows.push(row);
  }

  const records = [];
  if (coCot) {
    for (const [cardNorm, grp] of rowsTheoMa) {
      const rowByIso = new Map();
      const days = [];
      for (const row of grp.rows) {
        const iso = row[ngayH];
        if (!iso || typeof iso !== 'string') continue;
        rowByIso.set(iso, row);
        days.push({ ngay_iso: iso, times: pl.parseTimes(row[lichSuH]) });
      }
      for (const c of pl.phanLoaiChuoiNgay(days)) {
        const row = rowByIso.get(c.ngay_iso);
        const loaiNgay = loaiNgayCua(c.ngay_iso, row, ngayLeH);
        const tc = round2(tinhTangCaGio(c, loaiNgay));
        if (tc <= EPS) continue;                    // không có tăng ca → bỏ
        const deXuat = round2(toNum(row?.[deXuatH]));
        if (deXuat + EPS >= tc) continue;           // đề xuất đủ → bỏ
        records.push({
          card: grp.card,
          name: tenTheoMa.get(cardNorm) || (tenH ? (row?.[tenH] ?? '') : ''),
          dept: boPhanH ? (row?.[boPhanH] ?? '') : '',
          ngay_iso: c.ngay_iso,
          date_str: bu.shortDate(c.ngay_iso),
          ca: c.ca,
          loai_ngay: loaiNgay,
          gio_den: c.gio_den || '',
          gio_ve: c.gio_ve || '',
          tang_ca_thuc_te: tc,
          de_xuat: deXuat,
          thieu: round2(tc - deXuat),
          loai: deXuat <= EPS ? 'thieu_de_xuat' : 'de_xuat_thieu_gio',
        });
      }
    }
  }

  records.sort((a, b) => (a.card === b.card
    ? (a.ngay_iso < b.ngay_iso ? -1 : 1)
    : String(a.name).localeCompare(String(b.name), 'vi')));

  return { cong_ty: tenCongTy, ky: { thang, nam }, co_cot: coCot, so_cn_co_ma: soCnCoMa, records };
}

module.exports = { kiemTra, tinhTangCaGio, findDeXuatCol };
