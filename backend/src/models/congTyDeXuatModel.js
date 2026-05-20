const db = require('../utils/db');

/**
 * Tạo đề xuất mới (tạo công ty hoặc sửa).
 */
async function create({ loai, cong_ty_id, du_lieu, ghi_chu, nguoi_de_xuat_id }) {
  const { rows } = await db.query(
    `INSERT INTO cong_ty_de_xuat
       (loai, cong_ty_id, du_lieu, ghi_chu, nguoi_de_xuat_id)
     VALUES ($1, $2, $3::jsonb, $4, $5)
     RETURNING *`,
    [loai, cong_ty_id ?? null, JSON.stringify(du_lieu), ghi_chu ?? null, nguoi_de_xuat_id],
  );
  return rows[0];
}

/**
 * List đề xuất với filter.
 *   - trang_thai: optional
 *   - nguoi_de_xuat_id: optional (quan_ly chỉ xem của mình)
 *   - cong_ty_id: optional
 */
async function findAll({ trang_thai, nguoi_de_xuat_id, cong_ty_id } = {}) {
  const conds = [];
  const params = [];
  if (trang_thai) { params.push(trang_thai); conds.push(`dx.trang_thai = $${params.length}`); }
  if (nguoi_de_xuat_id) { params.push(nguoi_de_xuat_id); conds.push(`dx.nguoi_de_xuat_id = $${params.length}`); }
  if (cong_ty_id) { params.push(cong_ty_id); conds.push(`dx.cong_ty_id = $${params.length}`); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT dx.id, dx.loai, dx.cong_ty_id, dx.du_lieu, dx.trang_thai,
            dx.ghi_chu, dx.ghi_chu_admin,
            dx.nguoi_de_xuat_id, dx.nguoi_duyet_id, dx.duyet_luc,
            dx.created_at, dx.updated_at,
            ud.ho_ten AS nguoi_de_xuat_ho_ten,
            ua.ho_ten AS nguoi_duyet_ho_ten,
            ct.ten_cong_ty AS cong_ty_ten_hien_tai
     FROM cong_ty_de_xuat dx
     LEFT JOIN users ud ON ud.id = dx.nguoi_de_xuat_id
     LEFT JOIN users ua ON ua.id = dx.nguoi_duyet_id
     LEFT JOIN cong_ty ct ON ct.id = dx.cong_ty_id
     ${where}
     ORDER BY dx.created_at DESC
     LIMIT 200`,
    params,
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query(
    `SELECT dx.*,
            ud.ho_ten AS nguoi_de_xuat_ho_ten,
            ua.ho_ten AS nguoi_duyet_ho_ten,
            ct.ten_cong_ty AS cong_ty_ten_hien_tai
     FROM cong_ty_de_xuat dx
     LEFT JOIN users ud ON ud.id = dx.nguoi_de_xuat_id
     LEFT JOIN users ua ON ua.id = dx.nguoi_duyet_id
     LEFT JOIN cong_ty ct ON ct.id = dx.cong_ty_id
     WHERE dx.id = $1`,
    [id],
  );
  return rows[0] || null;
}

async function markApproved(id, nguoiDuyetId, ghiChuAdmin) {
  const { rows } = await db.query(
    `UPDATE cong_ty_de_xuat
     SET trang_thai = 'da_duyet',
         nguoi_duyet_id = $2,
         ghi_chu_admin = $3,
         duyet_luc = NOW()
     WHERE id = $1 AND trang_thai = 'cho_duyet'
     RETURNING *`,
    [id, nguoiDuyetId, ghiChuAdmin ?? null],
  );
  return rows[0] || null;
}

async function markRejected(id, nguoiDuyetId, ghiChuAdmin) {
  const { rows } = await db.query(
    `UPDATE cong_ty_de_xuat
     SET trang_thai = 'tu_choi',
         nguoi_duyet_id = $2,
         ghi_chu_admin = $3,
         duyet_luc = NOW()
     WHERE id = $1 AND trang_thai = 'cho_duyet'
     RETURNING *`,
    [id, nguoiDuyetId, ghiChuAdmin ?? null],
  );
  return rows[0] || null;
}

async function countPending() {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM cong_ty_de_xuat WHERE trang_thai = 'cho_duyet'`,
  );
  return rows[0]?.n ?? 0;
}

module.exports = { create, findAll, findById, markApproved, markRejected, countPending };
