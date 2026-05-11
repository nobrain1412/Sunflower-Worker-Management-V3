const db = require('../utils/db');

const ROLE_VALUES = ['admin', 'quan_ly', 'vender', 'cong_tac_vien', 'ke_toan'];

async function findByUsername(ten_dang_nhap) {
  const result = await db.query(
    `SELECT * FROM users WHERE ten_dang_nhap = $1 AND active = TRUE`,
    [ten_dang_nhap],
  );
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await db.query(
    `SELECT id, ten_dang_nhap, ho_ten, vai_tro, active, created_at,
            so_dien_thoai, ngan_hang, so_tai_khoan, ten_chu_tk,
            tien_cong_moi_nguoi
     FROM users WHERE id = $1`,
    [id],
  );
  return result.rows[0] || null;
}

// Lấy danh sách cong_ty_id mà quản lý này được phân công
async function findCongTyIds(userId) {
  const result = await db.query(
    `SELECT cong_ty_id FROM quan_ly_cong_ty WHERE user_id = $1`,
    [userId],
  );
  return result.rows.map((r) => r.cong_ty_id);
}

// Danh sách user (admin xem) — kèm số CN tuyển + công ty quản lý
async function findAll({ vai_tro } = {}) {
  const conditions = [];
  const params = [];
  if (vai_tro) { params.push(vai_tro); conditions.push(`u.vai_tro = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query(
    `SELECT u.id, u.ten_dang_nhap, u.ho_ten, u.vai_tro, u.active,
            u.so_dien_thoai, u.ngan_hang, u.so_tai_khoan, u.ten_chu_tk,
            u.tien_cong_moi_nguoi, u.created_at,
            -- Tổng CN người này tuyển (đang còn)
            (SELECT COUNT(*) FROM cong_nhan cn
              WHERE cn.nguoi_tuyen_id = u.id
                AND cn.deleted_at IS NULL) AS so_cn_tuyen,
            -- Tổng CN đang làm tại các công ty người này quản lý
            (SELECT COUNT(*) FROM cong_nhan cn
              WHERE cn.cong_ty_id IN (
                SELECT cong_ty_id FROM quan_ly_cong_ty WHERE user_id = u.id
              ) AND cn.deleted_at IS NULL) AS so_cn_quan_ly,
            -- Danh sách công ty đang quản lý (text)
            COALESCE((SELECT STRING_AGG(ct.ten_cong_ty, ', ')
              FROM quan_ly_cong_ty qct
              JOIN cong_ty ct ON ct.id = qct.cong_ty_id
              WHERE qct.user_id = u.id), '') AS cong_ty_quan_ly_ten,
            COALESCE((SELECT ARRAY_AGG(qct.cong_ty_id)
              FROM quan_ly_cong_ty qct
              WHERE qct.user_id = u.id), ARRAY[]::int[]) AS cong_ty_ids
     FROM users u
     ${where}
     ORDER BY u.id DESC`,
    params,
  );
  return result.rows;
}

async function create({
  ten_dang_nhap, mat_khau_hash, ho_ten, vai_tro,
  so_dien_thoai, ngan_hang, so_tai_khoan, ten_chu_tk,
  tien_cong_moi_nguoi,
}) {
  const result = await db.query(
    `INSERT INTO users
       (ten_dang_nhap, mat_khau_hash, ho_ten, vai_tro,
        so_dien_thoai, ngan_hang, so_tai_khoan, ten_chu_tk,
        tien_cong_moi_nguoi)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, ten_dang_nhap, ho_ten, vai_tro, active, so_dien_thoai,
               ngan_hang, so_tai_khoan, ten_chu_tk, tien_cong_moi_nguoi`,
    [ten_dang_nhap, mat_khau_hash, ho_ten, vai_tro,
     so_dien_thoai ?? null, ngan_hang ?? null, so_tai_khoan ?? null,
     ten_chu_tk ?? null, tien_cong_moi_nguoi ?? 0],
  );
  return result.rows[0];
}

async function update(id, data) {
  const allowed = ['ho_ten', 'vai_tro', 'active',
    'so_dien_thoai', 'ngan_hang', 'so_tai_khoan', 'ten_chu_tk',
    'tien_cong_moi_nguoi'];
  const fields = [], params = [];
  for (const f of allowed) {
    if (f in data) { params.push(data[f]); fields.push(`${f} = $${params.length}`); }
  }
  if (!fields.length) return findById(id);
  params.push(id);
  const result = await db.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING id`,
    params,
  );
  if (!result.rows[0]) return null;
  return findById(id);
}

// Set danh sách cong_ty người này quản lý (xoá cũ → thêm mới)
async function setCongTyIds(userId, congTyIds = []) {
  await db.query(`DELETE FROM quan_ly_cong_ty WHERE user_id = $1`, [userId]);
  for (const ctId of congTyIds) {
    await db.query(
      `INSERT INTO quan_ly_cong_ty (user_id, cong_ty_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [userId, ctId],
    );
  }
}

async function hardDelete(id) {
  const result = await db.query(
    `DELETE FROM users WHERE id = $1 RETURNING id`,
    [id],
  );
  return result.rows[0] || null;
}

module.exports = {
  ROLE_VALUES,
  findByUsername, findById, findCongTyIds, findAll,
  create, update, setCongTyIds, hardDelete,
};
