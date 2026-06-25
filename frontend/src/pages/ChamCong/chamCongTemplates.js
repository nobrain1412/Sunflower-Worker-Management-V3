/**
 * Mirror FE của registry template chấm công theo công ty.
 * BE: backend/src/services/chamCongTemplates.js — GIỮ ĐỒNG BỘ THỦ CÔNG.
 *
 * FE chỉ cần biết MỖI CÔNG TY hiển thị BỘ CỘT giờ nào trên bảng tháng.
 * Key theo tên công ty đã chuẩn hoá (bỏ dấu + lowercase), fallback 'default'.
 */
import { BUCKETS } from './chamCongShared';

function normalizeKey(raw) {
  if (raw == null) return '';
  return String(raw)
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// key template → mảng bucket key hiển thị.
const COLUMNS = {
  default: ['gio_hc_ngay', 'gio_tc_ngay'],
  kangyin: ['gio_hc_ngay', 'gio_tc_ngay', 'gio_hc_dem', 'gio_tc_dem'],
};

// tên công ty chuẩn hoá → key template
const ALIASES = {
  'kangyin':         'kangyin',
  'cong ty kangyin': 'kangyin',
  'kang yin':        'kangyin',
};

// Trả về mảng bucket key cho công ty (fallback default).
export function resolveColumns(tenCongTy) {
  const key = ALIASES[normalizeKey(tenCongTy)] || 'default';
  return COLUMNS[key] || COLUMNS.default;
}

// Trả về danh sách bucket meta (label/color) theo công ty — để render header bảng.
export function resolveBuckets(tenCongTy) {
  const keys = resolveColumns(tenCongTy);
  return BUCKETS.filter((b) => keys.includes(b.key));
}
