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
    `SELECT ct.id, ct.ten_cong_ty, ct.dia_chi, ct.map_url, ct.so_dien_thoai, ct.email,
            ct.luong_co_ban, ct.luong_theo_gio, ct.he_so_ot, ct.ngay_lam_chuan,
            ct.luong_tc_ngay, ct.luong_hc_dem, ct.luong_tc_dem, ct.luong_chu_nhat, ct.luong_ngay_le,
            ct.tien_dong_phuc, ct.tien_phat_nghi,
            ct.tro_cap, ct.chuyen_can, ct.ngay_chot_cong,
            ct.tien_cong_quan_ly_theo_gio,
            ct.mo_ta_cong_viec, ct.media_urls,
            ct.active, ct.created_at,
            -- Số công nhân ĐANG làm tại công ty = số phan_cong còn mở (ngay_ket_thuc IS NULL).
            -- Bám phan_cong cho nhất quán với bảng công, không đếm theo cong_nhan.cong_ty_id.
            COALESCE((SELECT COUNT(DISTINCT pc.cong_nhan_id)
                      FROM phan_cong pc
                      JOIN cong_nhan cn ON cn.id = pc.cong_nhan_id
                      WHERE pc.cong_ty_id = ct.id
                        AND pc.ngay_ket_thuc IS NULL
                        AND cn.deleted_at IS NULL), 0) AS so_luong_hien_tai,
            -- Danh sách quản lý của công ty (id, họ tên, đăng nhập, SĐT)
            COALESCE((SELECT json_agg(json_build_object(
                       'id', u.id, 'ho_ten', u.ho_ten,
                       'ten_dang_nhap', u.ten_dang_nhap,
                       'so_dien_thoai', u.so_dien_thoai
                     ) ORDER BY u.ho_ten)
              FROM quan_ly_cong_ty qlct
              JOIN users u ON u.id = qlct.user_id
              WHERE qlct.cong_ty_id = ct.id), '[]'::json) AS quan_ly
     FROM cong_ty ct ${where.replace(/\bactive\b/g, 'ct.active')}
     ORDER BY ct.${safeSort} ${safeOrder}
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
          tro_cap, chuyen_can, ngay_chot_cong,
          tien_cong_quan_ly_theo_gio,
          mo_ta_cong_viec, media_urls,
          ghi_chu } = data;

  const result = await db.query(
    `INSERT INTO cong_ty
       (ten_cong_ty, dia_chi, map_url, so_dien_thoai, email,
        luong_co_ban, luong_theo_gio, he_so_ot, ngay_lam_chuan,
        luong_tc_ngay, luong_hc_dem, luong_tc_dem, luong_chu_nhat, luong_ngay_le,
        tien_dong_phuc, tien_phat_nghi,
        tro_cap, chuyen_can, ngay_chot_cong,
        tien_cong_quan_ly_theo_gio,
        mo_ta_cong_viec, media_urls,
        ghi_chu)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
     RETURNING *`,
    [ten_cong_ty, dia_chi ?? null, map_url ?? null, so_dien_thoai ?? null, email ?? null,
     luong_co_ban ?? 0, luong_theo_gio ?? 0, he_so_ot ?? 1.5, ngay_lam_chuan ?? 26,
     luong_tc_ngay ?? 0, luong_hc_dem ?? 0, luong_tc_dem ?? 0, luong_chu_nhat ?? 0, luong_ngay_le ?? 0,
     tien_dong_phuc ?? 0, tien_phat_nghi ?? 0,
     tro_cap ?? 0, chuyen_can ?? 0, ngay_chot_cong ?? 25,
     tien_cong_quan_ly_theo_gio ?? 0,
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
                   'tro_cap', 'chuyen_can', 'ngay_chot_cong',
                   'tien_cong_quan_ly_theo_gio',
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

// Xoá thật công ty + toàn bộ dữ liệu phụ thuộc (chấm công, phân công, phân quyền QL).
// cong_nhan.cong_ty_id sẽ tự SET NULL; user_cong_ty_rate & cong_ty_de_xuat tự CASCADE.
// Toàn bộ chạy trong 1 transaction để đảm bảo nguyên tử.
async function hardDelete(id) {
  await db.query('BEGIN');
  try {
    const exists = await db.query(`SELECT id FROM cong_ty WHERE id = $1`, [id]);
    if (exists.rows.length === 0) {
      await db.query('ROLLBACK');
      return null;
    }

    // 1. Chấm công thuộc các phân công của công ty
    await db.query(
      `DELETE FROM cham_cong
        WHERE phan_cong_id IN (SELECT id FROM phan_cong WHERE cong_ty_id = $1)`,
      [id],
    );
    // 2. Phân công (RESTRICT nên phải xoá trước cong_ty)
    await db.query(`DELETE FROM phan_cong WHERE cong_ty_id = $1`, [id]);
    // 3. Phân quyền quản lý ↔ công ty (RESTRICT)
    await db.query(`DELETE FROM quan_ly_cong_ty WHERE cong_ty_id = $1`, [id]);
    // 4. Xoá công ty (cong_nhan.cong_ty_id → NULL, rate & đề xuất CASCADE)
    const result = await db.query(`DELETE FROM cong_ty WHERE id = $1 RETURNING id`, [id]);

    await db.query('COMMIT');
    return result.rows[0] || null;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
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

// ─── Đơn giá thưởng theo (user × công ty) ─────────────────────
// Danh sách rate của 1 công ty cho mọi vender/CTV (kèm thông tin user)
async function findRatesByCongTy(congTyId) {
  const result = await db.query(
    `SELECT r.id, r.user_id, r.cong_ty_id,
            r.don_gia_theo_gio, r.tien_cong_moi_nguoi,
            u.ho_ten, u.ten_dang_nhap, u.vai_tro
       FROM user_cong_ty_rate r
       JOIN users u ON u.id = r.user_id
      WHERE r.cong_ty_id = $1
      ORDER BY u.vai_tro, u.ho_ten`,
    [congTyId],
  );
  return result.rows;
}

// Danh sách rate của 1 user ở mọi công ty (kèm tên công ty)
async function findRatesByUser(userId) {
  const result = await db.query(
    `SELECT r.id, r.user_id, r.cong_ty_id,
            r.don_gia_theo_gio, r.tien_cong_moi_nguoi,
            ct.ten_cong_ty
       FROM user_cong_ty_rate r
       JOIN cong_ty ct ON ct.id = r.cong_ty_id
      WHERE r.user_id = $1
      ORDER BY ct.ten_cong_ty`,
    [userId],
  );
  return result.rows;
}

// Upsert rate cho cặp (user, cong_ty)
async function upsertRate({ user_id, cong_ty_id, don_gia_theo_gio, tien_cong_moi_nguoi }) {
  const result = await db.query(
    `INSERT INTO user_cong_ty_rate (user_id, cong_ty_id, don_gia_theo_gio, tien_cong_moi_nguoi)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, cong_ty_id) DO UPDATE
       SET don_gia_theo_gio    = EXCLUDED.don_gia_theo_gio,
           tien_cong_moi_nguoi = EXCLUDED.tien_cong_moi_nguoi
     RETURNING *`,
    [user_id, cong_ty_id, don_gia_theo_gio ?? 0, tien_cong_moi_nguoi ?? 0],
  );
  return result.rows[0];
}

async function deleteRate(userId, congTyId) {
  const result = await db.query(
    `DELETE FROM user_cong_ty_rate WHERE user_id = $1 AND cong_ty_id = $2 RETURNING id`,
    [userId, congTyId],
  );
  return result.rows[0] || null;
}

module.exports = {
  findAll, findById, create, update, hardDelete,
  findQuanLy, assignQuanLy, removeQuanLy,
  findRatesByCongTy, findRatesByUser, upsertRate, deleteRate,
};
