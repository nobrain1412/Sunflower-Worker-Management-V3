/**
 * Sinh dữ liệu phiếu "Bù chấm vân tay" từ bảng vân tay đã lưu (bang_van_tay_thang).
 *
 * Thay cho công cụ HTML rời (autoBuVanTay): thay vì upload lại Excel mỗi lần, ta
 * dùng luôn blob JSON của kỳ đã upload cho bảng công / tra cứu vân tay.
 *
 * Nguồn giờ chấm: ƯU TIÊN cột "Lịch sử chấm vân tay" (chuỗi mọi mốc trong 1 ô) →
 * parse + phân loại theo ca ngày/đêm (phanLoaiVanTay.js) thành 3 mốc đến/nghỉ/về.
 * Cách này bền hơn 5 cột đã tách sẵn (vốn hay lẫn giờ nghỉ với giờ vào, hoặc tách
 * đôi 1 lần chấm). Không có cột lịch sử → fallback 5 cột 上班/下班 như trước.
 *
 * Gợi ý giờ bù (theo 3 mốc, xét ca):
 *   - Thiếu chấm VÀO   → bù giờ vào chuẩn (07:30 ca ngày / 19:30 ca đêm)
 *   - Thiếu chấm NGHỈ  → bù giờ nghỉ chuẩn (11:30 / 23:30)
 *   - Thiếu chấm VỀ    → "........." (ghi tay, vì giờ về thay đổi theo tăng ca)
 *   - Đủ 3 mốc         → không cần phiếu bù
 */
const db = require('../utils/db');
const bvt = require('./bangVanTayService');
const pl = require('./phanLoaiVanTay');

function badRequest(message, code, statusCode = 400) {
  const e = new Error(message);
  e.statusCode = statusCode; e.code = code;
  return e;
}

const isEmpty = (v) => v == null || String(v).trim() === '';

// Bí danh cột chấm — khớp theo normalizeSearch (giữ ký tự Trung, bỏ dấu tiếng Việt).
// Ưu tiên bí danh có số thứ tự (上班1/上班2…) để tránh gán nhầm 上班/下班 chung.
const PUNCH_ALIASES = {
  start1: ['上班1', '上班 1', 'dang hoat dong 1', 'hoat dong 1', 'gio vao 1', 'gio vao', 'vao 1', 'cong viec 1', 'ca vao 1', 'dang hoat dong', 'vao', '上班'],
  off1:   ['下班1', '下班 1', 'nghi lam 1', 'ra 1', 'gio ra 1', '下班'],
  on2:    ['上班2', '上班 2', 'dang hoat dong 2', 'hoat dong 2', 'cong viec 2', 'vao ca 2', 'vao 2', '上班'],
  off2:   ['下班2', '下班 2', 'nghi lam 2', 'ra ca 2', 'ra 2', '下班'],
  end3:   ['下班3', '下班 3', 'nghi lam 3', 'ra 3', 'gio ra', 'gio ra 3', '下班'],
};

// Dò header khớp bí danh, KHÔNG dùng lại header đã gán cho cột khác (tránh trùng).
function findPunchCol(headers, aliases, used) {
  const norm = (s) => bvt.normalizeSearch(s).replace(/\s+/g, ' ').trim();
  for (const a of aliases) {
    const target = norm(a);
    const h = headers.find((hh) => !used.has(hh) && norm(hh) === target);
    if (h) { used.add(h); return h; }
  }
  return null;
}

// Header tên/bộ phận có thể là tiếng Việt HOẶC tiếng Trung (máy chấm công). Ưu tiên
// finder chung của bangVanTayService, fallback khớp trực tiếp bí danh (kể cả CJK).
function findByAliases(headers, aliases) {
  const norm = (s) => bvt.normalizeSearch(s).replace(/\s+/g, ' ').trim();
  for (const a of aliases) {
    const target = norm(a);
    const h = headers.find((hh) => norm(hh) === target || norm(hh).startsWith(target));
    if (h) return h;
  }
  return null;
}
function findTenCol(headers) {
  return bvt.findTenHeader(headers) || findByAliases(headers, ['姓名', 'ten nv', 'ten cong nhan', 'ho ten']);
}
function findBoPhanCol(headers) {
  return findByAliases(headers, ['bo phan', '部门', '部門', 'bp']);
}
// Cột "Lịch sử chấm vân tay" — mọi mốc giờ trong 1 ô (nguồn đáng tin nhất).
function findLichSuCol(headers) {
  const norm = (s) => bvt.normalizeSearch(s).replace(/\s+/g, ' ').trim();
  return headers.find((h) => {
    const k = norm(h);
    return k.includes('lich su') || k === 'thoi gian cham' || k.includes('cham van tay');
  }) || null;
}

// Gợi ý giờ bù theo mô hình 3 mốc (đến / nghỉ trưa / về), có xét ca ngày/đêm.
function computeBu3(ca, c) {
  const cfg = pl.CA[ca] || pl.CA.ngay;
  if (!c.gio_den) return pl.minToHHmm(cfg.den_chuan);       // thiếu chấm VÀO
  if (!c.gio_nghi_trua) return pl.minToHHmm(cfg.nghi_chuan); // thiếu chấm NGHỈ giữa ca
  if (!c.gio_ve) return '.........';                        // thiếu chấm VỀ → ghi tay
  return '';
}

// Nhận diện 5 cột chấm từ danh sách header. Trả { start1, off1, on2, off2, end3 }.
function detectPunchCols(headers) {
  const used = new Set();
  const cols = {};
  for (const key of ['start1', 'off1', 'on2', 'off2', 'end3']) {
    cols[key] = findPunchCol(headers, PUNCH_ALIASES[key], used);
  }
  return cols;
}

// Giá trị ô giờ → "HH:mm" hiển thị. Nhận số (fraction Excel), chuỗi "HH:mm[:ss]".
function formatTime(val) {
  if (isEmpty(val)) return '';
  if (typeof val === 'number') {
    const sec = Math.round((val % 1) * 86400);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const m = String(val).match(/(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return '';
}

// Làm tròn xuống bội số 15 phút (dùng cho giờ ra hiển thị trên phiếu).
function roundDownQuarter(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map((n) => +n);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const q = Math.floor(m / 15) * 15;
  return `${String(h).padStart(2, '0')}:${String(q).padStart(2, '0')}`;
}

// 'YYYY-MM-DD' → 'dd/mm' (dữ liệu ngày đã chuẩn hoá sẵn ở bước parse workbook).
function shortDate(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : '';
}

// Giữ nguyên luật gợi ý giờ bù của công cụ gốc.
function computeBuTime(start1, off1, on2, off2, end3) {
  if (isEmpty(start1)) return '07:30';
  if (isEmpty(off1) && isEmpty(on2)) return '11:30';
  if (isEmpty(off2) && isEmpty(end3)) return '.........';
  return '';
}

// Đọc blob kỳ + tên công ty. Ném lỗi rõ ràng nếu chưa có dữ liệu.
async function docKy(congTyId, thang, nam) {
  const { rows } = await db.query(
    `SELECT b.du_lieu, c.ten_cong_ty
       FROM bang_van_tay_thang b
       JOIN cong_ty c ON c.id = b.cong_ty_id
      WHERE b.cong_ty_id = $1 AND b.thang = $2 AND b.nam = $3`,
    [congTyId, thang, nam],
  );
  if (rows.length === 0) {
    throw badRequest('Chưa có bảng vân tay cho kỳ này — hãy upload trước', 'KY_NOT_FOUND', 404);
  }
  return { duLieu: rows[0].du_lieu || {}, tenCongTy: rows[0].ten_cong_ty };
}

/**
 * Sinh danh sách phiếu bù cho 1 kỳ. Chỉ trả các dòng THIẾU CHẤM (cần bù).
 * @param {object} opts { ma } — lọc theo 1 mã vân tay (luồng tra cứu 1 công nhân).
 * @returns { cong_ty, ky, cot, thieu_cot, records[] }
 */
async function taoPhieuBu(congTyId, thang, nam, { ma } = {}) {
  const { duLieu, tenCongTy } = await docKy(congTyId, thang, nam);
  const headers = duLieu.headers || [];
  const maH = duLieu.ma_header || bvt.findMaHeader(headers);
  const ngayH = duLieu.ngay_header || bvt.findNgayHeader(headers);
  const tenH = findTenCol(headers);
  const boPhanH = findBoPhanCol(headers);
  const lichSuH = findLichSuCol(headers);
  const cot = detectPunchCols(headers);

  if (!maH || !ngayH) {
    throw badRequest('Bảng vân tay thiếu cột mã thẻ hoặc cột ngày — không tạo phiếu bù được', 'THIEU_COT_CO_BAN');
  }
  // Nguồn giờ chấm: ưu tiên cột "Lịch sử chấm vân tay" (parse + phân loại theo ca);
  // nếu không có thì dùng 5 cột đã tách sẵn (kém tin cậy hơn).
  const dungLichSu = !!lichSuH;
  const thieuCot = !dungLichSu && !cot.start1 && !cot.off1 && !cot.on2 && !cot.off2 && !cot.end3;

  // Chỉ tạo phiếu cho công nhân ĐANG có trong danh sách công ty và đã gán mã vân tay.
  // Đối chiếu mã thẻ (bảng vân tay) với cong_nhan.ma_van_tay → bỏ qua khách vãng lai
  // / mã lạ không thuộc roster. Đồng thời lấy tên chuẩn từ hồ sơ để in lên phiếu.
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
  // Giữ các dòng thuộc roster (và khớp mã nếu lọc), gom theo mã để xử lý ca đêm vắt ngày.
  const rowsTheoMa = new Map(); // cardNorm -> { card, rows: [row] }
  for (const row of duLieu.rows || []) {
    const card = row[maH];
    if (isEmpty(card)) continue;
    const cardNorm = normMa(card);
    if (!tenTheoMa.has(cardNorm)) continue;
    if (needle && cardNorm !== needle) continue;
    if (!rowsTheoMa.has(cardNorm)) rowsTheoMa.set(cardNorm, { card: String(card).trim(), rows: [] });
    rowsTheoMa.get(cardNorm).rows.push(row);
  }

  const records = [];
  const pushRec = (cardNorm, card, row, ngayIso, extra) => {
    records.push({
      card,
      name: tenTheoMa.get(cardNorm) || (tenH ? (row?.[tenH] ?? '') : ''),
      dept: boPhanH ? (row?.[boPhanH] ?? '') : '',
      ngay_iso: ngayIso || '',
      date_str: shortDate(ngayIso),
      ...extra,
    });
  };

  for (const [cardNorm, grp] of rowsTheoMa) {
    if (dungLichSu) {
      // Parse chuỗi lịch sử → phân loại theo ngày (tự nhận ca ngày/đêm, ghép ca đêm).
      const rowByIso = new Map();
      const days = [];
      for (const row of grp.rows) {
        const iso = row[ngayH];
        if (!iso || typeof iso !== 'string') continue;
        rowByIso.set(iso, row);
        days.push({ ngay_iso: iso, times: pl.parseTimes(row[lichSuH]) });
      }
      for (const c of pl.phanLoaiChuoiNgay(days)) {
        const buStr = computeBu3(c.ca, c);
        if (!buStr) continue; // đủ chấm → không cần phiếu
        const cfg = pl.CA[c.ca] || pl.CA.ngay;
        pushRec(cardNorm, grp.card, rowByIso.get(c.ngay_iso), c.ngay_iso, {
          ca: c.ca,
          gio_vao_chuan: pl.minToHHmm(cfg.den_chuan),
          start_str: c.gio_den || '',
          end_str: c.gio_ve || '.........',
          bu_str: buStr,
        });
      }
    } else {
      // Fallback: 5 cột đã tách sẵn.
      for (const row of grp.rows) {
        const start1 = cot.start1 ? row[cot.start1] : null;
        const off1 = cot.off1 ? row[cot.off1] : null;
        const on2 = cot.on2 ? row[cot.on2] : null;
        const off2 = cot.off2 ? row[cot.off2] : null;
        const end3 = cot.end3 ? row[cot.end3] : null;
        if (isEmpty(start1) && isEmpty(off1) && isEmpty(on2) && isEmpty(off2) && isEmpty(end3)) continue;
        const buStr = thieuCot ? '' : computeBuTime(start1, off1, on2, off2, end3);
        if (!buStr) continue;
        const endHHmm = roundDownQuarter(formatTime(end3) || formatTime(off2));
        pushRec(cardNorm, grp.card, row, row[ngayH], {
          ca: 'ngay',
          gio_vao_chuan: '07:30',
          start_str: formatTime(start1),
          end_str: isEmpty(end3) && isEmpty(off2) ? '.........' : (endHHmm || '.........'),
          bu_str: buStr,
        });
      }
    }
  }

  // Đánh số "lần thứ" trong tháng theo từng mã thẻ (chỉ tính các phiếu cần bù),
  // sắp theo ngày tăng dần → khớp ghi chú "tối đa 3 lần/tháng".
  const groups = {};
  for (const r of records) (groups[r.card] ||= []).push(r);
  for (const card of Object.keys(groups)) {
    const g = groups[card].sort((a, b) => (a.ngay_iso < b.ngay_iso ? -1 : a.ngay_iso > b.ngay_iso ? 1 : 0));
    g.forEach((rec, i) => { rec.order = i + 1; rec.total = g.length; });
  }
  // Sắp xếp kết quả trả về: theo tên (nếu có) rồi ngày, để danh sách dễ đọc.
  records.sort((a, b) => (a.card === b.card
    ? (a.ngay_iso < b.ngay_iso ? -1 : 1)
    : String(a.name).localeCompare(String(b.name), 'vi')));

  return {
    cong_ty: tenCongTy,
    ky: { thang, nam },
    cot,
    thieu_cot: thieuCot,
    nguon: dungLichSu ? 'lich_su' : 'cot',  // nguồn giờ chấm để FE/log biết
    so_cn_co_ma: soCnCoMa,   // số CN của công ty đã gán mã vân tay (để FE gợi ý)
    records,
  };
}

module.exports = {
  taoPhieuBu, detectPunchCols, computeBu3, computeBuTime,
  docKy, findTenCol, findBoPhanCol, findByAliases, findLichSuCol,
  formatTime, roundDownQuarter, shortDate,
};
