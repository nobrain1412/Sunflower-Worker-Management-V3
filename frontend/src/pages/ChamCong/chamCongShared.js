/**
 * Helpers + hằng số dùng chung cho 2 chế độ chấm công:
 *   - Điểm danh nhanh (theo ngày)
 *   - Bảng tháng (lưới)
 *
 * Mỗi "cell" = chấm công 1 ngày của 1 phân công, gồm 4 loại giờ:
 *   gio_hc_ngay (hành chính ca ngày), gio_tc_ngay (tăng ca ca ngày),
 *   gio_hc_dem  (hành chính ca đêm),  gio_tc_dem  (tăng ca ca đêm)
 *   + ca_lam: null | 'nghi_phep' | 'nghi_viec'
 */

export const MONTH_NAMES = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
export const WEEKDAYS = ['CN','T2','T3','T4','T5','T6','T7'];

export const BUCKETS = [
  { key: 'gio_hc_ngay', label: 'HC ngày',  short: 'HC ngày',  color: 'var(--accent)' },
  { key: 'gio_tc_ngay', label: 'TC ngày',  short: 'TC ngày',  color: 'var(--accent2)' },
  { key: 'gio_hc_dem',  label: 'HC đêm',   short: 'HC đêm',   color: 'var(--teal)' },
  { key: 'gio_tc_dem',  label: 'TC đêm',   short: 'TC đêm',   color: 'var(--amber)' },
];

export function daysInMonth(thang, nam) {
  return new Date(nam, thang, 0).getDate();
}

export function ymd(thang, nam, day) {
  return `${nam}-${String(thang).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function todayYMD() {
  const d = new Date();
  return ymd(d.getMonth() + 1, d.getFullYear(), d.getDate());
}

// Các mốc giờ chấm chi tiết (giờ đến / nghỉ trưa / về) — string 'HH:MM' hoặc ''.
export const TIME_FIELDS = [
  { key: 'gio_den',       label: 'Giờ đến',   color: 'var(--green)' },
  { key: 'gio_nghi_trua', label: 'Nghỉ trưa', color: 'var(--amber)' },
  { key: 'gio_ve',        label: 'Giờ về',    color: 'var(--red)' },
];

export function emptyCell() {
  return {
    gio_hc_ngay: 0, gio_tc_ngay: 0, gio_hc_dem: 0, gio_tc_dem: 0,
    gio_den: '', gio_nghi_trua: '', gio_ve: '', ca_lam: null,
  };
}

// Cell từ bản ghi server (hỗ trợ dữ liệu cũ chỉ có so_gio/so_gio_ot → coi như ca ngày)
export function cellFromServer(cc) {
  if (!cc) return null;
  const n = (v) => Number(v || 0);
  const t = (v) => (v == null ? '' : String(v).slice(0, 5)); // 'HH:MM:SS' → 'HH:MM'
  const times = { gio_den: t(cc.gio_den), gio_nghi_trua: t(cc.gio_nghi_trua), gio_ve: t(cc.gio_ve) };
  const hasBuckets = ['gio_hc_ngay', 'gio_tc_ngay', 'gio_hc_dem', 'gio_tc_dem']
    .some((k) => cc[k] != null);
  if (!hasBuckets) {
    return { gio_hc_ngay: n(cc.so_gio), gio_tc_ngay: n(cc.so_gio_ot), gio_hc_dem: 0, gio_tc_dem: 0, ...times, ca_lam: cc.ca_lam || null };
  }
  return {
    gio_hc_ngay: n(cc.gio_hc_ngay), gio_tc_ngay: n(cc.gio_tc_ngay),
    gio_hc_dem:  n(cc.gio_hc_dem),  gio_tc_dem:  n(cc.gio_tc_dem),
    ...times,
    ca_lam: cc.ca_lam || null,
  };
}

export function totalGio(cell) {
  if (!cell) return 0;
  return Number(cell.gio_hc_ngay || 0) + Number(cell.gio_tc_ngay || 0)
    + Number(cell.gio_hc_dem || 0) + Number(cell.gio_tc_dem || 0);
}

export function isNghi(cell) {
  return cell?.ca_lam === 'nghi_phep' || cell?.ca_lam === 'nghi_viec';
}

export function isEmptyCell(cell) {
  return !cell || (!cell.ca_lam && totalGio(cell) === 0);
}

export function equalCell(a, b) {
  const A = a || emptyCell();
  const B = b || emptyCell();
  return (A.ca_lam || null) === (B.ca_lam || null)
    && Number(A.gio_hc_ngay || 0) === Number(B.gio_hc_ngay || 0)
    && Number(A.gio_tc_ngay || 0) === Number(B.gio_tc_ngay || 0)
    && Number(A.gio_hc_dem  || 0) === Number(B.gio_hc_dem  || 0)
    && Number(A.gio_tc_dem  || 0) === Number(B.gio_tc_dem  || 0)
    && (A.gio_den       || '') === (B.gio_den       || '')
    && (A.gio_nghi_trua || '') === (B.gio_nghi_trua || '')
    && (A.gio_ve        || '') === (B.gio_ve        || '');
}

// Cell → payload entry gửi BE (ngay được thêm ở nơi gọi)
export function toEntry(cell) {
  const c = cell || emptyCell();
  return {
    gio_hc_ngay: Number(c.gio_hc_ngay || 0),
    gio_tc_ngay: Number(c.gio_tc_ngay || 0),
    gio_hc_dem:  Number(c.gio_hc_dem  || 0),
    gio_tc_dem:  Number(c.gio_tc_dem  || 0),
    gio_den:       c.gio_den       || null,
    gio_nghi_trua: c.gio_nghi_trua || null,
    gio_ve:        c.gio_ve        || null,
    ca_lam: c.ca_lam || null,
  };
}

// Preset 1 ca có mặt: giờ HC vào ca ngày hoặc ca đêm
export function presentCell(gio, ca) {
  const c = emptyCell();
  if (ca === 'dem') c.gio_hc_dem = Number(gio) || 0;
  else c.gio_hc_ngay = Number(gio) || 0;
  return c;
}

function fmtNum(n) {
  const x = Number(n || 0);
  return Number.isInteger(x) ? String(x) : x.toFixed(1).replace(/\.0$/, '');
}

// Tóm tắt ngắn cho ô lưới: 'P', 'V', '8', '8+2', 'Đ8', '8+2 Đ8'
export function summarize(cell) {
  if (!cell) return '';
  if (cell.ca_lam === 'nghi_phep') return 'P';
  if (cell.ca_lam === 'nghi_viec') return 'V';
  const hcN = Number(cell.gio_hc_ngay || 0), tcN = Number(cell.gio_tc_ngay || 0);
  const hcD = Number(cell.gio_hc_dem  || 0), tcD = Number(cell.gio_tc_dem  || 0);
  const parts = [];
  if (hcN || tcN) parts.push(tcN ? `${fmtNum(hcN)}+${fmtNum(tcN)}` : fmtNum(hcN));
  if (hcD || tcD) parts.push(`Đ${tcD ? `${fmtNum(hcD)}+${fmtNum(tcD)}` : fmtNum(hcD)}`);
  return parts.join(' ');
}

// Mô tả đầy đủ (tooltip / chip)
export function detailText(cell) {
  if (!cell) return 'Chưa chấm';
  if (cell.ca_lam === 'nghi_phep') return 'Nghỉ phép';
  if (cell.ca_lam === 'nghi_viec') return 'Nghỉ việc';
  const segs = [];
  if (Number(cell.gio_hc_ngay)) segs.push(`HC ngày ${fmtNum(cell.gio_hc_ngay)}h`);
  if (Number(cell.gio_tc_ngay)) segs.push(`TC ngày ${fmtNum(cell.gio_tc_ngay)}h`);
  if (Number(cell.gio_hc_dem))  segs.push(`HC đêm ${fmtNum(cell.gio_hc_dem)}h`);
  if (Number(cell.gio_tc_dem))  segs.push(`TC đêm ${fmtNum(cell.gio_tc_dem)}h`);
  return segs.length ? segs.join(' · ') : 'Chưa chấm';
}

export function cellColor(cell) {
  if (!cell) return { color: 'var(--text3)', bg: 'transparent' };
  if (cell.ca_lam === 'nghi_phep') return { color: 'var(--amber)', bg: 'rgba(255,179,68,0.12)' };
  if (cell.ca_lam === 'nghi_viec') return { color: 'var(--red)',   bg: 'rgba(255,95,114,0.12)' };
  const tc = Number(cell.gio_tc_ngay || 0) + Number(cell.gio_tc_dem || 0);
  const dem = Number(cell.gio_hc_dem || 0) + Number(cell.gio_tc_dem || 0);
  if (tc > 0)  return { color: 'var(--accent2)', bg: 'rgba(123,95,255,0.12)' };
  if (dem > 0) return { color: 'var(--teal)',    bg: 'rgba(45,212,191,0.12)' };
  if (totalGio(cell) > 0) return { color: 'var(--accent)', bg: 'rgba(79,124,255,0.12)' };
  return { color: 'var(--text3)', bg: 'transparent' };
}
