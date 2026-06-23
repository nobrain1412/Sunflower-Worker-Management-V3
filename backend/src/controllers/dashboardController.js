const db = require('../utils/db');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');

// Dashboard admin: tổng quan toàn hệ thống
const getAdminDashboard = asyncWrapper(async (req, res) => {
  const [
    kpiRow,
    ktxRow,
    cnTheoCongTy,
    cnTheoVender,
    cnMoiNhat,
    hoatDong,
    phongKtx,
  ] = await Promise.all([
    // KPI tổng hợp công nhân
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE deleted_at IS NULL)                                            AS tong_cong_nhan,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND trang_thai = 'dang_lam')                AS dang_lam,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND created_at::date = CURRENT_DATE)        AS cn_moi_hom_nay,
        COUNT(*) FILTER (WHERE deleted_at IS NULL
                          AND date_trunc('month', created_at) = date_trunc('month', NOW()))   AS cn_moi_thang_nay,
        COUNT(*) FILTER (WHERE deleted_at IS NULL
                          AND date_trunc('month', created_at) = date_trunc('month', NOW() - INTERVAL '1 month')) AS cn_moi_thang_truoc
      FROM cong_nhan
    `),
    // Sức chứa & lấp đầy KTX
    db.query(`
      SELECT
        (SELECT COUNT(*) FROM giuong g
           JOIN phong p ON p.id = g.phong_id AND p.active = TRUE
           JOIN ky_tuc_xa k ON k.id = p.ktx_id AND k.active = TRUE)                AS tong_giuong,
        (SELECT COUNT(*) FROM thue_phong WHERE ngay_ra IS NULL)                    AS dang_o
    `),
    // CN theo từng công ty (dùng cong_nhan.cong_ty_id)
    db.query(`
      SELECT ct.id, ct.ten_cong_ty,
             COUNT(cn.id) FILTER (WHERE cn.deleted_at IS NULL)                                                AS so_luong_cn,
             COUNT(cn.id) FILTER (WHERE cn.deleted_at IS NULL AND cn.created_at::date = CURRENT_DATE)         AS vao_hom_nay,
             COUNT(cn.id) FILTER (WHERE cn.deleted_at IS NULL
                                   AND date_trunc('month', cn.created_at) = date_trunc('month', NOW()))      AS vao_thang_nay
      FROM cong_ty ct
      LEFT JOIN cong_nhan cn ON cn.cong_ty_id = ct.id
      WHERE ct.active = TRUE
      GROUP BY ct.id, ct.ten_cong_ty
      ORDER BY ct.ten_cong_ty
    `),
    // CN theo từng vender
    db.query(`
      SELECT u.id, u.ho_ten,
             COUNT(cn.id)                                                                  AS so_luong_cn,
             COUNT(cn.id) FILTER (WHERE cn.created_at::date = CURRENT_DATE)                AS moi_hom_nay
      FROM users u
      LEFT JOIN cong_nhan cn ON cn.nguoi_tuyen_id = u.id AND cn.deleted_at IS NULL
      WHERE u.vai_tro IN ('vender','quan_ly','admin') AND u.active = TRUE
      GROUP BY u.id, u.ho_ten
      ORDER BY so_luong_cn DESC
      LIMIT 20
    `),
    // 10 CN mới nhất (kèm tên công ty)
    db.query(`
      SELECT cn.id, cn.ho_ten, cn.trang_thai, cn.created_at, cn.cong_ty_id,
             cn.nguoi_tuyen_id,
             ct.ten_cong_ty,
             u.ho_ten AS ten_nguoi_tuyen
      FROM cong_nhan cn
      LEFT JOIN cong_ty ct ON ct.id = cn.cong_ty_id
      LEFT JOIN users   u  ON u.id  = cn.nguoi_tuyen_id
      WHERE cn.deleted_at IS NULL
      ORDER BY cn.created_at DESC
      LIMIT 10
    `),
    // Hoạt động gần đây (gộp CN mới + giao dịch + xếp giường)
    db.query(`
      SELECT * FROM (
        SELECT 'cong_nhan' AS loai, cn.id, cn.ho_ten AS title, cn.created_at AS ts,
               NULL::numeric AS so_tien, NULL::text AS sub
        FROM cong_nhan cn WHERE cn.deleted_at IS NULL
        UNION ALL
        SELECT 'giao_dich', g.id,
               COALESCE(cn.ho_ten, '—') AS title,
               g.created_at AS ts,
               g.so_tien,
               g.loai AS sub
        FROM giao_dich_tai_chinh g
        LEFT JOIN cong_nhan cn ON cn.id = g.cong_nhan_id
        UNION ALL
        SELECT 'thue_phong', tp.id,
               COALESCE(cn.ho_ten, '—') AS title,
               tp.created_at AS ts,
               NULL::numeric,
               (k.ten || ' / ' || p.ten_phong) AS sub
        FROM thue_phong tp
        JOIN giuong g    ON g.id = tp.giuong_id
        JOIN phong p     ON p.id = g.phong_id
        JOIN ky_tuc_xa k ON k.id = p.ktx_id
        LEFT JOIN cong_nhan cn ON cn.id = tp.cong_nhan_id
      ) act ORDER BY ts DESC LIMIT 10
    `),
    // Phòng KTX (cho widget sơ đồ phòng)
    db.query(`
      SELECT p.id, p.ten_phong, p.suc_chua, k.ten AS ktx_ten,
             COUNT(tp.id) FILTER (WHERE tp.ngay_ra IS NULL) AS dang_o
      FROM phong p
      JOIN ky_tuc_xa k ON k.id = p.ktx_id AND k.active = TRUE
      LEFT JOIN giuong g  ON g.phong_id = p.id
      LEFT JOIN thue_phong tp ON tp.giuong_id = g.id AND tp.ngay_ra IS NULL
      WHERE p.active = TRUE
      GROUP BY p.id, p.ten_phong, p.suc_chua, k.ten
      ORDER BY k.ten, p.ten_phong
      LIMIT 16
    `),
  ]);

  const k = kpiRow.rows[0];
  const ktx = ktxRow.rows[0];
  const tongGiuong = parseInt(ktx.tong_giuong, 10) || 0;
  const dangO      = parseInt(ktx.dang_o, 10) || 0;

  sendSuccess(res, {
    kpi: {
      tong_cong_nhan:    parseInt(k.tong_cong_nhan, 10),
      dang_lam:          parseInt(k.dang_lam, 10),
      cn_moi_hom_nay:    parseInt(k.cn_moi_hom_nay, 10),
      cn_moi_thang_nay:  parseInt(k.cn_moi_thang_nay, 10),
      cn_moi_thang_truoc:parseInt(k.cn_moi_thang_truoc, 10),
      ktx_tong_giuong:   tongGiuong,
      ktx_dang_o:        dangO,
      ktx_phan_tram:     tongGiuong > 0 ? Math.round((dangO / tongGiuong) * 100) : 0,
    },
    cn_theo_cong_ty: cnTheoCongTy.rows,
    cn_theo_vender:  cnTheoVender.rows,
    cn_moi_nhat:     cnMoiNhat.rows,
    hoat_dong:       hoatDong.rows,
    phong_ktx:       phongKtx.rows,
  });
});

// Dashboard quan lý: dữ liệu theo công ty được chọn
const getQuanLyDashboard = asyncWrapper(async (req, res) => {
  const congTyId = req.query.cong_ty_id ? parseInt(req.query.cong_ty_id, 10) : null;
  const congTyIds = req.user.cong_ty_ids ?? [];

  // Kiểm tra quản lý có quyền xem công ty này không
  if (congTyId && !congTyIds.includes(congTyId)) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Bạn không quản lý công ty này' },
    });
  }

  // Lấy danh sách công ty của quản lý này để hiển thị dropdown
  const congTyList = congTyIds.length > 0
    ? (await db.query(
        `SELECT id, ten_cong_ty FROM cong_ty WHERE id = ANY($1) AND active = TRUE ORDER BY ten_cong_ty`,
        [congTyIds],
      )).rows
    : [];

  // Dùng congTyId được chọn, hoặc tất cả cty của quản lý nếu chưa chọn
  const filterIds = congTyId ? [congTyId] : congTyIds;

  const ctyFilterSql = filterIds.length
    ? `AND cn.cong_ty_id = ANY($1::int[])`
    : `AND FALSE`;
  const ctyParams = filterIds.length ? [filterIds] : [];

  const [kpiRow, cnMoiNhat] = await Promise.all([
    db.query(
      `SELECT
         COUNT(*) FILTER (WHERE cn.deleted_at IS NULL ${ctyFilterSql})                                        AS tong_cong_nhan,
         COUNT(*) FILTER (WHERE cn.deleted_at IS NULL AND cn.trang_thai = 'dang_lam' ${ctyFilterSql})         AS dang_lam,
         COUNT(*) FILTER (WHERE cn.deleted_at IS NULL AND cn.created_at::date = CURRENT_DATE ${ctyFilterSql}) AS cn_moi_hom_nay,
         COUNT(*) FILTER (WHERE cn.deleted_at IS NULL ${ctyFilterSql}
                            AND date_trunc('month', cn.created_at) = date_trunc('month', NOW()))             AS cn_moi_thang_nay
       FROM cong_nhan cn`,
      ctyParams,
    ),
    db.query(
      `SELECT cn.id, cn.ho_ten, cn.trang_thai, cn.created_at, cn.cong_ty_id,
              cn.nguoi_tuyen_id,
              ct.ten_cong_ty,
              u.ho_ten AS ten_nguoi_tuyen
       FROM cong_nhan cn
       LEFT JOIN cong_ty ct ON ct.id = cn.cong_ty_id
       LEFT JOIN users   u  ON u.id  = cn.nguoi_tuyen_id
       WHERE cn.deleted_at IS NULL ${filterIds.length ? `AND cn.cong_ty_id = ANY($1::int[])` : 'AND FALSE'}
       ORDER BY cn.created_at DESC
       LIMIT 10`,
      ctyParams,
    ),
  ]);

  const k = kpiRow.rows[0];
  sendSuccess(res, {
    cong_ty_hien_tai: congTyId,
    cong_ty_list:     congTyList,
    kpi: {
      tong_cong_nhan:   parseInt(k.tong_cong_nhan, 10),
      dang_lam:         parseInt(k.dang_lam, 10),
      cn_moi_hom_nay:   parseInt(k.cn_moi_hom_nay, 10),
      cn_moi_thang_nay: parseInt(k.cn_moi_thang_nay, 10),
    },
    cn_moi_nhat: cnMoiNhat.rows,
  });
});

// Dashboard vender: chỉ CN mình tuyển
const getVenderDashboard = asyncWrapper(async (req, res) => {
  const userId = req.user.id;

  const [kpiRow, cnMoiNhat] = await Promise.all([
    db.query(
      `SELECT
         COUNT(*) FILTER (WHERE deleted_at IS NULL)                                            AS tong_cong_nhan,
         COUNT(*) FILTER (WHERE deleted_at IS NULL AND trang_thai = 'dang_lam')                AS dang_lam,
         COUNT(*) FILTER (WHERE deleted_at IS NULL
                            AND date_trunc('month', created_at) = date_trunc('month', NOW())) AS moi_thang_nay,
         COUNT(*) FILTER (WHERE deleted_at IS NULL AND created_at::date = CURRENT_DATE)        AS cn_moi_hom_nay
       FROM cong_nhan
       WHERE nguoi_tuyen_id = $1`,
      [userId],
    ),
    db.query(
      `SELECT id, ho_ten, trang_thai, so_dien_thoai, ngay_vao_lam, created_at
       FROM cong_nhan
       WHERE nguoi_tuyen_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId],
    ),
  ]);

  const k = kpiRow.rows[0];
  sendSuccess(res, {
    kpi: {
      tong_cong_nhan: parseInt(k.tong_cong_nhan, 10),
      dang_lam:       parseInt(k.dang_lam, 10),
      moi_thang_nay:  parseInt(k.moi_thang_nay, 10),
      cn_moi_hom_nay: parseInt(k.cn_moi_hom_nay, 10),
    },
    cn_moi_nhat: cnMoiNhat.rows,
  });
});

module.exports = { getAdminDashboard, getQuanLyDashboard, getVenderDashboard };
