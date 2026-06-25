/**
 * Cham cong model — CRUD chấm công cấp công nhân theo tháng.
 *
 * Mỗi bản ghi gắn với 1 phan_cong (cong_nhan ↔ cong_ty theo thời gian).
 * Nếu CN chuyển công ty → có nhiều phan_cong → mỗi cty 1 bảng riêng.
 *
 * Ràng buộc:
 * - Không cho ngày sau phan_cong.ngay_ket_thuc (nếu có)
 * - Không cho ngày sau cong_nhan.ngay_nghi_viec (nếu có)
 * - Chủ nhật vẫn cho chấm (FE tự quyết hiển thị)
 */
const db = require('../utils/db');

// Lấy các phan_cong active hoặc gần nhất của 1 CN trong tháng cho trước
async function findPhanCongByCongNhan(congNhanId, { thang, nam } = {}) {
  // Lấy mọi phan_cong overlap với tháng (bắt đầu trước cuối tháng và kết thúc sau đầu tháng/null)
  const params = [congNhanId];
  let dateFilter = '';
  if (thang && nam) {
    params.push(`${nam}-${String(thang).padStart(2, '0')}-01`);
    const monthIdx = params.length;
    dateFilter = `
      AND pc.ngay_bat_dau <= ($${monthIdx}::date + INTERVAL '1 month' - INTERVAL '1 day')::date
      AND (pc.ngay_ket_thuc IS NULL OR pc.ngay_ket_thuc >= $${monthIdx}::date)
    `;
  }
  const r = await db.query(
    `SELECT pc.id, pc.cong_nhan_id, pc.cong_ty_id, pc.ngay_bat_dau, pc.ngay_ket_thuc, pc.ghi_chu,
            ct.ten_cong_ty
     FROM phan_cong pc
     LEFT JOIN cong_ty ct ON ct.id = pc.cong_ty_id
     WHERE pc.cong_nhan_id = $1 ${dateFilter}
     ORDER BY pc.ngay_bat_dau ASC`,
    params,
  );
  return r.rows;
}

// Chấm công trong tháng cho 1 phan_cong
async function findByPhanCongThang(phanCongId, thang, nam) {
  const r = await db.query(
    `SELECT id, phan_cong_id, ngay, so_gio, so_gio_ot,
            gio_hc_ngay, gio_tc_ngay, gio_hc_dem, gio_tc_dem,
            gio_den, gio_nghi_trua, gio_ve,
            ca_lam, ghi_chu, created_at, updated_at
     FROM cham_cong
     WHERE phan_cong_id = $1
       AND EXTRACT(MONTH FROM ngay) = $2
       AND EXTRACT(YEAR  FROM ngay) = $3
     ORDER BY ngay ASC`,
    [phanCongId, thang, nam],
  );
  return r.rows;
}

// Chuẩn hoá 1 entry → 4 loại giờ + tổng. Hỗ trợ cả client cũ (chỉ gửi so_gio/so_gio_ot):
//   - nếu có bất kỳ cột gio_* nào → dùng 4 loại giờ
//   - nếu không → coi so_gio = HC ngày, so_gio_ot = TC ngày (giữ tương thích ngược)
function normalizeEntry(e) {
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const hasBuckets = ['gio_hc_ngay', 'gio_tc_ngay', 'gio_hc_dem', 'gio_tc_dem']
    .some((k) => e[k] !== undefined && e[k] !== null);

  let gioHcNgay = num(e.gio_hc_ngay);
  let gioTcNgay = num(e.gio_tc_ngay);
  const gioHcDem = num(e.gio_hc_dem);
  const gioTcDem = num(e.gio_tc_dem);
  if (!hasBuckets) {
    gioHcNgay = num(e.so_gio);
    gioTcNgay = num(e.so_gio_ot);
  }

  // Giờ chấm chi tiết — string 'HH:MM', để trống → null
  const clock = (v) => {
    if (v == null) return null;
    const s = String(v).trim();
    return s === '' ? null : s.slice(0, 8);
  };
  const gioDen      = clock(e.gio_den);
  const gioNghiTrua = clock(e.gio_nghi_trua);
  const gioVe       = clock(e.gio_ve);

  const caLam = e.ca_lam || null;
  // Nghỉ phép / nghỉ việc → mọi giờ = 0 (vẫn giữ mốc giờ chấm nếu có)
  if (caLam === 'nghi_phep' || caLam === 'nghi_viec') {
    return { gioHcNgay: 0, gioTcNgay: 0, gioHcDem: 0, gioTcDem: 0, soGio: 0, soGioOt: 0,
             gioDen, gioNghiTrua, gioVe, caLam };
  }
  const soGio   = gioHcNgay + gioHcDem;
  const soGioOt = gioTcNgay + gioTcDem;
  return { gioHcNgay, gioTcNgay, gioHcDem, gioTcDem, soGio, soGioOt,
           gioDen, gioNghiTrua, gioVe, caLam };
}

// Upsert 1 batch entries cho 1 phan_cong
// entries: [{ ngay, gio_hc_ngay, gio_tc_ngay, gio_hc_dem, gio_tc_dem, ca_lam, ghi_chu }]
//          (vẫn nhận so_gio/so_gio_ot cho client cũ)
// Trả về: { inserted, updated, deleted, baoNghi: [{ ngay, ca_lam }] }
async function upsertBatch(phanCongId, entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { inserted: 0, updated: 0, deleted: 0, baoNghi: [] };
  }

  // Lấy giới hạn ngày: phan_cong.ngay_ket_thuc + cong_nhan.ngay_nghi_viec
  const limitRes = await db.query(
    `SELECT pc.ngay_ket_thuc, cn.ngay_nghi_viec, pc.cong_nhan_id, pc.ngay_bat_dau
     FROM phan_cong pc
     JOIN cong_nhan cn ON cn.id = pc.cong_nhan_id
     WHERE pc.id = $1`,
    [phanCongId],
  );
  if (!limitRes.rows[0]) {
    const e = new Error('Không tìm thấy phân công');
    e.statusCode = 404; throw e;
  }
  const { ngay_ket_thuc, ngay_nghi_viec, ngay_bat_dau } = limitRes.rows[0];

  // Validate ngày
  for (const e of entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.ngay)) {
      const err = new Error(`Ngày không hợp lệ: ${e.ngay}`);
      err.statusCode = 400; err.code = 'VALIDATION_ERROR'; throw err;
    }
    if (e.ngay < ngay_bat_dau.toISOString().slice(0, 10)) {
      const err = new Error(`Ngày ${e.ngay} trước ngày bắt đầu phân công`);
      err.statusCode = 400; err.code = 'INVALID_DATE'; throw err;
    }
    if (ngay_ket_thuc && e.ngay > ngay_ket_thuc.toISOString().slice(0, 10)) {
      const err = new Error(`Ngày ${e.ngay} sau ngày kết thúc phân công`);
      err.statusCode = 400; err.code = 'INVALID_DATE'; throw err;
    }
    if (ngay_nghi_viec && e.ngay > ngay_nghi_viec.toISOString().slice(0, 10)) {
      const err = new Error(`Ngày ${e.ngay} sau ngày công nhân đã nghỉ việc`);
      err.statusCode = 400; err.code = 'INVALID_DATE'; throw err;
    }
  }

  let inserted = 0;
  let updated = 0;
  let deleted = 0;
  const baoNghi = [];

  await db.query('BEGIN');
  try {
    for (const e of entries) {
      const n = normalizeEntry(e);
      const ghiChu = e.ghi_chu || null;

      // Xoá entry nếu giờ + ca + mốc giờ chấm đều rỗng (cell trống = bỏ chấm)
      if (n.soGio === 0 && n.soGioOt === 0 && !n.caLam
          && !n.gioDen && !n.gioNghiTrua && !n.gioVe) {
        const del = await db.query(
          `DELETE FROM cham_cong WHERE phan_cong_id = $1 AND ngay = $2 RETURNING id`,
          [phanCongId, e.ngay],
        );
        if (del.rowCount) deleted += 1;
        continue;
      }

      const res = await db.query(
        `INSERT INTO cham_cong
           (phan_cong_id, ngay, so_gio, so_gio_ot,
            gio_hc_ngay, gio_tc_ngay, gio_hc_dem, gio_tc_dem,
            gio_den, gio_nghi_trua, gio_ve, ca_lam, ghi_chu)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (phan_cong_id, ngay) DO UPDATE
           SET so_gio = EXCLUDED.so_gio,
               so_gio_ot = EXCLUDED.so_gio_ot,
               gio_hc_ngay = EXCLUDED.gio_hc_ngay,
               gio_tc_ngay = EXCLUDED.gio_tc_ngay,
               gio_hc_dem = EXCLUDED.gio_hc_dem,
               gio_tc_dem = EXCLUDED.gio_tc_dem,
               gio_den = EXCLUDED.gio_den,
               gio_nghi_trua = EXCLUDED.gio_nghi_trua,
               gio_ve = EXCLUDED.gio_ve,
               ca_lam = EXCLUDED.ca_lam,
               ghi_chu = EXCLUDED.ghi_chu,
               updated_at = NOW()
         RETURNING (xmax = 0) AS inserted`,
        [phanCongId, e.ngay, n.soGio, n.soGioOt,
         n.gioHcNgay, n.gioTcNgay, n.gioHcDem, n.gioTcDem,
         n.gioDen, n.gioNghiTrua, n.gioVe, n.caLam, ghiChu],
      );
      if (res.rows[0]?.inserted) inserted += 1; else updated += 1;

      if (n.caLam === 'nghi_phep' || n.caLam === 'nghi_viec') {
        baoNghi.push({ ngay: e.ngay, ca_lam: n.caLam });
      }
    }
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }

  return { inserted, updated, deleted, baoNghi };
}

// Tổng hợp chấm công theo tháng cho nhiều CN.
// scope:
//   { type: 'all' }                          → admin/kế toán: xem tất cả
//   { type: 'cong_ty', ids: [...], userId }  → quản lý: CN thuộc công ty mình
//   { type: 'vender'|'nguoi_tuyen', userId } → người tuyển: CHỈ CN do mình tuyển (read-only)
// Trả về list CN + tổng giờ + chi tiết theo ngày
async function findThangByScope({ thang, nam, scope, cong_ty_id, nguoi_tuyen_id }) {
  const params = [thang, nam];
  const conditions = ['cn.deleted_at IS NULL'];

  // Lọc theo công ty PHẢI bám vào phan_cong (pc.cong_ty_id), KHÔNG bám cong_nhan.cong_ty_id.
  // Bảng công là per-phan_cong (mỗi công ty 1 bảng riêng); nếu lọc theo cn.cong_ty_id thì
  // sẽ kéo nhầm các phan_cong thuộc công ty khác của cùng công nhân → hiển thị sai công ty.
  if (scope?.type === 'cong_ty' && scope.ids?.length > 0) {
    params.push(scope.ids);
    conditions.push(`pc.cong_ty_id = ANY($${params.length}::int[])`);
  } else if (scope?.type === 'vender' || scope?.type === 'nguoi_tuyen') {
    // Người tuyển chỉ thấy CN do chính mình tuyển.
    params.push(scope.userId);
    conditions.push(`cn.nguoi_tuyen_id = $${params.length}`);
  }

  if (cong_ty_id) {
    params.push(cong_ty_id);
    conditions.push(`pc.cong_ty_id = $${params.length}`);
  }
  if (nguoi_tuyen_id) {
    params.push(nguoi_tuyen_id);
    conditions.push(`cn.nguoi_tuyen_id = $${params.length}`);
  }

  const where = conditions.join(' AND ');
  const r = await db.query(
    `SELECT pc.id          AS phan_cong_id,
            pc.cong_nhan_id,
            pc.cong_ty_id,
            pc.ngay_bat_dau,
            pc.ngay_ket_thuc,
            cn.ho_ten       AS cong_nhan_ten,
            cn.bo_phan      AS bo_phan,
            cn.trang_thai   AS cong_nhan_trang_thai,
            cn.ngay_nghi_viec,
            cn.nguoi_tuyen_id,
            ct.ten_cong_ty,
            COALESCE(json_agg(json_build_object(
              'ngay',        to_char(cc.ngay, 'YYYY-MM-DD'),
              'so_gio',      cc.so_gio,
              'so_gio_ot',   cc.so_gio_ot,
              'gio_hc_ngay', cc.gio_hc_ngay,
              'gio_tc_ngay', cc.gio_tc_ngay,
              'gio_hc_dem',  cc.gio_hc_dem,
              'gio_tc_dem',  cc.gio_tc_dem,
              'gio_den',       cc.gio_den,
              'gio_nghi_trua', cc.gio_nghi_trua,
              'gio_ve',        cc.gio_ve,
              'ca_lam',      cc.ca_lam,
              'ghi_chu',     cc.ghi_chu
            ) ORDER BY cc.ngay) FILTER (WHERE cc.id IS NOT NULL), '[]'::json) AS cham_cong,
            COALESCE(SUM(cc.so_gio + cc.so_gio_ot), 0) AS tong_gio,
            COALESCE(SUM(cc.so_gio), 0)                AS tong_gio_thuong,
            COALESCE(SUM(cc.so_gio_ot), 0)             AS tong_gio_ot
     FROM phan_cong pc
     JOIN cong_nhan cn ON cn.id = pc.cong_nhan_id
     LEFT JOIN cong_ty ct ON ct.id = pc.cong_ty_id
     LEFT JOIN cham_cong cc ON cc.phan_cong_id = pc.id
       AND EXTRACT(MONTH FROM cc.ngay) = $1
       AND EXTRACT(YEAR  FROM cc.ngay) = $2
     WHERE ${where}
       AND pc.ngay_bat_dau <= make_date($2::int, $1::int, 1) + INTERVAL '1 month' - INTERVAL '1 day'
       AND (pc.ngay_ket_thuc IS NULL OR pc.ngay_ket_thuc >= make_date($2::int, $1::int, 1))
     GROUP BY pc.id, cn.id, ct.id
     ORDER BY cn.ho_ten ASC, pc.ngay_bat_dau ASC`,
    params,
  );
  return r.rows;
}

module.exports = {
  findPhanCongByCongNhan,
  findByPhanCongThang,
  upsertBatch,
  findThangByScope,
};
