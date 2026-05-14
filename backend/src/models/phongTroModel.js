/**
 * Phòng trọ model — phong_tro, thue_phong_tro
 */
const db = require('../utils/db');

async function findAll({ active } = {}) {
  const params = [];
  const cond = [];
  if (active !== undefined) { params.push(active === 'true' || active === true); cond.push(`pt.active = $${params.length}`); }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

  const result = await db.query(
    `SELECT pt.*,
            (SELECT COUNT(*)::int FROM thue_phong_tro tpt
              WHERE tpt.phong_tro_id = pt.id AND tpt.ngay_ra IS NULL) AS so_dang_o
       FROM phong_tro pt
       ${where}
      ORDER BY pt.ten ASC`,
    params,
  );
  return result.rows;
}

async function findById(id) {
  const result = await db.query(`SELECT * FROM phong_tro WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function create(data) {
  const result = await db.query(
    `INSERT INTO phong_tro
       (ten, dia_chi, map_url, chu_tro, sdt_chu_tro, so_phong, tien_phong, ghi_chu,
        ngan_hang, so_tai_khoan, ten_chu_tk)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [data.ten, data.dia_chi ?? null, data.map_url ?? null,
     data.chu_tro ?? null, data.sdt_chu_tro ?? null,
     data.so_phong ?? 0, data.tien_phong ?? 0, data.ghi_chu ?? null,
     data.ngan_hang ?? null, data.so_tai_khoan ?? null, data.ten_chu_tk ?? null],
  );
  return result.rows[0];
}

async function update(id, data) {
  const allowed = ['ten', 'dia_chi', 'map_url', 'chu_tro', 'sdt_chu_tro',
                   'so_phong', 'tien_phong', 'ghi_chu', 'active',
                   'ngan_hang', 'so_tai_khoan', 'ten_chu_tk'];
  const fields = [];
  const params = [];
  for (const f of allowed) {
    if (f in data) { params.push(data[f]); fields.push(`${f} = $${params.length}`); }
  }
  if (!fields.length) return null;
  params.push(id);
  const result = await db.query(
    `UPDATE phong_tro SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

async function remove(id) {
  // Chặn xoá nếu còn người đang ở
  const dangO = await db.query(
    `SELECT 1 FROM thue_phong_tro WHERE phong_tro_id = $1 AND ngay_ra IS NULL LIMIT 1`,
    [id],
  );
  if (dangO.rows.length) {
    const e = new Error('Phòng trọ còn công nhân đang ở, không thể xoá');
    e.statusCode = 400;
    throw e;
  }
  const result = await db.query(`DELETE FROM phong_tro WHERE id = $1 RETURNING id`, [id]);
  return result.rows[0] || null;
}

// ─── Thuê phòng trọ ───────────────────────────────────────
async function listThue(phongTroId) {
  const result = await db.query(
    `SELECT tpt.*,
            cn.ho_ten AS cong_nhan_ten,
            cn.so_dien_thoai
       FROM thue_phong_tro tpt
       JOIN cong_nhan cn ON cn.id = tpt.cong_nhan_id
      WHERE tpt.phong_tro_id = $1
      ORDER BY tpt.ngay_ra IS NULL DESC, tpt.ngay_vao DESC`,
    [phongTroId],
  );
  return result.rows;
}

async function ganCongNhan({ cong_nhan_id, phong_tro_id, ngay_vao, ghi_chu }) {
  const cn = await db.query(
    `SELECT id, trang_thai_noi_o FROM cong_nhan WHERE id = $1 AND deleted_at IS NULL`,
    [cong_nhan_id],
  );
  if (!cn.rows[0]) {
    const e = new Error('Không tìm thấy công nhân');
    e.statusCode = 404;
    throw e;
  }
  if (cn.rows[0].trang_thai_noi_o !== 'chua_co_phong') {
    const e = new Error('Chỉ gán phòng trọ cho công nhân có trạng thái "chưa có phòng"');
    e.statusCode = 400;
    throw e;
  }

  const result = await db.query(
    `INSERT INTO thue_phong_tro (cong_nhan_id, phong_tro_id, ngay_vao, ghi_chu)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [cong_nhan_id, phong_tro_id, ngay_vao, ghi_chu ?? null],
  );
  await db.query(
    `UPDATE cong_nhan SET trang_thai_noi_o = 'phong_tro' WHERE id = $1`,
    [cong_nhan_id],
  );
  return result.rows[0];
}

async function traPhong(thueId, ngay_ra) {
  const result = await db.query(
    `UPDATE thue_phong_tro
        SET ngay_ra = $1
      WHERE id = $2 AND ngay_ra IS NULL
      RETURNING *`,
    [ngay_ra, thueId],
  );
  const updated = result.rows[0] || null;
  if (updated) {
    const stillInPhongTro = await db.query(
      `SELECT 1 FROM thue_phong_tro WHERE cong_nhan_id = $1 AND ngay_ra IS NULL LIMIT 1`,
      [updated.cong_nhan_id],
    );
    const inKtx = await db.query(
      `SELECT 1 FROM thue_phong WHERE cong_nhan_id = $1 AND ngay_ra IS NULL LIMIT 1`,
      [updated.cong_nhan_id],
    );
    if (!stillInPhongTro.rows.length && !inKtx.rows.length) {
      await db.query(
        `UPDATE cong_nhan SET trang_thai_noi_o = 'chua_co_phong' WHERE id = $1`,
        [updated.cong_nhan_id],
      );
    }
  }
  return updated;
}

module.exports = {
  findAll, findById, create, update, remove,
  listThue, ganCongNhan, traPhong,
};
