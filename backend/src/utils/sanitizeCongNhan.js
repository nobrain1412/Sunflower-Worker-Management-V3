/**
 * Ẩn các field nhạy cảm khỏi response công nhân tùy theo role.
 *
 * Kế toán:
 *   - Cần dữ liệu CCCD + lương + tiền trọ điện nước để chốt công, làm lương.
 *   - Không cần biết SĐT hay địa chỉ hiện tại (chỗ trọ thực tế) — đó là việc của
 *     người tuyển/quản lý phòng.
 *
 * Các role khác giữ nguyên dữ liệu.
 */

const FIELDS_AN_VOI_KE_TOAN = ['so_dien_thoai', 'dia_chi_hien_tai'];

function sanitizeForRole(row, vaiTro) {
  if (!row || vaiTro !== 'ke_toan') return row;
  const safe = { ...row };
  FIELDS_AN_VOI_KE_TOAN.forEach((f) => { delete safe[f]; });
  return safe;
}

function sanitizeListForRole(rows, vaiTro) {
  if (!Array.isArray(rows) || vaiTro !== 'ke_toan') return rows;
  return rows.map((r) => sanitizeForRole(r, vaiTro));
}

module.exports = { sanitizeForRole, sanitizeListForRole, FIELDS_AN_VOI_KE_TOAN };
