const db = require('../utils/db');

/**
 * Tất cả SQL liên quan đến cong_nhan tập trung ở đây.
 * Controller không được viết SQL trực tiếp.
 */

// scope: { type: 'all' } | { type: 'vender', userId } | { type: 'cong_ty', ids: [] }
// Scope 'cong_ty' yêu cầu bảng phan_cong (sẽ implement ở migration tiếp theo)
async function findAll({ page = 1, limit = 20, sort = 'ho_ten', order = 'asc', trang_thai, search, vender_id, cong_ty_id, tinh, ngay, scope }) {
  const offset = (page - 1) * limit;
  const allowedSort = ['ho_ten', 'ngay_sinh', 'created_at', 'trang_thai'];
  const safeSort = allowedSort.includes(sort) ? sort : 'ho_ten';
  const safeOrder = order === 'desc' ? 'DESC' : 'ASC';

  const conditions = ['cn.deleted_at IS NULL'];
  const params = [];

  // Áp dụng scope theo role
  if (scope?.type === 'vender') {
    params.push(scope.userId);
    conditions.push(`cn.nguoi_tuyen_id = $${params.length}`);
  } else if (scope?.type === 'cong_ty' && scope.ids?.length > 0) {
    // TODO: filter qua phan_cong khi bảng đó được tạo
  }

  // Filter user-supplied (admin/quản lý)
  if (vender_id) {
    params.push(vender_id);
    conditions.push(`cn.nguoi_tuyen_id = $${params.length}`);
  }
  if (cong_ty_id) {
    params.push(cong_ty_id);
    conditions.push(`cn.cong_ty_id = $${params.length}`);
  }

  if (trang_thai) {
    params.push(trang_thai);
    conditions.push(`cn.trang_thai = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(cn.ho_ten ILIKE $${params.length} OR cn.cccd LIKE $${params.length} OR cn.so_dien_thoai LIKE $${params.length})`);
  }

  if (tinh) {
    params.push(`%${tinh}%`);
    conditions.push(`cn.que_quan ILIKE $${params.length}`);
  }

  if (ngay) {
    params.push(ngay);
    conditions.push(`cn.ngay_vao_lam = $${params.length}`);
  }

  const where = conditions.join(' AND ');

  const countResult = await db.query(
    `SELECT COUNT(*) FROM cong_nhan cn WHERE ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limit, offset);
  const rows = await db.query(
    `SELECT cn.id, cn.ho_ten, cn.ngay_sinh, cn.gioi_tinh,
            cn.so_dien_thoai, cn.trang_thai, cn.ngay_vao_lam, cn.created_at,
            cn.nguoi_tuyen_id, cn.cong_ty_id,
            u.ho_ten   AS nguoi_tuyen_ho_ten,
            u.vai_tro  AS nguoi_tuyen_vai_tro,
            ct.ten_cong_ty
     FROM cong_nhan cn
     LEFT JOIN users   u  ON u.id  = cn.nguoi_tuyen_id
     LEFT JOIN cong_ty ct ON ct.id = cn.cong_ty_id
     WHERE ${where}
     ORDER BY cn.${safeSort} ${safeOrder}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return { rows: rows.rows, total };
}

async function findById(id) {
  const result = await db.query(
    `SELECT cn.*,
            u.ho_ten  AS nguoi_tuyen_ho_ten,
            u.vai_tro AS nguoi_tuyen_vai_tro,
            ct.ten_cong_ty,
            ct.tien_dong_phuc,
            ct.tien_phat_nghi
     FROM cong_nhan cn
     LEFT JOIN users   u  ON u.id  = cn.nguoi_tuyen_id
     LEFT JOIN cong_ty ct ON ct.id = cn.cong_ty_id
     WHERE cn.id = $1 AND cn.deleted_at IS NULL`,
    [id],
  );
  return result.rows[0] || null;
}

async function findByCccd(cccd, excludeId = null) {
  const params = [cccd];
  let sql = `SELECT id FROM cong_nhan WHERE cccd = $1 AND deleted_at IS NULL`;
  if (excludeId) {
    params.push(excludeId);
    sql += ` AND id != $2`;
  }
  const result = await db.query(sql, params);
  return result.rows[0] || null;
}

async function create(data) {
  const {
    ho_ten, cccd, ngay_sinh, gioi_tinh, que_quan,
    dia_chi_hien_tai, so_dien_thoai, ngay_cap_cccd,
    noi_cap_cccd, trang_thai, ngay_vao_lam, ghi_chu,
    nguoi_tuyen_id, cong_ty_id,
    ngan_hang, so_tai_khoan, ten_chu_tk,
    cccd_da_tra, muon_xe, loai_xe,
  } = data;

  const result = await db.query(
    `INSERT INTO cong_nhan
       (ho_ten, cccd, ngay_sinh, gioi_tinh, que_quan,
        dia_chi_hien_tai, so_dien_thoai, ngay_cap_cccd,
        noi_cap_cccd, trang_thai, ngay_vao_lam, ghi_chu, nguoi_tuyen_id, cong_ty_id,
        ngan_hang, so_tai_khoan, ten_chu_tk,
        cccd_da_tra, muon_xe, loai_xe)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     RETURNING *`,
    [ho_ten, cccd ?? null, ngay_sinh ?? null, gioi_tinh ?? null, que_quan ?? null,
     dia_chi_hien_tai ?? null, so_dien_thoai ?? null, ngay_cap_cccd ?? null,
     noi_cap_cccd ?? null, trang_thai ?? 'moi_vao', ngay_vao_lam ?? null, ghi_chu ?? null,
     nguoi_tuyen_id ?? null, cong_ty_id ?? null,
     ngan_hang ?? null, so_tai_khoan ?? null, ten_chu_tk ?? null,
     cccd_da_tra ?? false, muon_xe ?? false, loai_xe ?? null],
  );

  return result.rows[0];
}

async function update(id, data) {
  const fields = [];
  const params = [];

  const allowedFields = [
    'ho_ten', 'cccd', 'ngay_sinh', 'gioi_tinh', 'que_quan',
    'dia_chi_hien_tai', 'so_dien_thoai', 'ngay_cap_cccd',
    'noi_cap_cccd', 'trang_thai', 'ngay_vao_lam', 'ngay_nghi_viec', 'ghi_chu',
    'cong_ty_id', 'da_tra_dong_phuc', 'da_viet_don_nghi',
    'ngan_hang', 'so_tai_khoan', 'ten_chu_tk',
    'cccd_da_tra', 'muon_xe', 'loai_xe', 'xe_da_tra',
  ];

  for (const field of allowedFields) {
    if (field in data) {
      params.push(data[field]);
      fields.push(`${field} = $${params.length}`);
    }
  }

  if (fields.length === 0) return null;

  params.push(id);
  const result = await db.query(
    `UPDATE cong_nhan SET ${fields.join(', ')}
     WHERE id = $${params.length} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

// Cập nhật đường dẫn ảnh
async function updateAnh(id, fields) {
  // fields: { anh_cccd_truoc?, anh_cccd_sau?, anh_chan_dung? }
  const allowed = ['anh_cccd_truoc', 'anh_cccd_sau', 'anh_chan_dung'];
  const setClauses = [], params = [];
  for (const f of allowed) {
    if (f in fields) { params.push(fields[f]); setClauses.push(`${f} = $${params.length}`); }
  }
  if (!setClauses.length) return null;
  params.push(id);
  const result = await db.query(
    `UPDATE cong_nhan SET ${setClauses.join(', ')} WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

// Lấy danh sách CN theo cong_ty_id (dùng cho scope quan_ly)
async function findByCongTy(congTyIds) {
  if (!congTyIds?.length) return [];
  const placeholders = congTyIds.map((_, i) => `$${i + 1}`).join(',');
  const result = await db.query(
    `SELECT id FROM cong_nhan WHERE cong_ty_id = ANY(ARRAY[${placeholders}]::int[]) AND deleted_at IS NULL`,
    congTyIds,
  );
  return result.rows.map((r) => r.id);
}

// Tự động chuyển moi_vao → dang_lam sau 3 ngày đi làm
async function autoUpdateTrangThai() {
  await db.query(
    `UPDATE cong_nhan
     SET trang_thai = 'dang_lam'
     WHERE trang_thai = 'moi_vao'
       AND ngay_vao_lam IS NOT NULL
       AND ngay_vao_lam + INTERVAL '3 days' <= CURRENT_DATE
       AND deleted_at IS NULL`,
  );
}

async function softDelete(id) {
  const result = await db.query(
    `UPDATE cong_nhan SET deleted_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [id],
  );
  return result.rows[0] || null;
}

module.exports = { findAll, findById, findByCccd, create, update, updateAnh, findByCongTy, softDelete, autoUpdateTrangThai };
