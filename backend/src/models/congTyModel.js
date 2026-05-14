const db = require('../utils/db');

async function findAll({ page = 1, limit = 20, sort = 'ten_cong_ty', order = 'asc', active }) {
  const offset = (page - 1) * limit;
  const allowedSort = ['ten_cong_ty', 'created_at'];
  const safeSort  = allowedSort.includes(sort) ? sort : 'ten_cong_ty';
  const safeOrder = order === 'desc' ? 'DESC' : 'ASC';

  const conditions = [];
  const params = [];

  if (active !== undefined) {
    params.push(active === 'true' || active === true);
    conditions.push(`active = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await db.query(`SELECT COUNT(*) FROM cong_ty ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limit, offset);
  const rows = await db.query(
    `SELECT id, ten_cong_ty, dia_chi, map_url, so_dien_thoai, email,
            luong_co_ban, luong_theo_gio, he_so_ot, ngay_lam_chuan,
            luong_tc_ngay, luong_hc_dem, luong_tc_dem, luong_chu_nhat, luong_ngay_le,
            tien_dong_phuc, tien_phat_nghi,
            don_gia_theo_gio_vender, tro_cap, chuyen_can, ngay_chot_cong,
            mo_ta_cong_viec, media_urls,
            active, created_at
     FROM cong_ty ${where}
     ORDER BY ${safeSort} ${safeOrder}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return { rows: rows.rows, total };
}

async function findById(id) {
  const result = await db.query(`SELECT * FROM cong_ty WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function create(data) {
  const { ten_cong_ty, dia_chi, map_url, so_dien_thoai, email,
          luong_co_ban, luong_theo_gio, he_so_ot, ngay_lam_chuan,
          luong_tc_ngay, luong_hc_dem, luong_tc_dem, luong_chu_nhat, luong_ngay_le,
          tien_dong_phuc, tien_phat_nghi,
          don_gia_theo_gio_vender, tro_cap, chuyen_can, ngay_chot_cong,
          mo_ta_cong_viec, media_urls,
          ghi_chu } = data;

  const result = await db.query(
    `INSERT INTO cong_ty
       (ten_cong_ty, dia_chi, map_url, so_dien_thoai, email,
        luong_co_ban, luong_theo_gio, he_so_ot, ngay_lam_chuan,
        luong_tc_ngay, luong_hc_dem, luong_tc_dem, luong_chu_nhat, luong_ngay_le,
        tien_dong_phuc, tien_phat_nghi,
        don_gia_theo_gio_vender, tro_cap, chuyen_can, ngay_chot_cong,
        mo_ta_cong_viec, media_urls,
        ghi_chu)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
     RETURNING *`,
    [ten_cong_ty, dia_chi ?? null, map_url ?? null, so_dien_thoai ?? null, email ?? null,
     luong_co_ban ?? 0, luong_theo_gio ?? 0, he_so_ot ?? 1.5, ngay_lam_chuan ?? 26,
     luong_tc_ngay ?? 0, luong_hc_dem ?? 0, luong_tc_dem ?? 0, luong_chu_nhat ?? 0, luong_ngay_le ?? 0,
     tien_dong_phuc ?? 0, tien_phat_nghi ?? 0,
     don_gia_theo_gio_vender ?? 0, tro_cap ?? 0, chuyen_can ?? 0, ngay_chot_cong ?? 25,
     mo_ta_cong_viec ?? null, JSON.stringify(media_urls ?? []),
     ghi_chu ?? null],
  );
  return result.rows[0];
}

async function update(id, data) {
  const allowed = ['ten_cong_ty', 'dia_chi', 'map_url', 'so_dien_thoai', 'email',
                   'luong_co_ban', 'luong_theo_gio', 'he_so_ot', 'ngay_lam_chuan',
                   'luong_tc_ngay', 'luong_hc_dem', 'luong_tc_dem', 'luong_chu_nhat', 'luong_ngay_le',
                   'tien_dong_phuc', 'tien_phat_nghi',
                   'don_gia_theo_gio_vender', 'tro_cap', 'chuyen_can', 'ngay_chot_cong',
                   'mo_ta_cong_viec', 'media_urls',
                   'active', 'ghi_chu'];
  const fields = [];
  const params = [];

  for (const field of allowed) {
    if (field in data) {
      // media_urls phải lưu dạng JSONB
      params.push(field === 'media_urls' ? JSON.stringify(data[field] ?? []) : data[field]);
      fields.push(`${field} = $${params.length}`);
    }
  }

  if (fields.length === 0) return null;

  params.push(id);
  const result = await db.query(
    `UPDATE cong_ty SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

// Lấy danh sách quản lý của 1 công ty
async function findQuanLy(congTyId) {
  const result = await db.query(
    `SELECT u.id, u.ho_ten, u.ten_dang_nhap, u.active
     FROM users u
     JOIN quan_ly_cong_ty qlct ON qlct.user_id = u.id
     WHERE qlct.cong_ty_id = $1`,
    [congTyId],
  );
  return result.rows;
}

// Gán quản lý vào công ty
async function assignQuanLy(congTyId, userId) {
  const result = await db.query(
    `INSERT INTO quan_ly_cong_ty (user_id, cong_ty_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, cong_ty_id) DO NOTHING
     RETURNING *`,
    [userId, congTyId],
  );
  return result.rows[0] || null;
}

// Gỡ quản lý khỏi công ty
async function removeQuanLy(congTyId, userId) {
  const result = await db.query(
    `DELETE FROM quan_ly_cong_ty WHERE user_id = $1 AND cong_ty_id = $2 RETURNING id`,
    [userId, congTyId],
  );
  return result.rows[0] || null;
}

module.exports = { findAll, findById, create, update, findQuanLy, assignQuanLy, removeQuanLy };
