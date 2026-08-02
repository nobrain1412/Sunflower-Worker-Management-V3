/**
 * Model phục vụ xuất bảng công theo khuôn công ty.
 * Lấy chấm công của 1 công ty trong khoảng ngày (kỳ công do file mẫu quyết định),
 * kèm mã vân tay của công nhân để match với dòng trong file.
 */
const db = require('../utils/db');

/**
 * Lấy 4 loại giờ theo ngày cho mọi CN của 1 công ty trong khoảng [tuNgay, denNgay].
 * Lọc theo phan_cong.cong_ty_id (bảng công là per-phan_cong), không theo cong_nhan.cong_ty_id.
 * @returns {Array<{ma_van_tay, ngay:'YYYY-MM-DD', gio_hc_ngay, gio_tc_ngay, gio_hc_dem, gio_tc_dem}>}
 */
async function layCongTheoKhoang(congTyId, tuNgay, denNgay, maList = null) {
  const params = [congTyId, tuNgay, denNgay];
  let maFilter = '';
  if (Array.isArray(maList) && maList.length > 0) {
    params.push(maList);
    maFilter = `AND cn.ma_van_tay = ANY($${params.length}::text[])`;
  }
  const { rows } = await db.query(
    `SELECT cn.ma_van_tay,
            to_char(cc.ngay, 'YYYY-MM-DD')              AS ngay,
            COALESCE(cc.gio_hc_ngay, 0)::float          AS gio_hc_ngay,
            COALESCE(cc.gio_tc_ngay, 0)::float          AS gio_tc_ngay,
            COALESCE(cc.gio_hc_dem, 0)::float           AS gio_hc_dem,
            COALESCE(cc.gio_tc_dem, 0)::float           AS gio_tc_dem
       FROM cham_cong cc
       JOIN phan_cong pc ON pc.id = cc.phan_cong_id
       JOIN cong_nhan cn ON cn.id = pc.cong_nhan_id
      WHERE pc.cong_ty_id = $1
        AND cc.ngay BETWEEN $2::date AND $3::date
        AND cn.ma_van_tay IS NOT NULL
        AND cn.deleted_at IS NULL
        ${maFilter}`,
    params,
  );
  return rows;
}

/**
 * Người THỰC SỰ có công (>0) của 1 công ty trong kỳ. ma_van_tay có thể null.
 * @returns {Array<{cong_nhan_id, ho_ten, ma_van_tay, tong_gio}>}
 */
async function layNguoiCoCong(congTyId, tuNgay, denNgay) {
  const { rows } = await db.query(
    `SELECT cn.id AS cong_nhan_id, cn.ho_ten, cn.ma_van_tay,
            SUM(COALESCE(cc.gio_hc_ngay,0)+COALESCE(cc.gio_tc_ngay,0)
               +COALESCE(cc.gio_hc_dem,0)+COALESCE(cc.gio_tc_dem,0))::float AS tong_gio
       FROM cham_cong cc
       JOIN phan_cong pc ON pc.id = cc.phan_cong_id
       JOIN cong_nhan cn ON cn.id = pc.cong_nhan_id
      WHERE pc.cong_ty_id = $1
        AND cc.ngay BETWEEN $2::date AND $3::date
        AND cn.deleted_at IS NULL
      GROUP BY cn.id, cn.ho_ten, cn.ma_van_tay
      HAVING SUM(COALESCE(cc.gio_hc_ngay,0)+COALESCE(cc.gio_tc_ngay,0)
                +COALESCE(cc.gio_hc_dem,0)+COALESCE(cc.gio_tc_dem,0)) > 0`,
    [congTyId, tuNgay, denNgay],
  );
  return rows;
}

/**
 * Danh sách CN được phân công vào công ty, overlap với kỳ (dù có công hay không).
 * @returns {Array<{id, ho_ten, ma_van_tay, trang_thai}>}
 */
async function layRosterCongTy(congTyId, tuNgay, denNgay) {
  const { rows } = await db.query(
    `SELECT DISTINCT cn.id, cn.ho_ten, cn.ma_van_tay, cn.trang_thai
       FROM phan_cong pc
       JOIN cong_nhan cn ON cn.id = pc.cong_nhan_id
      WHERE pc.cong_ty_id = $1
        AND pc.ngay_bat_dau <= $3::date
        AND (pc.ngay_ket_thuc IS NULL OR pc.ngay_ket_thuc >= $2::date)
        AND cn.deleted_at IS NULL`,
    [congTyId, tuNgay, denNgay],
  );
  return rows;
}

/**
 * CN khớp theo mã vân tay (để biết mã nào trong file đã có hồ sơ trong hệ thống).
 * @returns {Array<{id, ho_ten, ma_van_tay, trang_thai}>}
 */
async function layCongNhanTheoMa(maList) {
  if (!Array.isArray(maList) || maList.length === 0) return [];
  const { rows } = await db.query(
    `SELECT id, ho_ten, ma_van_tay, trang_thai
       FROM cong_nhan
      WHERE ma_van_tay = ANY($1::text[]) AND deleted_at IS NULL`,
    [maList],
  );
  return rows;
}

module.exports = { layCongTheoKhoang, layNguoiCoCong, layRosterCongTy, layCongNhanTheoMa };
