const db = require('../utils/db');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess } = require('../utils/response');

// Mốc "người vào mới" = ngày vào làm thực tế, không phải ngày nhập hồ sơ.
// Hồ sơ cũ chưa có ngay_vao_lam thì lùi về ngày tạo — cùng quy ước migration 018/022.
// Yêu cầu query đặt alias bảng cong_nhan là `cn`.
const NGAY_VAO = `COALESCE(cn.ngay_vao_lam, cn.created_at::date)`;

// Điều kiện "vào hôm nay" / "vào tháng này" — dùng chung cho MỌI query của dashboard.
// Mọi widget phải đếm cùng một tập CN, nếu không các con số trên màn hình sẽ lệch nhau.
const VAO_HOM_NAY   = `${NGAY_VAO} = CURRENT_DATE`;
const VAO_THANG_NAY = `date_trunc('month', ${NGAY_VAO}) = date_trunc('month', CURRENT_DATE)`;

// Trần số dòng cho danh sách "CN vào hôm nay" — ngày import hàng loạt có thể rất nhiều.
const GIOI_HAN_CN_HOM_NAY = 200;

// Dashboard admin: tổng quan toàn hệ thống
const getAdminDashboard = asyncWrapper(async (req, res) => {
  const [
    kpiRow,
    ktxRow,
    cnTheoCongTy,
    cnTheoVender,
    cnVaoHomNay,
    khongGanRow,
    hoatDong,
    phongKtx,
  ] = await Promise.all([
    // KPI tổng hợp công nhân
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE cn.deleted_at IS NULL)                                          AS tong_cong_nhan,
        COUNT(*) FILTER (WHERE cn.deleted_at IS NULL AND cn.trang_thai = 'dang_lam')           AS dang_lam,
        COUNT(*) FILTER (WHERE cn.deleted_at IS NULL AND ${VAO_HOM_NAY})                       AS cn_moi_hom_nay,
        COUNT(*) FILTER (WHERE cn.deleted_at IS NULL AND ${VAO_THANG_NAY})                     AS cn_moi_thang_nay,
        COUNT(*) FILTER (WHERE cn.deleted_at IS NULL
                          AND date_trunc('month', ${NGAY_VAO}) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')) AS cn_moi_thang_truoc
      FROM cong_nhan cn
    `),
    // Sức chứa & lấp đầy KTX
    db.query(`
      SELECT
        (SELECT COUNT(*) FROM giuong g
           JOIN phong p ON p.id = g.phong_id AND p.active = TRUE
           JOIN ky_tuc_xa k ON k.id = p.ktx_id AND k.active = TRUE)                AS tong_giuong,
        (SELECT COUNT(*) FROM thue_phong WHERE ngay_ra IS NULL)                    AS dang_o
    `),
    // CN theo từng công ty. Gồm cả công ty đã tắt mà vẫn còn công nhân — số CN của họ
    // vẫn nằm trong "Tổng công nhân", nếu lọc ct.active = TRUE thì donut và ô thống kê
    // sẽ hụt so với KPI.
    db.query(`
      SELECT ct.id, ct.ten_cong_ty, ct.active,
             COUNT(cn.id)                                            AS so_luong_cn,
             COUNT(cn.id) FILTER (WHERE ${VAO_HOM_NAY})              AS vao_hom_nay,
             COUNT(cn.id) FILTER (WHERE ${VAO_THANG_NAY})            AS vao_thang_nay
      FROM cong_ty ct
      LEFT JOIN cong_nhan cn ON cn.cong_ty_id = ct.id AND cn.deleted_at IS NULL
      WHERE ct.active = TRUE OR cn.id IS NOT NULL
      GROUP BY ct.id, ct.ten_cong_ty, ct.active
      ORDER BY ct.ten_cong_ty
    `),
    // CN theo từng người tuyển. Không lọc theo vai_tro/active của user: CN do cộng tác
    // viên hoặc do tài khoản đã khoá tuyển vẫn phải được đếm.
    db.query(`
      SELECT u.id, u.ho_ten, u.active,
             COUNT(cn.id)                                       AS so_luong_cn,
             COUNT(cn.id) FILTER (WHERE ${VAO_HOM_NAY})         AS moi_hom_nay
      FROM users u
      LEFT JOIN cong_nhan cn ON cn.nguoi_tuyen_id = u.id AND cn.deleted_at IS NULL
      WHERE (u.active = TRUE AND u.vai_tro IN ('vender','quan_ly','admin','cong_tac_vien'))
         OR cn.id IS NOT NULL
      GROUP BY u.id, u.ho_ten, u.active
      ORDER BY so_luong_cn DESC
      LIMIT 50
    `),
    // Danh sách CN vào hôm nay. Trước đây widget lọc client-side từ "10 CN mới nhất"
    // nên không bao giờ hiện quá 10 người.
    db.query(`
      SELECT cn.id, cn.ho_ten, cn.trang_thai, cn.ngay_vao_lam, cn.created_at, cn.cong_ty_id,
             cn.nguoi_tuyen_id,
             ct.ten_cong_ty,
             u.ho_ten AS ten_nguoi_tuyen
      FROM cong_nhan cn
      LEFT JOIN cong_ty ct ON ct.id = cn.cong_ty_id
      LEFT JOIN users   u  ON u.id  = cn.nguoi_tuyen_id
      WHERE cn.deleted_at IS NULL AND ${VAO_HOM_NAY}
      ORDER BY ct.ten_cong_ty NULLS LAST, cn.ho_ten
      LIMIT ${GIOI_HAN_CN_HOM_NAY}
    `),
    // CN chưa gán công ty / chưa rõ người tuyển — hai nhóm bị mọi widget bỏ sót
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE cn.cong_ty_id IS NULL)                          AS cpc_tong,
        COUNT(*) FILTER (WHERE cn.cong_ty_id IS NULL AND ${VAO_HOM_NAY})       AS cpc_hom_nay,
        COUNT(*) FILTER (WHERE cn.cong_ty_id IS NULL AND ${VAO_THANG_NAY})     AS cpc_thang_nay,
        COUNT(*) FILTER (WHERE cn.nguoi_tuyen_id IS NULL)                      AS knt_tong,
        COUNT(*) FILTER (WHERE cn.nguoi_tuyen_id IS NULL AND ${VAO_HOM_NAY})   AS knt_hom_nay
      FROM cong_nhan cn
      WHERE cn.deleted_at IS NULL
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
  const ng = khongGanRow.rows[0];
  const tongGiuong = parseInt(ktx.tong_giuong, 10) || 0;
  const dangO      = parseInt(ktx.dang_o, 10) || 0;
  const num = (v) => parseInt(v, 10) || 0;

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
    cn_vao_hom_nay:  cnVaoHomNay.rows,
    // Danh sách trên bị cắt ở GIOI_HAN_CN_HOM_NAY → FE cần biết tổng thật để chú thích
    cn_vao_hom_nay_gioi_han: GIOI_HAN_CN_HOM_NAY,
    chua_phan_cong: {
      so_luong_cn:   num(ng.cpc_tong),
      vao_hom_nay:   num(ng.cpc_hom_nay),
      vao_thang_nay: num(ng.cpc_thang_nay),
    },
    khong_nguoi_tuyen: {
      so_luong_cn: num(ng.knt_tong),
      moi_hom_nay: num(ng.knt_hom_nay),
    },
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
         COUNT(*) FILTER (WHERE cn.deleted_at IS NULL AND ${VAO_HOM_NAY} ${ctyFilterSql})                     AS cn_moi_hom_nay,
         COUNT(*) FILTER (WHERE cn.deleted_at IS NULL AND ${VAO_THANG_NAY} ${ctyFilterSql})                   AS cn_moi_thang_nay
       FROM cong_nhan cn`,
      ctyParams,
    ),
    db.query(
      `SELECT cn.id, cn.ho_ten, cn.trang_thai, cn.ngay_vao_lam, cn.created_at, cn.cong_ty_id,
              cn.nguoi_tuyen_id,
              ct.ten_cong_ty,
              u.ho_ten AS ten_nguoi_tuyen
       FROM cong_nhan cn
       LEFT JOIN cong_ty ct ON ct.id = cn.cong_ty_id
       LEFT JOIN users   u  ON u.id  = cn.nguoi_tuyen_id
       WHERE cn.deleted_at IS NULL ${filterIds.length ? `AND cn.cong_ty_id = ANY($1::int[])` : 'AND FALSE'}
       ORDER BY ${NGAY_VAO} DESC, cn.created_at DESC
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
         COUNT(*) FILTER (WHERE cn.deleted_at IS NULL)                                         AS tong_cong_nhan,
         COUNT(*) FILTER (WHERE cn.deleted_at IS NULL AND cn.trang_thai = 'dang_lam')          AS dang_lam,
         COUNT(*) FILTER (WHERE cn.deleted_at IS NULL AND ${VAO_THANG_NAY})                    AS moi_thang_nay,
         COUNT(*) FILTER (WHERE cn.deleted_at IS NULL AND ${VAO_HOM_NAY})                      AS cn_moi_hom_nay
       FROM cong_nhan cn
       WHERE cn.nguoi_tuyen_id = $1`,
      [userId],
    ),
    db.query(
      `SELECT cn.id, cn.ho_ten, cn.trang_thai, cn.so_dien_thoai, cn.ngay_vao_lam, cn.created_at
       FROM cong_nhan cn
       WHERE cn.nguoi_tuyen_id = $1 AND cn.deleted_at IS NULL
       ORDER BY ${NGAY_VAO} DESC, cn.created_at DESC
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
