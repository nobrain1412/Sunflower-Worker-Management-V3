/**
 * Phòng trọ model — phong_tro, thue_phong_tro
 */
const db = require('../utils/db');
const { toIso, timChongLanNoiO, loiChongLan } = require('./noiOChungModel');

// scope: { isAdmin: bool, userId: int }
// - admin: xem tất cả nhà trọ
// - khác: chỉ xem nhà trọ do chính mình tạo (nguoi_tao_id = userId)
async function findAll({ active, scope } = {}) {
  const params = [];
  const cond = [];
  if (active !== undefined) { params.push(active === 'true' || active === true); cond.push(`pt.active = $${params.length}`); }
  if (scope && !scope.isAdmin) {
    params.push(scope.userId);
    cond.push(`pt.nguoi_tao_id = $${params.length}`);
  }
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
        ngan_hang, so_tai_khoan, ten_chu_tk, media_urls, nguoi_tao_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [data.ten, data.dia_chi ?? null, data.map_url ?? null,
     data.chu_tro ?? null, data.sdt_chu_tro ?? null,
     data.so_phong ?? 0, data.tien_phong ?? 0, data.ghi_chu ?? null,
     data.ngan_hang ?? null, data.so_tai_khoan ?? null, data.ten_chu_tk ?? null,
     JSON.stringify(data.media_urls ?? []), data.nguoi_tao_id ?? null],
  );
  return result.rows[0];
}

async function update(id, data) {
  const allowed = ['ten', 'dia_chi', 'map_url', 'chu_tro', 'sdt_chu_tro',
                   'so_phong', 'tien_phong', 'ghi_chu', 'active',
                   'ngan_hang', 'so_tai_khoan', 'ten_chu_tk', 'media_urls'];
  const fields = [];
  const params = [];
  for (const f of allowed) {
    if (f in data) {
      params.push(f === 'media_urls' ? JSON.stringify(data[f] ?? []) : data[f]);
      fields.push(`${f} = $${params.length}`);
    }
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

async function findThueById(thueId) {
  const result = await db.query(`SELECT * FROM thue_phong_tro WHERE id = $1`, [thueId]);
  return result.rows[0] || null;
}

// Sửa ngày vào của 1 lượt ở phòng trọ (kể cả lượt đã trả phòng).
// Không kiểm tra sức chứa vì phòng trọ ở chung nhiều người; chỉ chặn việc một
// công nhân ở hai nơi cùng lúc.
async function suaNgayVaoThue(thueId, ngayVao) {
  const rec = await findThueById(thueId);
  if (!rec) return null;

  const ngayRa = toIso(rec.ngay_ra);
  if (ngayRa && ngayVao > ngayRa) {
    throw loiChongLan(`Ngày vào không được sau ngày ra (${ngayRa.split('-').reverse().join('/')})`);
  }

  const trung = await timChongLanNoiO({
    congNhanId: rec.cong_nhan_id, ngayVao, ngayRa, boQuaTroId: thueId,
  });
  if (trung) {
    const noi = trung.nguon === 'ktx' ? 'KTX' : 'phòng trọ';
    throw loiChongLan(
      `Khoảng thời gian này trùng với lượt ở ${noi} khác của công nhân (${trung.mo_ta}, `
      + `từ ${toIso(trung.ngay_vao)}${trung.ngay_ra ? ` đến ${toIso(trung.ngay_ra)}` : ' đến nay'})`,
    );
  }

  const result = await db.query(
    `UPDATE thue_phong_tro SET ngay_vao = $1 WHERE id = $2 RETURNING *`,
    [ngayVao, thueId],
  );
  return result.rows[0] || null;
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

// ─── Chuyển phòng trọ ────────────────────────────────────────
async function chuyenPhongTro(thueId, phongTroMoiId, ngayChuyen, ghiChu) {
  const cur = await db.query(
    `SELECT tpt.*, pt.ten AS ten_phong_tro, pt.tien_phong
       FROM thue_phong_tro tpt
       JOIN phong_tro pt ON pt.id = tpt.phong_tro_id
      WHERE tpt.id = $1 AND tpt.ngay_ra IS NULL`,
    [thueId],
  );
  if (!cur.rows[0]) {
    const e = new Error('Không tìm thấy bản ghi thuê đang active');
    e.statusCode = 404;
    throw e;
  }
  const cu = cur.rows[0];

  if (cu.phong_tro_id === phongTroMoiId) {
    const e = new Error('Phòng trọ mới phải khác phòng trọ hiện tại');
    e.statusCode = 400;
    throw e;
  }

  await db.query(`UPDATE thue_phong_tro SET ngay_ra = $1 WHERE id = $2`, [ngayChuyen, thueId]);

  const newRec = await db.query(
    `INSERT INTO thue_phong_tro (cong_nhan_id, phong_tro_id, ngay_vao, ghi_chu)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [cu.cong_nhan_id, phongTroMoiId, ngayChuyen, ghiChu ?? null],
  );

  const soNgay = Math.max(0, Math.round((new Date(ngayChuyen) - new Date(cu.ngay_vao)) / 86_400_000));
  return {
    phong_cu:  { ten: cu.ten_phong_tro, tien_phong: cu.tien_phong },
    thue_cu:   { id: cu.id, ngay_vao: cu.ngay_vao, ngay_ra: ngayChuyen, so_ngay: soNgay },
    thue_moi:  newRec.rows[0],
  };
}

// ─── Hóa đơn điện/nước phòng trọ ─────────────────────────────
async function findHoaDonByPhongTro(phongTroId) {
  const result = await db.query(
    `SELECT *,
            (dien_moi - dien_cu) * don_gia_dien AS tien_dien,
            (nuoc_moi - nuoc_cu) * don_gia_nuoc AS tien_nuoc
       FROM hoa_don_phong_tro
      WHERE phong_tro_id = $1
      ORDER BY nam DESC, thang DESC`,
    [phongTroId],
  );
  return result.rows;
}

async function findSoThangTruocPhongTro(phongTroId, thang, nam) {
  let prev_t = thang - 1, prev_n = nam;
  if (prev_t === 0) { prev_t = 12; prev_n -= 1; }
  const result = await db.query(
    `SELECT dien_moi, nuoc_moi FROM hoa_don_phong_tro
      WHERE phong_tro_id = $1 AND thang = $2 AND nam = $3`,
    [phongTroId, prev_t, prev_n],
  );
  return result.rows[0] || null;
}

async function createHoaDonPhongTro(data) {
  const result = await db.query(
    `INSERT INTO hoa_don_phong_tro
       (phong_tro_id, thang, nam, dien_cu, dien_moi, don_gia_dien,
        nuoc_cu, nuoc_moi, don_gia_nuoc, tien_phong, ghi_chu)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (phong_tro_id, thang, nam) DO UPDATE SET
       dien_cu = EXCLUDED.dien_cu, dien_moi = EXCLUDED.dien_moi,
       don_gia_dien = EXCLUDED.don_gia_dien,
       nuoc_cu = EXCLUDED.nuoc_cu, nuoc_moi = EXCLUDED.nuoc_moi,
       don_gia_nuoc = EXCLUDED.don_gia_nuoc,
       tien_phong = EXCLUDED.tien_phong, ghi_chu = EXCLUDED.ghi_chu,
       updated_at = NOW()
     RETURNING *,
       (dien_moi - dien_cu) * don_gia_dien AS tien_dien,
       (nuoc_moi - nuoc_cu) * don_gia_nuoc AS tien_nuoc`,
    [data.phong_tro_id, data.thang, data.nam,
     data.dien_cu ?? 0, data.dien_moi ?? 0, data.don_gia_dien ?? 0,
     data.nuoc_cu ?? 0, data.nuoc_moi ?? 0, data.don_gia_nuoc ?? 0,
     data.tien_phong ?? 0, data.ghi_chu ?? null],
  );
  return result.rows[0];
}

module.exports = {
  findAll, findById, create, update, remove,
  listThue, ganCongNhan, traPhong, chuyenPhongTro,
  findThueById, suaNgayVaoThue,
  findHoaDonByPhongTro, findSoThangTruocPhongTro, createHoaDonPhongTro,
};
