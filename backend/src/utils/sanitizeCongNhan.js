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

// Các field chỉ admin + người tuyển CN mới được xem.
// Quản lý cty (nếu không phải người tuyển) cũng KHÔNG được xem.
const FIELDS_AN_VOI_NON_RECRUITER = [
  'muon_xe', 'loai_xe', 'xe_da_tra', 'ngay_muon_xe', 'anh_xe',
  'trang_thai_noi_o',
];

function sanitizeForRole(row, vaiTro, viewerId) {
  if (!row) return row;
  let safe = row;
  if (vaiTro === 'ke_toan') {
    safe = { ...safe };
    FIELDS_AN_VOI_KE_TOAN.forEach((f) => { delete safe[f]; });
  }
  // Ẩn nhóm field "mượn xe + nơi ở" nếu không phải admin và không phải người tuyển.
  if (vaiTro !== 'admin' && row.nguoi_tuyen_id !== viewerId) {
    safe = { ...safe };
    FIELDS_AN_VOI_NON_RECRUITER.forEach((f) => { delete safe[f]; });
  }
  return safe;
}

function sanitizeListForRole(rows, vaiTro, viewerId) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((r) => sanitizeForRole(r, vaiTro, viewerId));
}

module.exports = {
  sanitizeForRole, sanitizeListForRole,
  FIELDS_AN_VOI_KE_TOAN, FIELDS_AN_VOI_NON_RECRUITER,
};
