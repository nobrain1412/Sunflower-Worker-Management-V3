/**
 * Tài chính model — giao_dich_tai_chinh, danh_muc_giao_dich
 */
const db = require('../utils/db');

// Tương thích cả với schema cũ (luong/thuong/...) lẫn schema mới (thu/chi/tieu).
const LOAI_CHI = ['chi','khau_tru','tam_ung','tien_phong_ktx','bao_hiem','dong_phuc','phat_nghi','khac'];
const LOAI_THU = ['thu','luong','thuong','phu_cap','hoan_ung'];

// ─── DANH_MUC ─────────────────────────────────────────────
async function findAllDanhMuc(loai) {
  const params = [], conditions = ['active = TRUE'];
  if (loai) { params.push(loai); conditions.push(`loai = $${params.length}`); }
  const result = await db.query(
    `SELECT * FROM danh_muc_giao_dich WHERE ${conditions.join(' AND ')} ORDER BY loai, ten`,
    params,
  );
  return result.rows;
}

async function createDanhMuc(data) {
  const result = await db.query(
    `INSERT INTO danh_muc_giao_dich (ten, loai, mo_ta)
     VALUES ($1, $2, $3) RETURNING *`,
    [data.ten, data.loai, data.mo_ta ?? null],
  );
  return result.rows[0];
}

async function updateDanhMuc(id, data) {
  const allowed = ['ten', 'loai', 'mo_ta', 'active'];
  const fields = [], params = [];
  for (const f of allowed) {
    if (f in data) { params.push(data[f]); fields.push(`${f} = $${params.length}`); }
  }
  if (!fields.length) return null;
  params.push(id);
  const result = await db.query(
    `UPDATE danh_muc_giao_dich SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

// ─── GIAO_DICH ────────────────────────────────────────────
async function findAll({ page = 1, limit = 20, thang, nam, loai, cong_nhan_id }) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (thang)        { params.push(thang);        conditions.push(`EXTRACT(MONTH FROM g.ngay) = $${params.length}`); }
  if (nam)          { params.push(nam);           conditions.push(`EXTRACT(YEAR FROM g.ngay)  = $${params.length}`); }
  if (loai)         { params.push(loai);          conditions.push(`g.loai = $${params.length}`); }
  if (cong_nhan_id) { params.push(cong_nhan_id);  conditions.push(`g.cong_nhan_id = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await db.query(
    `SELECT COUNT(*) FROM giao_dich_tai_chinh g ${where}`, params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limit, offset);
  const result = await db.query(
    `SELECT g.*,
            cn.ho_ten AS cong_nhan_ten,
            dm.ten    AS danh_muc_ten,
            u.ho_ten  AS created_by_ten
     FROM giao_dich_tai_chinh g
     LEFT JOIN cong_nhan cn ON cn.id = g.cong_nhan_id
     LEFT JOIN danh_muc_giao_dich dm ON dm.id = g.danh_muc_id
     LEFT JOIN users u ON u.id = g.created_by
     ${where}
     ORDER BY g.ngay DESC, g.id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { rows: result.rows, total };
}

async function findById(id) {
  const result = await db.query(
    `SELECT g.*,
            cn.ho_ten AS cong_nhan_ten,
            dm.ten    AS danh_muc_ten
     FROM giao_dich_tai_chinh g
     LEFT JOIN cong_nhan cn ON cn.id = g.cong_nhan_id
     LEFT JOIN danh_muc_giao_dich dm ON dm.id = g.danh_muc_id
     WHERE g.id = $1`,
    [id],
  );
  return result.rows[0] || null;
}

async function create(data) {
  const result = await db.query(
    `INSERT INTO giao_dich_tai_chinh
       (cong_nhan_id, danh_muc_id, loai, so_tien, ngay, ghi_chu, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [data.cong_nhan_id ?? null, data.danh_muc_id ?? null, data.loai,
     data.so_tien, data.ngay, data.ghi_chu ?? null, data.created_by ?? null],
  );
  return result.rows[0];
}

async function toggleHoanTien(id, daHoanTien) {
  const result = await db.query(
    `UPDATE giao_dich_tai_chinh
     SET da_hoan_tien = $1,
         ngay_hoan = CASE WHEN $1 THEN CURRENT_DATE ELSE NULL END
     WHERE id = $2
       AND loai = ANY($3::text[])
     RETURNING *`,
    [daHoanTien, id, LOAI_CHI],
  );
  return result.rows[0] || null;
}

// Tổng thu/chi N tháng gần nhất (cho biểu đồ)
async function tongTheoThang(soThang = 5) {
  const result = await db.query(
    `WITH thang_series AS (
       SELECT generate_series(
         date_trunc('month', NOW()) - ($1::int - 1) * INTERVAL '1 month',
         date_trunc('month', NOW()),
         INTERVAL '1 month'
       ) AS m
     )
     SELECT
       EXTRACT(MONTH FROM ts.m)::int AS thang,
       EXTRACT(YEAR  FROM ts.m)::int AS nam,
       COALESCE(SUM(CASE WHEN g.loai = ANY($2::text[]) THEN g.so_tien ELSE 0 END), 0) AS thu,
       COALESCE(SUM(CASE WHEN g.loai = ANY($3::text[]) AND g.da_hoan_tien = FALSE THEN g.so_tien ELSE 0 END), 0) AS chi
     FROM thang_series ts
     LEFT JOIN giao_dich_tai_chinh g
       ON date_trunc('month', g.ngay) = ts.m
     GROUP BY ts.m
     ORDER BY ts.m`,
    [soThang, LOAI_THU, LOAI_CHI],
  );
  return result.rows;
}

// Tổng đã ứng (tam_ung) còn nợ của 1 công nhân
async function tinhTongDaUng(congNhanId) {
  const result = await db.query(
    `SELECT
       COALESCE(SUM(so_tien) FILTER (WHERE da_hoan_tien = FALSE), 0) AS con_no,
       COALESCE(SUM(so_tien),                                    0) AS tong_ung
     FROM giao_dich_tai_chinh
     WHERE cong_nhan_id = $1 AND loai = 'tam_ung'`,
    [congNhanId],
  );
  return result.rows[0];
}

// Tổng thu/chi/tiêu trong tháng (dùng cho KPI)
async function tinhTongThang(thang, nam) {
  const result = await db.query(
    `SELECT
       SUM(CASE WHEN loai = ANY($3::text[]) THEN so_tien ELSE 0 END)                              AS tong_thu,
       SUM(CASE WHEN loai = ANY($4::text[]) AND da_hoan_tien = FALSE THEN so_tien ELSE 0 END)     AS tong_chi,
       SUM(CASE WHEN loai = ANY($4::text[]) AND da_hoan_tien = TRUE  THEN so_tien ELSE 0 END)     AS da_hoan
     FROM giao_dich_tai_chinh
     WHERE EXTRACT(MONTH FROM ngay) = $1 AND EXTRACT(YEAR FROM ngay) = $2`,
    [thang, nam, LOAI_THU, LOAI_CHI],
  );
  return result.rows[0];
}

async function deleteOne(id) {
  const result = await db.query(
    `DELETE FROM giao_dich_tai_chinh WHERE id = $1 RETURNING id`,
    [id],
  );
  return result.rows[0] || null;
}

module.exports = {
  findAllDanhMuc, createDanhMuc, updateDanhMuc,
  findAll, findById, create, toggleHoanTien, deleteOne,
  tinhTongThang, tongTheoThang, tinhTongDaUng,
  LOAI_CHI, LOAI_THU,
};
