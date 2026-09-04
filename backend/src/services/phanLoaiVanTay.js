/**
 * Tách chuỗi "Lịch sử chấm vân tay" và phân loại giờ theo ca (ngày / đêm).
 *
 * Vì các cột đã tách sẵn (Đang hoạt động 1/2, Nghỉ làm 1/2/3) KHÔNG đồng nhất —
 * 1 cột có thể lẫn cả giờ nghỉ trưa và giờ vào, hoặc 1 lần chấm đúp bị tách thành
 * 2 cột — nên ta parse thẳng chuỗi gốc rồi phân loại theo khung giờ chuẩn.
 *
 * Kết quả mỗi ca/ngày: { ca, gio_den, gio_nghi_trua, gio_ve }.
 *
 * Quy tắc gom (dedupe khi 1 khung bị chấm nhiều lần):
 *   - Giờ VÀO  (đến)  → lấy lần chấm SỚM NHẤT trong khung.
 *   - Giờ RA   (về)   → lấy lần chấm MUỘN NHẤT trong khung.
 *   - Nghỉ trưa       → lấy 1 mốc trong khung (mốc ra nghỉ = sớm nhất).
 *
 * Ca đêm vắt qua nửa đêm: giờ nghỉ giữa ca và giờ về thường nằm ở DÒNG hôm sau →
 * caller phải ghép mốc giờ sáng hôm sau (đã +1440 phút) vào phiên đêm hôm trước.
 */

// Mốc/khung giờ theo phút kể từ 00:00 của NGÀY BẮT ĐẦU ca (ca đêm: hôm sau = +1440).
const CA = {
  ngay: {
    label: 'Ca ngày',
    den_chuan: 450,           // 07:30
    nghi_chuan: 690,          // 11:30
    den_max: 660,             // giờ đến: mốc sớm nhất TRƯỚC 11:00
    trua: [690, 750],         // 11:30–12:30
    ve_from: 780,             // giờ về: mốc muộn nhất TỪ 13:00
  },
  dem: {
    label: 'Ca đêm',
    den_chuan: 1170,          // 19:30
    nghi_chuan: 1410,         // 23:30
    den: [1080, 1320],        // 18:00–22:00
    trua: [1380, 1485],       // 23:00–00:45 (+1)
    ve: [1830, 2010],         // 06:30–09:30 (+1)
  },
};

const pad = (n) => String(n).padStart(2, '0');
// phút (có thể ≥1440) → 'HH:mm' theo đồng hồ 24h.
function minToHHmm(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
// 'HH:mm' → phút.
function hhmmToMin(s) {
  const m = String(s).match(/^(\d{1,2}):(\d{2})$/);
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}

/**
 * Tách mọi mốc giờ trong chuỗi lịch sử → mảng phút (0..1439), sort tăng, bỏ trùng khít.
 * Chấp nhận "07:30| 08:35| 19:33|", "7:30 11:46 16:30", có/không giây.
 */
function parseTimes(raw) {
  if (raw == null) return [];
  const set = new Set();
  for (const m of String(raw).matchAll(/(\d{1,2}):(\d{2})(?::\d{2})?/g)) {
    const h = +m[1]; const mi = +m[2];
    if (h > 23 || mi > 59) continue;
    set.add(h * 60 + mi);
  }
  return [...set].sort((a, b) => a - b);
}

const inRange = (v, [lo, hi]) => v >= lo && v <= hi;

/**
 * Phân loại 1 phiên làm việc đã gộp đủ mốc giờ.
 * @param {number[]} mins  phút (ca đêm: mốc hôm sau đã +1440)
 * @param {'ngay'|'dem'} ca
 * @returns {{ca, gio_den, gio_nghi_trua, gio_ve, so_moc}}
 */
function classifySession(mins, ca) {
  const cfg = CA[ca] || CA.ngay;
  const times = [...mins].sort((a, b) => a - b);
  let den = null; let trua = null; let ve = null;

  if (ca === 'dem') {
    const dens = times.filter((t) => inRange(t, cfg.den));
    if (dens.length) den = dens[0];                      // vào: sớm nhất
    const truas = times.filter((t) => inRange(t, cfg.trua));
    if (truas.length) trua = truas[0];                   // nghỉ: mốc ra nghỉ (sớm nhất)
    const ves = times.filter((t) => inRange(t, cfg.ve));
    if (ves.length) ve = ves[ves.length - 1];            // về: muộn nhất
  } else {
    const dens = times.filter((t) => t <= cfg.den_max);
    if (dens.length) den = dens[0];                      // vào: sớm nhất (trước 11:00)
    const truas = times.filter((t) => inRange(t, cfg.trua));
    if (truas.length) trua = truas[0];                   // nghỉ trưa: sớm nhất trong khung
    const ves = times.filter((t) => t >= cfg.ve_from);
    if (ves.length) ve = ves[ves.length - 1];            // về: muộn nhất từ 13:00
  }

  return {
    ca,
    gio_den: den == null ? null : minToHHmm(den),
    gio_nghi_trua: trua == null ? null : minToHHmm(trua),
    gio_ve: ve == null ? null : minToHHmm(ve),
    so_moc: times.length,
  };
}

/**
 * Đoán ca của 1 dòng theo mốc giờ CHIỀU/TỐI: có chấm trong 18:00–22:00 → ca đêm.
 * (Mốc sáng sớm 00:xx/07:xx trên dòng ca đêm là "đuôi" của phiên đêm hôm trước, do
 *  caller xử lý ghép — hàm này chỉ để nhận biết dòng nào MỞ ĐẦU 1 phiên đêm.)
 */
function laMoDauCaDem(minsTrongNgay) {
  return minsTrongNgay.some((t) => inRange(t, CA.dem.den));
}

// Ngưỡng phút để coi mốc sáng hôm sau thuộc "đuôi" phiên đêm hôm trước (≤ 10:30).
const DUOI_DEM_MAX = 630;

// 'YYYY-MM-DD' → ngày kế tiếp.
function ngayKeTiep(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (isNaN(d)) return null;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Phân loại theo NGÀY cho 1 công nhân — tự nhận ca ngày/đêm và ghép ca đêm vắt qua
 * nửa đêm (mốc nghỉ/về nằm ở dòng hôm sau).
 *
 * @param {{ngay_iso:string, times:number[]}[]} days  mỗi ngày + danh sách phút (0..1439)
 * @returns {{ngay_iso, ca, gio_den, gio_nghi_trua, gio_ve, so_moc}[]}
 */
function phanLoaiChuoiNgay(days) {
  const sorted = [...days].sort((a, b) => (a.ngay_iso < b.ngay_iso ? -1 : a.ngay_iso > b.ngay_iso ? 1 : 0));
  const byIso = new Map(sorted.map((d) => [d.ngay_iso, d]));
  const consumed = new Set(); // ngày có mốc sáng đã bị phiên đêm hôm trước "ăn"
  const out = [];

  for (const day of sorted) {
    const { ngay_iso, times } = day;
    // Bỏ "đuôi" sáng sớm nếu ngày này là đuôi của phiên đêm hôm trước.
    const core = consumed.has(ngay_iso) ? times.filter((t) => t > DUOI_DEM_MAX) : times.slice();
    if (core.length === 0) continue;

    const hasMorning = core.some((t) => t >= 300 && t <= 660);       // 05:00–11:00
    const hasEvening = core.some((t) => t >= CA.dem.den[0] && t <= CA.dem.den[1]);
    const isNight = hasEvening && !hasMorning;

    if (isNight) {
      const nd = byIso.get(ngayKeTiep(ngay_iso));
      const tail = nd ? nd.times.filter((t) => t <= DUOI_DEM_MAX).map((t) => t + 1440) : [];
      if (nd && tail.length) consumed.add(nd.ngay_iso);
      const sessionTimes = core.filter((t) => t >= CA.dem.den[0]).concat(tail);
      out.push({ ngay_iso, ...classifySession(sessionTimes, 'dem') });
    } else {
      out.push({ ngay_iso, ...classifySession(core, 'ngay') });
    }
  }
  return out;
}

module.exports = {
  CA, parseTimes, classifySession, laMoDauCaDem, phanLoaiChuoiNgay, ngayKeTiep,
  minToHHmm, hhmmToMin, DUOI_DEM_MAX,
};
