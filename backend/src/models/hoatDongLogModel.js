/**
 * Hoat dong log — audit log cho mọi hoạt động liên quan tới công nhân.
 * Mỗi entry có:
 *   - loai: string code (vd 'chuyen_cong_ty', 'cham_cong_batch', ...)
 *   - cong_nhan_id: target CN (null nếu không liên quan)
 *   - nguoi_tuyen_id: snapshot người tuyển tại thời điểm log (cho activity feed)
 *   - du_lieu: JSONB chứa metadata (cty cũ/mới, số tiền hoàn, danh sách ngày...)
 *   - created_by: user thực hiện
 *
 * Đọc: tách 2 chế độ — theo CN (timeline) và theo người tuyển (activity feed).
 */
const db = require('../utils/db');

async function create({ loai, cong_nhan_id, nguoi_tuyen_id, du_lieu, ghi_chu, created_by }) {
  const r = await db.query(
    `INSERT INTO hoat_dong_log (loai, cong_nhan_id, nguoi_tuyen_id, du_lieu, ghi_chu, created_by)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6)
     RETURNING *`,
    [
      loai,
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

// Hoạt động gần đây cho 1 người tuyển (dashboard).
// Trả về các log mà cong_nhan do user này tuyển — bao gồm cả khi nguoi_tuyen_id
// snapshot khớp, hoặc log không có nguoi_tuyen_id nhưng cong_nhan hiện tại do họ tuyển.
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

// Tất cả hoạt động (admin)
async function findAll({ limit = 50, loai } = {}) {
  const params = [];
  const conditions = [];
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

module.exports = { create, findByCongNhan, findByNguoiTuyen, findAll };
