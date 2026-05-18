/**
 * Hoat dong log — audit log cho mọi hoạt động liên quan tới công nhân.
 *
 * Mỗi entry có:
 *   - loai: string code (vd 'chuyen_cong_ty', 'cham_cong_batch', ...)
 *   - muc_do: 'thuong' (mặc định, chỉ chủ user thấy) | 'quan_trong' (admin thấy ở log hệ thống)
 *   - cong_nhan_id: target CN (null nếu không liên quan)
 *   - nguoi_tuyen_id: snapshot người tuyển tại thời điểm log (cho activity feed)
 *   - du_lieu: JSONB chứa metadata (cty cũ/mới, số tiền hoàn, danh sách ngày...)
 *   - created_by: user thực hiện
 *
 * Đọc:
 *   - findByCongNhan: timeline 1 CN (cho CN Detail > tab Hệ thống)
 *   - findByCreatedBy: log của riêng 1 user (đăng nhập → xem lịch sử thao tác của mình)
 *   - findByNguoiTuyen: hoạt động liên quan tới CN do user này tuyển (Dashboard feed của vender)
 *   - findAll: dùng cho admin, mặc định CHỈ trả muc_do = 'quan_trong' (log hệ thống)
 */
const db = require('../utils/db');

const MUC_DO_VALUES = ['thuong', 'quan_trong'];

async function create({ loai, muc_do, cong_nhan_id, nguoi_tuyen_id, du_lieu, ghi_chu, created_by }) {
  const mucDoSafe = MUC_DO_VALUES.includes(muc_do) ? muc_do : 'thuong';
  const r = await db.query(
    `INSERT INTO hoat_dong_log (loai, muc_do, cong_nhan_id, nguoi_tuyen_id, du_lieu, ghi_chu, created_by)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
     RETURNING *`,
    [
      loai,
      mucDoSafe,
      cong_nhan_id ?? null,
      nguoi_tuyen_id ?? null,
      du_lieu ? JSON.stringify(du_lieu) : null,
      ghi_chu ?? null,
      created_by ?? null,
    ],
  );
  return r.rows[0];
}

// Timeline cho 1 công nhân cụ thể (dùng trong CN Detail > Hệ thống)
async function findByCongNhan(congNhanId, limit = 50) {
  const r = await db.query(
    `SELECT h.*, u.ho_ten AS created_by_ten, u.vai_tro AS created_by_vai_tro
     FROM hoat_dong_log h
     LEFT JOIN users u ON u.id = h.created_by
     WHERE h.cong_nhan_id = $1
     ORDER BY h.created_at DESC
     LIMIT $2`,
    [congNhanId, limit],
  );
  return r.rows;
}

// Log thao tác do chính user thực hiện — sổ hoạt động cá nhân.
async function findByCreatedBy(userId, { limit = 50, muc_do, loai } = {}) {
  const params = [userId];
  const conditions = ['h.created_by = $1'];
  if (muc_do) { params.push(muc_do); conditions.push(`h.muc_do = $${params.length}`); }
  if (loai)   { params.push(loai);   conditions.push(`h.loai = $${params.length}`); }
  params.push(limit);
  const r = await db.query(
    `SELECT h.*, cn.ho_ten AS cong_nhan_ten
     FROM hoat_dong_log h
     LEFT JOIN cong_nhan cn ON cn.id = h.cong_nhan_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY h.created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return r.rows;
}

// Hoạt động gần đây liên quan tới CN do 1 người tuyển (dashboard vender).
async function findByNguoiTuyen(nguoiTuyenId, limit = 20) {
  const r = await db.query(
    `SELECT h.*, cn.ho_ten AS cong_nhan_ten, u.ho_ten AS created_by_ten
     FROM hoat_dong_log h
     LEFT JOIN cong_nhan cn ON cn.id = h.cong_nhan_id
     LEFT JOIN users u      ON u.id  = h.created_by
     WHERE h.nguoi_tuyen_id = $1
        OR (h.cong_nhan_id IS NOT NULL AND cn.nguoi_tuyen_id = $1)
     ORDER BY h.created_at DESC
     LIMIT $2`,
    [nguoiTuyenId, limit],
  );
  return r.rows;
}

// Admin log hệ thống — mặc định chỉ muc_do='quan_trong' để không bị loãng.
// Truyền muc_do='tat_ca' nếu admin muốn xem cả log thường (debug).
async function findAll({ limit = 50, loai, muc_do = 'quan_trong' } = {}) {
  const params = [];
  const conditions = [];
  if (muc_do && muc_do !== 'tat_ca') {
    params.push(muc_do);
    conditions.push(`h.muc_do = $${params.length}`);
  }
  if (loai) { params.push(loai); conditions.push(`h.loai = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);
  const r = await db.query(
    `SELECT h.*, cn.ho_ten AS cong_nhan_ten, u.ho_ten AS created_by_ten
     FROM hoat_dong_log h
     LEFT JOIN cong_nhan cn ON cn.id = h.cong_nhan_id
     LEFT JOIN users u      ON u.id  = h.created_by
     ${where}
     ORDER BY h.created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return r.rows;
}

module.exports = { create, findByCongNhan, findByCreatedBy, findByNguoiTuyen, findAll };
