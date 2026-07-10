/**
 * Format ngày cho file xuất ra (Excel/PDF). Luôn đọc theo UTC để số ngày
 * không lệch khi server chạy ở múi giờ khác.
 */

// Date | ISO string → dd/mm/yyyy
function dmy(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

// 'yyyy-mm-dd' → dd/mm/yyyy (không dựng Date, tránh lệch múi giờ)
function dmyIso(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso ?? '');
}

module.exports = { dmy, dmyIso };
