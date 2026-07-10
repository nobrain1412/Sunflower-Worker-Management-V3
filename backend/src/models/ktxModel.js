/**
 * KTX model — ky_tuc_xa, phong, giuong, thue_phong, hoa_don_ktx
 */
const db = require('../utils/db');

// ─── KY_TUC_XA ────────────────────────────────────────────
async function findAllKtx() {
  const result = await db.query(
    `SELECT k.*,
            COUNT(DISTINCT p.id) AS so_phong,
            COUNT(DISTINCT g.id) AS so_giuong
     FROM ky_tuc_xa k
     LEFT JOIN phong p   ON p.ktx_id = k.id AND p.active = TRUE
     LEFT JOIN giuong g  ON g.phong_id = p.id
     WHERE k.active = TRUE
     GROUP BY k.id
     ORDER BY k.ten`,
  );
  return result.rows;
}

async function findKtxById(id) {
  const result = await db.query(`SELECT * FROM ky_tuc_xa WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function createKtx(data) {
  const result = await db.query(
    `INSERT INTO ky_tuc_xa (ten, dia_chi, ghi_chu, media_urls)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.ten, data.dia_chi ?? null, data.ghi_chu ?? null, JSON.stringify(data.media_urls ?? [])],
  );
  return result.rows[0];
}

async function updateKtx(id, data) {
  const allowed = ['ten', 'dia_chi', 'ghi_chu', 'media_urls', 'active'];
  const fields = [], params = [];
  for (const f of allowed) {
    if (f in data) {
      params.push(f === 'media_urls' ? JSON.stringify(data[f] ?? []) : data[f]);
      fields.push(`${f} = $${params.length}`);
    }
  }
  if (!fields.length) return null;
  params.push(id);
  const result = await db.query(
    `UPDATE ky_tuc_xa SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

// ─── PHONG ────────────────────────────────────────────────
async function findPhongByKtx(ktxId) {
  const result = await db.query(
    `SELECT p.*,
            COUNT(g.id) AS so_giuong_thuc,
            SUM(CASE WHEN tp.ngay_ra IS NULL AND tp.id IS NOT NULL THEN 1 ELSE 0 END) AS so_dang_o
     FROM phong p
     LEFT JOIN giuong g  ON g.phong_id = p.id
     LEFT JOIN thue_phong tp ON tp.giuong_id = g.id AND tp.ngay_ra IS NULL
     WHERE p.ktx_id = $1 AND p.active = TRUE
     GROUP BY p.id
     ORDER BY p.tang, p.ten_phong`,
    [ktxId],
  );
  return result.rows;
}

async function findPhongById(id) {
  const result = await db.query(`SELECT * FROM phong WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function createPhong(data) {
  // Bảng phong có UNIQUE(ktx_id, ten_phong) trên toàn bảng (kể cả phòng đã xoá mềm).
  // Nếu đã tồn tại phòng cùng tên:
  //   - đang active  → báo lỗi trùng tên
  //   - đã xoá mềm   → BỎ soft delete (active = TRUE) + cập nhật lại thông tin
  const existed = await db.query(
    `SELECT * FROM phong WHERE ktx_id = $1 AND ten_phong = $2`,
    [data.ktx_id, data.ten_phong],
  );
  if (existed.rows[0]) {
    const cu = existed.rows[0];
    if (cu.active) {
      const err = new Error(`Phòng "${data.ten_phong}" đã tồn tại trong khu KTX này`);
      err.statusCode = 400; err.code = 'PHONG_DUPLICATE';
      throw err;
    }
    // Khôi phục phòng đã xoá mềm với thông tin mới
    const sucChua = data.suc_chua ?? cu.suc_chua;
    const reactivated = await db.query(
      `UPDATE phong
          SET active = TRUE, tang = $2, suc_chua = $3, tien_phong = $4, ghi_chu = $5
        WHERE id = $1 RETURNING *`,
      [cu.id, data.tang ?? cu.tang, sucChua, data.tien_phong ?? 0, data.ghi_chu ?? null],
    );
    const phong = reactivated.rows[0];
    // Đảm bảo đủ giường theo sức chứa (giữ giường cũ, chỉ thêm số còn thiếu)
    const g = await db.query(`SELECT so_thu_tu FROM giuong WHERE phong_id = $1`, [phong.id]);
    const have = new Set(g.rows.map((r) => r.so_thu_tu));
    for (let i = 1; i <= sucChua; i++) {
      if (!have.has(i)) {
        await db.query(`INSERT INTO giuong (phong_id, so_thu_tu) VALUES ($1,$2)`, [phong.id, i]);
      }
    }
    return phong;
  }

  const result = await db.query(
    `INSERT INTO phong (ktx_id, ten_phong, tang, suc_chua, tien_phong, ghi_chu)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [data.ktx_id, data.ten_phong, data.tang ?? 1, data.suc_chua ?? 6,
     data.tien_phong ?? 0, data.ghi_chu ?? null],
  );
  // Tự động tạo giường theo sức chứa
  const phong = result.rows[0];
  for (let i = 1; i <= phong.suc_chua; i++) {
    await db.query(
      `INSERT INTO giuong (phong_id, so_thu_tu) VALUES ($1, $2)`,
      [phong.id, i],
    );
  }
  return phong;
}

async function updatePhong(id, data) {
  const allowed = ['ten_phong', 'tang', 'suc_chua', 'tien_phong', 'ghi_chu', 'active'];
  const fields = [], params = [];
  for (const f of allowed) {
    if (f in data) { params.push(data[f]); fields.push(`${f} = $${params.length}`); }
  }
  if (!fields.length) return null;
  params.push(id);
  const result = await db.query(
    `UPDATE phong SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  const phong = result.rows[0] || null;
  // Nếu tăng sức chứa → tự thêm giường còn thiếu (giữ nguyên giường/người hiện có)
  if (phong && 'suc_chua' in data) {
    const g = await db.query(`SELECT so_thu_tu FROM giuong WHERE phong_id = $1`, [phong.id]);
    const have = new Set(g.rows.map((r) => r.so_thu_tu));
    for (let i = 1; i <= phong.suc_chua; i++) {
      if (!have.has(i)) {
        await db.query(`INSERT INTO giuong (phong_id, so_thu_tu) VALUES ($1,$2)`, [phong.id, i]);
      }
    }
  }
  return phong;
}

// Xoá mềm phòng. Nếu phòng đang có người ở: đóng bản ghi thuê + chuyển những
// người đó về trạng thái "chưa có phòng" (không có chỗ ở).
async function deletePhong(id) {
  const today = new Date().toISOString().slice(0, 10);
  return db.withTransaction(async (client) => {
    // Lấy danh sách người đang ở (thue_phong còn mở) thuộc các giường của phòng này
    const occ = await client.query(
      `SELECT tp.id AS thue_phong_id, tp.cong_nhan_id
         FROM thue_phong tp
         JOIN giuong g ON g.id = tp.giuong_id
        WHERE g.phong_id = $1 AND tp.ngay_ra IS NULL`,
      [id],
    );

    for (const row of occ.rows) {
      // Đóng bản ghi thuê phòng
      await client.query(
        `UPDATE thue_phong SET ngay_ra = $1 WHERE id = $2 AND ngay_ra IS NULL`,
        [today, row.thue_phong_id],
      );
      // Nếu không còn chỗ ở nào khác (KTX/phòng trọ) → về 'chua_co_phong'
      const stillKtx = await client.query(
        `SELECT 1 FROM thue_phong WHERE cong_nhan_id = $1 AND ngay_ra IS NULL LIMIT 1`,
        [row.cong_nhan_id],
      );
      const inTro = await client.query(
        `SELECT 1 FROM thue_phong_tro WHERE cong_nhan_id = $1 AND ngay_ra IS NULL LIMIT 1`,
        [row.cong_nhan_id],
      );
      if (!stillKtx.rows.length && !inTro.rows.length) {
        await client.query(
          `UPDATE cong_nhan SET trang_thai_noi_o = 'chua_co_phong' WHERE id = $1`,
          [row.cong_nhan_id],
        );
      }
    }

    const result = await client.query(
      `UPDATE phong SET active = FALSE WHERE id = $1 RETURNING id`, [id],
    );
    return result.rows[0] || null;
  });
}

// ─── GIUONG: sửa thông tin giường (số thứ tự, ghi chú) ─────
async function updateGiuong(id, data) {
  const allowed = ['so_thu_tu', 'ghi_chu'];
  const fields = [], params = [];
  for (const f of allowed) {
    if (f in data) { params.push(data[f]); fields.push(`${f} = $${params.length}`); }
  }
  if (!fields.length) return findGiuongById(id);
  params.push(id);
  const result = await db.query(
    `UPDATE giuong SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

async function findGiuongById(id) {
  const result = await db.query(`SELECT * FROM giuong WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

// ─── GIUONG (với chi tiết người đang ở) ────────────────────
async function findGiuongByPhong(phongId) {
  const result = await db.query(
    `SELECT g.*,
            tp.id       AS thue_phong_id,
            tp.ngay_vao,
            tp.ngay_ra,
            cn.id       AS cong_nhan_id,
            cn.ho_ten   AS cong_nhan_ten
     FROM giuong g
     LEFT JOIN thue_phong tp ON tp.giuong_id = g.id AND tp.ngay_ra IS NULL
     LEFT JOIN cong_nhan  cn ON cn.id = tp.cong_nhan_id
     WHERE g.phong_id = $1
     ORDER BY g.so_thu_tu`,
    [phongId],
  );
  return result.rows;
}

// ─── THUE_PHONG ────────────────────────────────────────────
async function xepGiuong(congNhanId, giuongId, ngayVao) {
  const cn = await db.query(
    `SELECT id, trang_thai_noi_o FROM cong_nhan WHERE id = $1 AND deleted_at IS NULL`,
    [congNhanId],
  );
  if (!cn.rows[0]) {
    const err = new Error('Không tìm thấy công nhân');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (cn.rows[0].trang_thai_noi_o !== 'chua_co_phong') {
    const err = new Error('Chỉ được xếp phòng cho công nhân có trạng thái "chưa có phòng"');
    err.statusCode = 400;
    err.code = 'INVALID_TRANG_THAI_NOI_O';
    throw err;
  }

  // Kiểm tra không trùng giường đang ở
  const check = await db.query(
    `SELECT id FROM thue_phong WHERE giuong_id = $1 AND ngay_ra IS NULL`,
    [giuongId],
  );
  if (check.rows.length) {
    const err = new Error('Giường đã có người ở');
    err.statusCode = 400; err.code = 'GIUONG_OCCUPIED';
    throw err;
  }
  // Đóng bản ghi cũ của công nhân này (nếu có)
  await db.query(
    `UPDATE thue_phong SET ngay_ra = $1 WHERE cong_nhan_id = $2 AND ngay_ra IS NULL`,
    [ngayVao, congNhanId],
  );
  const result = await db.query(
    `INSERT INTO thue_phong (cong_nhan_id, giuong_id, ngay_vao)
     VALUES ($1,$2,$3) RETURNING *`,
    [congNhanId, giuongId, ngayVao],
  );
  await db.query(
    `UPDATE cong_nhan
        SET trang_thai_noi_o = 'ktx'
      WHERE id = $1`,
    [congNhanId],
  );
  return result.rows[0];
}

async function traPhong(thuephongId, ngayRa) {
  const result = await db.query(
    `UPDATE thue_phong SET ngay_ra = $1 WHERE id = $2 AND ngay_ra IS NULL RETURNING *`,
    [ngayRa, thuephongId],
  );
  const updated = result.rows[0] || null;
  if (updated) {
    const stillInKtx = await db.query(
      `SELECT 1 FROM thue_phong WHERE cong_nhan_id = $1 AND ngay_ra IS NULL LIMIT 1`,
      [updated.cong_nhan_id],
    );
    const inPhongTro = await db.query(
      `SELECT 1 FROM thue_phong_tro WHERE cong_nhan_id = $1 AND ngay_ra IS NULL LIMIT 1`,
      [updated.cong_nhan_id],
    );
    if (!stillInKtx.rows.length && !inPhongTro.rows.length) {
      await db.query(
        `UPDATE cong_nhan SET trang_thai_noi_o = 'chua_co_phong' WHERE id = $1`,
        [updated.cong_nhan_id],
      );
    }
  }
  return updated;
}

async function findThuephongByCongNhan(congNhanId) {
  const result = await db.query(
    `SELECT tp.*, g.so_thu_tu, p.ten_phong, k.ten AS ktx_ten
     FROM thue_phong tp
     JOIN giuong g ON g.id = tp.giuong_id
     JOIN phong p  ON p.id = g.phong_id
     JOIN ky_tuc_xa k ON k.id = p.ktx_id
     WHERE tp.cong_nhan_id = $1
     ORDER BY tp.ngay_vao DESC`,
    [congNhanId],
  );
  return result.rows;
}

async function findUngVienXepPhong({ search, limit = 100 }) {
  const params = [];
  const conditions = [
    `cn.deleted_at IS NULL`,
    `cn.trang_thai IN ('dang_lam', 'moi_vao')`,
    `cn.trang_thai_noi_o = 'chua_co_phong'`,
    `NOT EXISTS (
      SELECT 1 FROM thue_phong tp
      WHERE tp.cong_nhan_id = cn.id AND tp.ngay_ra IS NULL
    )`,
    `NOT EXISTS (
      SELECT 1 FROM thue_phong_tro tpt
      WHERE tpt.cong_nhan_id = cn.id AND tpt.ngay_ra IS NULL
    )`,
  ];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(
      cn.ho_ten ILIKE $${params.length}
      OR cn.cccd ILIKE $${params.length}
      OR cn.so_dien_thoai ILIKE $${params.length}
    )`);
  }

  params.push(Math.min(Math.max(Number(limit) || 100, 1), 200));
  const result = await db.query(
    `SELECT cn.id, cn.ho_ten, cn.cccd, cn.so_dien_thoai, cn.trang_thai,
            cn.trang_thai_noi_o, ct.ten_cong_ty
     FROM cong_nhan cn
     LEFT JOIN cong_ty ct ON ct.id = cn.cong_ty_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY cn.ho_ten ASC
     LIMIT $${params.length}`,
    params,
  );

  return result.rows;
}

// ─── CHUYEN_PHONG ──────────────────────────────────────────
async function chuyenPhong(congNhanId, giuongMoiId, ngayChuyen) {
  const cur = await db.query(
    `SELECT tp.id, tp.ngay_vao, tp.giuong_id,
            p.tien_phong, p.ten_phong,
            k.ten AS ten_ktx
       FROM thue_phong tp
       JOIN giuong g  ON g.id = tp.giuong_id
       JOIN phong  p  ON p.id = g.phong_id
       JOIN ky_tuc_xa k ON k.id = p.ktx_id
      WHERE tp.cong_nhan_id = $1 AND tp.ngay_ra IS NULL`,
    [congNhanId],
  );
  if (!cur.rows[0]) {
    const e = new Error('Công nhân hiện không ở phòng KTX nào');
    e.statusCode = 400;
    throw e;
  }
  const cu = cur.rows[0];

  if (cu.giuong_id === giuongMoiId) {
    const e = new Error('Giường mới phải khác giường hiện tại');
    e.statusCode = 400;
    throw e;
  }

  const busy = await db.query(
    `SELECT 1 FROM thue_phong WHERE giuong_id = $1 AND ngay_ra IS NULL`,
    [giuongMoiId],
  );
  if (busy.rows.length) {
    const e = new Error('Giường mới đã có người ở');
    e.statusCode = 400;
    e.code = 'GIUONG_OCCUPIED';
    throw e;
  }

  await db.query(`UPDATE thue_phong SET ngay_ra = $1 WHERE id = $2`, [ngayChuyen, cu.id]);

  const newRec = await db.query(
    `INSERT INTO thue_phong (cong_nhan_id, giuong_id, ngay_vao) VALUES ($1,$2,$3) RETURNING *`,
    [congNhanId, giuongMoiId, ngayChuyen],
  );

  const soNgay = Math.max(0, Math.round((new Date(ngayChuyen) - new Date(cu.ngay_vao)) / 86_400_000));
  return {
    phong_cu:       { ten_phong: cu.ten_phong, ten_ktx: cu.ten_ktx, tien_phong: cu.tien_phong },
    thue_phong_cu:  { id: cu.id, ngay_vao: cu.ngay_vao, ngay_ra: ngayChuyen, so_ngay: soNgay },
    thue_phong_moi: newRec.rows[0],
  };
}

// ─── HOA_DON_KTX ───────────────────────────────────────────
async function findHoaDonByPhong(phongId) {
  const result = await db.query(
    `SELECT *,
            (dien_moi - dien_cu) * don_gia_dien AS tien_dien,
            (nuoc_moi - nuoc_cu) * don_gia_nuoc AS tien_nuoc
     FROM hoa_don_ktx
     WHERE phong_id = $1
     ORDER BY nam DESC, thang DESC`,
    [phongId],
  );
  return result.rows;
}

async function findHoaDonThang(phongId, thang, nam) {
  const result = await db.query(
    `SELECT *,
            (dien_moi - dien_cu) * don_gia_dien AS tien_dien,
            (nuoc_moi - nuoc_cu) * don_gia_nuoc AS tien_nuoc
     FROM hoa_don_ktx WHERE phong_id = $1 AND thang = $2 AND nam = $3`,
    [phongId, thang, nam],
  );
  return result.rows[0] || null;
}

// Lấy số điện/nước tháng trước để điền sẵn
async function findSoThangTruoc(phongId, thang, nam) {
  let thangTruoc = thang - 1, namTruoc = nam;
  if (thangTruoc === 0) { thangTruoc = 12; namTruoc -= 1; }
  const result = await db.query(
    `SELECT dien_moi, nuoc_moi FROM hoa_don_ktx
     WHERE phong_id = $1 AND thang = $2 AND nam = $3`,
    [phongId, thangTruoc, namTruoc],
  );
  return result.rows[0] || null;
}

async function createHoaDon(data) {
  const result = await db.query(
    `INSERT INTO hoa_don_ktx
       (phong_id, thang, nam, dien_cu, dien_moi, don_gia_dien,
        nuoc_cu, nuoc_moi, don_gia_nuoc, tien_phong, ghi_chu)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (phong_id, thang, nam) DO UPDATE SET
       dien_cu = EXCLUDED.dien_cu, dien_moi = EXCLUDED.dien_moi,
       don_gia_dien = EXCLUDED.don_gia_dien,
       nuoc_cu = EXCLUDED.nuoc_cu, nuoc_moi = EXCLUDED.nuoc_moi,
       don_gia_nuoc = EXCLUDED.don_gia_nuoc,
       tien_phong = EXCLUDED.tien_phong, ghi_chu = EXCLUDED.ghi_chu
     RETURNING *,
       (dien_moi - dien_cu) * don_gia_dien AS tien_dien,
       (nuoc_moi - nuoc_cu) * don_gia_nuoc AS tien_nuoc`,
    [data.phong_id, data.thang, data.nam,
     data.dien_cu ?? 0, data.dien_moi ?? 0, data.don_gia_dien ?? 0,
     data.nuoc_cu ?? 0, data.nuoc_moi ?? 0, data.don_gia_nuoc ?? 0,
     data.tien_phong ?? 0, data.ghi_chu ?? null],
  );
  return result.rows[0];
}

// ─── BÁO CÁO HÓA ĐƠN KTX THEO THÁNG ────────────────────────
// Tính tiền KTX cho 1 tháng: kỳ tính CỐ ĐỊNH từ ngày đầu tháng → ngày cuối tháng.
// Mỗi phòng có hoá đơn tháng đó (điện/nước/tiền phòng) → tổng tiền phòng được
// PHÂN BỔ cho từng công nhân đang ở theo SỐ NGÀY ở trong kỳ (ai ở nhiều trả nhiều).
// Người còn đang ở (chưa trả phòng) → chốt tới ngày cuối tháng.
// Trả mảng phẳng (1 dòng / công nhân) để xuất Excel.
async function findHoaDonKtxReport(thang, nam) {
  const monthStart = new Date(Date.UTC(nam, thang - 1, 1));
  const monthEnd   = new Date(Date.UTC(nam, thang, 0)); // ngày cuối tháng
  const startISO = monthStart.toISOString().slice(0, 10);
  const endISO   = monthEnd.toISOString().slice(0, 10);

  // Công nhân có thời gian ở KTX GIAO với [đầu tháng, cuối tháng]
  const occ = await db.query(
    `SELECT k.id AS ktx_id, k.ten AS ktx_ten, p.id AS phong_id, p.ten_phong, p.tang,
            p.tien_phong AS phong_tien_phong,
            cn.ho_ten AS cong_nhan_ten, cn.cccd,
            tp.ngay_vao, tp.ngay_ra
       FROM thue_phong tp
       JOIN giuong g     ON g.id = tp.giuong_id
       JOIN phong p      ON p.id = g.phong_id
       JOIN ky_tuc_xa k  ON k.id = p.ktx_id
       JOIN cong_nhan cn ON cn.id = tp.cong_nhan_id AND cn.deleted_at IS NULL
      WHERE tp.ngay_vao <= $2
        AND (tp.ngay_ra IS NULL OR tp.ngay_ra >= $1)
      ORDER BY k.ten, p.tang, p.ten_phong, cn.ho_ten`,
    [startISO, endISO],
  );

  // Hoá đơn (điện/nước/tiền phòng) của từng phòng trong tháng
  const hd = await db.query(
    `SELECT phong_id, dien_cu, dien_moi, don_gia_dien,
            nuoc_cu, nuoc_moi, don_gia_nuoc, tien_phong
       FROM hoa_don_ktx WHERE thang = $1 AND nam = $2`,
    [thang, nam],
  );
  const hoaDonByPhong = new Map(hd.rows.map((h) => [h.phong_id, h]));

  // Ngày (Date/ISO) → mốc UTC nửa đêm để đếm ngày không lệch múi giờ
  const toUtc = (d) => {
    if (!d) return null;
    const s = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
    const [y, m, dd] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, dd);
  };
  const startMs = toUtc(startISO), endMs = toUtc(endISO);
  // Số ngày ở trong kỳ (bao gồm cả 2 đầu mút); còn ở → chốt tới cuối tháng
  const soNgayTrongKy = (ngayVao, ngayRa) => {
    const a = Math.max(toUtc(ngayVao), startMs);
    const b = Math.min(ngayRa ? toUtc(ngayRa) : endMs, endMs);
    return Math.max(0, Math.floor((b - a) / 86_400_000) + 1);
  };

  // Gom công nhân theo phòng để phân bổ
  const byPhong = new Map();
  for (const r of occ.rows) {
    if (!byPhong.has(r.phong_id)) byPhong.set(r.phong_id, []);
    byPhong.get(r.phong_id).push(r);
  }

  const rows = [];
  for (const [phongId, occupants] of byPhong) {
    const h = hoaDonByPhong.get(phongId);
    const tienDien  = h ? Math.max(0, (Number(h.dien_moi) - Number(h.dien_cu)) * Number(h.don_gia_dien)) : 0;
    const tienNuoc  = h ? Math.max(0, (Number(h.nuoc_moi) - Number(h.nuoc_cu)) * Number(h.don_gia_nuoc)) : 0;
    const tienPhong = h ? Number(h.tien_phong) : Number(occupants[0].phong_tien_phong || 0);

    const daysArr = occupants.map((o) => soNgayTrongKy(o.ngay_vao, o.ngay_ra));
    const sumDays = daysArr.reduce((s, d) => s + d, 0);

    // Phân bổ 1 khoản theo tỉ lệ ngày; người cuối "gánh" phần lẻ để tổng khớp
    const allocate = (total) => {
      const T = Math.round(Number(total) || 0);
      if (sumDays <= 0) return occupants.map(() => 0);
      let acc = 0;
      return occupants.map((_, i) => {
        if (i === occupants.length - 1) return T - acc;
        const v = Math.round(T * daysArr[i] / sumDays);
        acc += v;
        return v;
      });
    };
    const aDien = allocate(tienDien);
    const aNuoc = allocate(tienNuoc);
    const aPhong = allocate(tienPhong);

    // Chỉ số công tơ của cả phòng — lặp lại trên mỗi dòng công nhân của phòng đó.
    // Phòng chưa nhập hoá đơn → null để file Excel bỏ trống thay vì hiện số 0 giả.
    const chiSo = {
      dien_cu:      h ? Number(h.dien_cu) : null,
      dien_moi:     h ? Number(h.dien_moi) : null,
      don_gia_dien: h ? Number(h.don_gia_dien) : null,
      nuoc_cu:      h ? Number(h.nuoc_cu) : null,
      nuoc_moi:     h ? Number(h.nuoc_moi) : null,
      don_gia_nuoc: h ? Number(h.don_gia_nuoc) : null,
    };

    occupants.forEach((o, i) => {
      const a = Math.max(toUtc(o.ngay_vao), startMs);
      const b = Math.min(o.ngay_ra ? toUtc(o.ngay_ra) : endMs, endMs);
      rows.push({
        ktx_id:        o.ktx_id,
        ktx_ten:       o.ktx_ten,
        ten_phong:     o.ten_phong,
        tang:          o.tang,
        cong_nhan_ten: o.cong_nhan_ten,
        cccd:          o.cccd,
        tu_ngay:       new Date(a).toISOString().slice(0, 10),
        den_ngay:      new Date(b).toISOString().slice(0, 10),
        so_ngay:       daysArr[i],
        ...chiSo,
        tien_dien:     aDien[i],
        tien_nuoc:     aNuoc[i],
        tien_phong:    aPhong[i],
        tong:          aDien[i] + aNuoc[i] + aPhong[i],
        co_hoa_don:    !!h,
      });
    });
  }
  return { rows, startISO, endISO };
}

module.exports = {
  findAllKtx, findKtxById, createKtx, updateKtx,
  findPhongByKtx, findPhongById, createPhong, updatePhong, deletePhong,
  findGiuongByPhong, findGiuongById, updateGiuong,
  xepGiuong, traPhong, chuyenPhong, findThuephongByCongNhan, findUngVienXepPhong,
  findHoaDonByPhong, findHoaDonThang, findSoThangTruoc, createHoaDon,
  findHoaDonKtxReport,
};
