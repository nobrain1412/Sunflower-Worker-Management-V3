/**
 * Tài chính model — giao_dich_tai_chinh, danh_muc_giao_dich
 */
const db = require('../utils/db');

// Tương thích cả với schema cũ (luong/thuong/...) lẫn schema mới (thu/chi/tieu).
const LOAI_CHI = ['chi','khau_tru','tam_ung','tien_phong_ktx','bao_hiem','dong_phuc','phat_nghi','khac'];
const LOAI_THU = ['thu','luong','thuong','phu_cap','hoan_ung'];

// ─── DANH_MUC ─────────────────────────────────────────────
// Mỗi user có danh mục thu/chi riêng + danh mục mặc định hệ thống (user_id IS NULL).
// userId = null → chỉ trả danh mục mặc định (dùng cho khi không cần lọc theo user).
async function findAllDanhMuc(loai, userId) {
  const params = [];
  const conditions = ['active = TRUE'];
  if (loai) { params.push(loai); conditions.push(`loai = $${params.length}`); }
  if (userId) {
    params.push(userId);
    conditions.push(`(user_id IS NULL OR user_id = $${params.length})`);
  } else {
    conditions.push('user_id IS NULL');
  }
  const result = await db.query(
    `SELECT * FROM danh_muc_giao_dich WHERE ${conditions.join(' AND ')} ORDER BY user_id NULLS FIRST, loai, ten`,
    params,
  );
  return result.rows;
}

async function findDanhMucById(id) {
  const result = await db.query(`SELECT * FROM danh_muc_giao_dich WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function createDanhMuc(data, userId) {
  const result = await db.query(
    `INSERT INTO danh_muc_giao_dich (ten, loai, mo_ta, user_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.ten, data.loai, data.mo_ta ?? null, userId ?? null],
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

async function deleteDanhMuc(id) {
  const result = await db.query(
    `DELETE FROM danh_muc_giao_dich WHERE id = $1 RETURNING id`,
    [id],
  );
  return result.rows[0] || null;
}

// ─── GIAO_DICH ────────────────────────────────────────────
async function findAll({
  page = 1,
  limit = 20,
  thang,
  nam,
  loai,
  cong_nhan_id,
  created_by,
}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (thang)        { params.push(thang);        conditions.push(`EXTRACT(MONTH FROM g.ngay) = $${params.length}`); }
  if (nam)          { params.push(nam);           conditions.push(`EXTRACT(YEAR FROM g.ngay)  = $${params.length}`); }
  if (loai)         { params.push(loai);          conditions.push(`g.loai = $${params.length}`); }
  if (cong_nhan_id) { params.push(cong_nhan_id);  conditions.push(`g.cong_nhan_id = $${params.length}`); }
  if (created_by)   { params.push(created_by);    conditions.push(`g.created_by = $${params.length}`); }

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
            u.ho_ten  AS created_by_ten,
            un.ho_ten AS nguoi_nhan_ten,
            ug.ho_ten AS nguoi_gui_ten
     FROM giao_dich_tai_chinh g
     LEFT JOIN cong_nhan cn ON cn.id = g.cong_nhan_id
     LEFT JOIN danh_muc_giao_dich dm ON dm.id = g.danh_muc_id
     LEFT JOIN users u ON u.id = g.created_by
     LEFT JOIN users un ON un.id = g.nguoi_nhan_id
     LEFT JOIN giao_dich_tai_chinh gk ON gk.id = g.lien_ket_id
     LEFT JOIN users ug ON ug.id = gk.created_by
     ${where}
     ORDER BY g.ngay DESC, g.id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { rows: result.rows, total };
}

// ADMIN — giám sát khoản CHI của kế toán & nhân viên.
// KHÔNG bao gồm khoản 'tieu' (chi tiêu cá nhân, riêng tư) và bỏ qua sổ của admin.
// Có thể lọc theo user, loại, tháng/năm để dễ quan sát.
async function findGiamSatChi({
  page = 1,
  limit = 50,
  thang,
  nam,
  loai,
  user_id,
}) {
  const offset = (page - 1) * limit;
  // Luôn: loại trừ 'tieu' + chỉ lấy giao dịch do user KHÁC admin tạo (có tác giả).
  const conditions = [`g.loai <> 'tieu'`, `u.vai_tro IS NOT NULL`, `u.vai_tro <> 'admin'`];
  const params = [];

  if (thang)   { params.push(thang);   conditions.push(`EXTRACT(MONTH FROM g.ngay) = $${params.length}`); }
  if (nam)     { params.push(nam);     conditions.push(`EXTRACT(YEAR FROM g.ngay)  = $${params.length}`); }
  if (loai)    { params.push(loai);    conditions.push(`g.loai = $${params.length}`); }
  if (user_id) { params.push(user_id); conditions.push(`g.created_by = $${params.length}`); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await db.query(
    `SELECT COUNT(*)
       FROM giao_dich_tai_chinh g
       JOIN users u ON u.id = g.created_by
     ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limit, offset);
  const result = await db.query(
    `SELECT g.*,
            cn.ho_ten AS cong_nhan_ten,
            dm.ten    AS danh_muc_ten,
            u.ho_ten  AS created_by_ten,
            u.vai_tro AS created_by_vai_tro
       FROM giao_dich_tai_chinh g
       JOIN users u ON u.id = g.created_by
       LEFT JOIN cong_nhan cn ON cn.id = g.cong_nhan_id
       LEFT JOIN danh_muc_giao_dich dm ON dm.id = g.danh_muc_id
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

function insertGiaoDich(executor, data) {
  return executor.query(
    `INSERT INTO giao_dich_tai_chinh
       (cong_nhan_id, danh_muc_id, loai, so_tien, ngay, ghi_chu, created_by,
        nguoi_nhan_id, lien_ket_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [data.cong_nhan_id ?? null, data.danh_muc_id ?? null, data.loai,
     data.so_tien, data.ngay, data.ghi_chu ?? null, data.created_by ?? null,
     data.nguoi_nhan_id ?? null, data.lien_ket_id ?? null],
  );
}

async function create(data) {
  const result = await insertGiaoDich(db, data);
  return result.rows[0];
}

// Khoản chi gán cho user khác: tạo khoản CHI gốc + khoản THU mirror trong sổ
// người nhận, trong cùng 1 transaction (dùng client riêng vì db là Pool).
async function createWithMirror(chiData, mirrorData) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const chiRes = await insertGiaoDich(client, chiData);
    const chi = chiRes.rows[0];
    await insertGiaoDich(client, { ...mirrorData, lien_ket_id: chi.id });
    await client.query('COMMIT');
    return chi;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Cập nhật số tiền đã hoàn (luỹ kế) cho khoản chi.
// da_hoan_tien = đã hoàn đủ; sync sang khoản thu mirror (nếu khoản chi được gán user khác)
// để người nhận thấy tiến độ hoàn — nhưng chỉ chủ khoản chi mới sửa được (check ở route).
async function capNhatHoanTien(id, soTienDaHoan) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE giao_dich_tai_chinh
       SET so_tien_da_hoan = $1,
           da_hoan_tien = ($1 >= so_tien),
           ngay_hoan = CASE WHEN $1 > 0 THEN CURRENT_DATE ELSE NULL END
       WHERE id = $2
         AND loai = ANY($3::text[])
       RETURNING *`,
      [soTienDaHoan, id, LOAI_CHI],
    );
    const row = result.rows[0] || null;
    if (row) {
      await client.query(
        `UPDATE giao_dich_tai_chinh
         SET so_tien_da_hoan = $1,
             da_hoan_tien = ($1 >= so_tien),
             ngay_hoan = CASE WHEN $1 > 0 THEN CURRENT_DATE ELSE NULL END
         WHERE lien_ket_id = $2`,
        [soTienDaHoan, id],
      );
    }
    await client.query('COMMIT');
    return row;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Tổng thu/chi N tháng gần nhất (cho biểu đồ).
// Mỗi user có sổ riêng → bắt buộc filter theo userId (created_by).
async function tongTheoThang(soThang = 5, userId) {
  if (!userId) return [];
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
       COALESCE(SUM(CASE WHEN g.loai = ANY($2::text[]) THEN g.so_tien - g.so_tien_da_hoan ELSE 0 END), 0) AS thu,
       COALESCE(SUM(CASE WHEN g.loai = ANY($3::text[]) THEN g.so_tien - g.so_tien_da_hoan ELSE 0 END), 0) AS chi,
       COALESCE(SUM(CASE WHEN g.loai = 'tieu'          THEN g.so_tien                      ELSE 0 END), 0) AS tieu
     FROM thang_series ts
     LEFT JOIN giao_dich_tai_chinh g
       ON date_trunc('month', g.ngay) = ts.m
       AND g.created_by = $4
     GROUP BY ts.m
     ORDER BY ts.m`,
    [soThang, LOAI_THU, LOAI_CHI, userId],
  );
  return result.rows;
}

// Tổng đã ứng (tam_ung) còn nợ của 1 công nhân
async function tinhTongDaUng(congNhanId) {
  const result = await db.query(
    `SELECT
       COALESCE(SUM(so_tien - so_tien_da_hoan), 0) AS con_no,
       COALESCE(SUM(so_tien),                   0) AS tong_ung
     FROM giao_dich_tai_chinh
     WHERE cong_nhan_id = $1 AND loai = 'tam_ung'`,
    [congNhanId],
  );
  return result.rows[0];
}

// Tổng thu/chi/tiêu trong tháng (dùng cho KPI).
// Mỗi user có sổ riêng → bắt buộc filter theo userId (created_by).
async function tinhTongThang(thang, nam, userId) {
  if (!userId) return { tong_thu: 0, tong_chi: 0, da_hoan: 0, tong_tieu: 0 };
  const result = await db.query(
    `SELECT
       SUM(CASE WHEN loai = ANY($3::text[]) THEN so_tien - so_tien_da_hoan ELSE 0 END) AS tong_thu,
       SUM(CASE WHEN loai = ANY($4::text[]) THEN so_tien - so_tien_da_hoan ELSE 0 END) AS tong_chi,
       SUM(CASE WHEN loai = ANY($4::text[]) THEN so_tien_da_hoan ELSE 0 END)           AS da_hoan,
       SUM(CASE WHEN loai = 'tieu' THEN so_tien ELSE 0 END)                            AS tong_tieu
     FROM giao_dich_tai_chinh
     WHERE EXTRACT(MONTH FROM ngay) = $1 AND EXTRACT(YEAR FROM ngay) = $2
       AND created_by = $5`,
    [thang, nam, LOAI_THU, LOAI_CHI, userId],
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
  findAllDanhMuc, findDanhMucById, createDanhMuc, updateDanhMuc, deleteDanhMuc,
  findAll, findGiamSatChi, findById, create, createWithMirror, capNhatHoanTien, deleteOne,
  tinhTongThang, tongTheoThang, tinhTongDaUng,
  LOAI_CHI, LOAI_THU,
};
