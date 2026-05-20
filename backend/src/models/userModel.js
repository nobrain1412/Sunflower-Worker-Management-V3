const db = require('../utils/db');

const ROLE_VALUES = ['admin', 'quan_ly', 'vender', 'cong_tac_vien', 'ke_toan'];

async function findByUsername(ten_dang_nhap) {
  const result = await db.query(
    `SELECT * FROM users WHERE ten_dang_nhap = $1 AND active = TRUE`,
    [ten_dang_nhap],
  );
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await db.query(
    `SELECT id, ten_dang_nhap, ho_ten, vai_tro, active, created_at,
            so_dien_thoai, ngan_hang, so_tai_khoan, ten_chu_tk,
            hinh_thuc_thanh_toan, quan_ly_id
     FROM users WHERE id = $1`,
    [id],
  );
  return result.rows[0] || null;
}

// Lấy danh sách cong_ty_id mà quản lý này được phân công
async function findCongTyIds(userId) {
  const result = await db.query(
    `SELECT cong_ty_id FROM quan_ly_cong_ty WHERE user_id = $1`,
    [userId],
  );
  return result.rows.map((r) => r.cong_ty_id);
}

// Danh sách user (admin xem) — kèm số CN tuyển + công ty quản lý
async function findAll({ vai_tro } = {}) {
  const conditions = [];
  const params = [];
  if (vai_tro) { params.push(vai_tro); conditions.push(`u.vai_tro = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query(
    `SELECT u.id, u.ten_dang_nhap, u.ho_ten, u.vai_tro, u.active,
            u.so_dien_thoai, u.ngan_hang, u.so_tai_khoan, u.ten_chu_tk,
            u.hinh_thuc_thanh_toan, u.quan_ly_id, u.created_at,
            -- Tổng CN người này tuyển (đang còn)
            (SELECT COUNT(*) FROM cong_nhan cn
              WHERE cn.nguoi_tuyen_id = u.id
                AND cn.deleted_at IS NULL) AS so_cn_tuyen,
            -- Tổng CN đang làm tại các công ty người này quản lý
            (SELECT COUNT(*) FROM cong_nhan cn
              WHERE cn.cong_ty_id IN (
                SELECT cong_ty_id FROM quan_ly_cong_ty WHERE user_id = u.id
              ) AND cn.deleted_at IS NULL) AS so_cn_quan_ly,
            -- Danh sách công ty đang quản lý (text)
            COALESCE((SELECT STRING_AGG(ct.ten_cong_ty, ', ')
              FROM quan_ly_cong_ty qct
              JOIN cong_ty ct ON ct.id = qct.cong_ty_id
              WHERE qct.user_id = u.id), '') AS cong_ty_quan_ly_ten,
            COALESCE((SELECT ARRAY_AGG(qct.cong_ty_id)
              FROM quan_ly_cong_ty qct
              WHERE qct.user_id = u.id), ARRAY[]::int[]) AS cong_ty_ids
     FROM users u
     ${where}
     ORDER BY u.id DESC`,
    params,
  );
  return result.rows;
}

async function create({
  ten_dang_nhap, mat_khau_hash, ho_ten, vai_tro,
  so_dien_thoai, ngan_hang, so_tai_khoan, ten_chu_tk,
  hinh_thuc_thanh_toan, quan_ly_id,
}) {
  const result = await db.query(
    `INSERT INTO users
       (ten_dang_nhap, mat_khau_hash, ho_ten, vai_tro,
        so_dien_thoai, ngan_hang, so_tai_khoan, ten_chu_tk,
        hinh_thuc_thanh_toan, quan_ly_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, ten_dang_nhap, ho_ten, vai_tro, active, so_dien_thoai,
               ngan_hang, so_tai_khoan, ten_chu_tk,
               hinh_thuc_thanh_toan, quan_ly_id`,
    [ten_dang_nhap, mat_khau_hash, ho_ten, vai_tro,
     so_dien_thoai ?? null, ngan_hang ?? null, so_tai_khoan ?? null,
     ten_chu_tk ?? null,
     hinh_thuc_thanh_toan ?? 'mot_lan', quan_ly_id ?? null],
  );
  return result.rows[0];
}

async function update(id, data) {
  const allowed = ['ho_ten', 'vai_tro', 'active',
    'so_dien_thoai', 'ngan_hang', 'so_tai_khoan', 'ten_chu_tk',
    'hinh_thuc_thanh_toan', 'quan_ly_id'];
  const fields = [], params = [];
  for (const f of allowed) {
    if (f in data) { params.push(data[f]); fields.push(`${f} = $${params.length}`); }
  }
  if (!fields.length) return findById(id);
  params.push(id);
  const result = await db.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING id`,
    params,
  );
  if (!result.rows[0]) return null;
  return findById(id);
}

// Set danh sách cong_ty người này quản lý (xoá cũ → thêm mới)
async function setCongTyIds(userId, congTyIds = []) {
  await db.query(`DELETE FROM quan_ly_cong_ty WHERE user_id = $1`, [userId]);
  for (const ctId of congTyIds) {
    await db.query(
      `INSERT INTO quan_ly_cong_ty (user_id, cong_ty_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [userId, ctId],
    );
  }
}

async function hardDelete(id) {
  const result = await db.query(
    `DELETE FROM users WHERE id = $1 RETURNING id`,
    [id],
  );
  return result.rows[0] || null;
}

async function findCongTacVien({ quanLyId } = {}) {
  const params = [];
  const conditions = [`u.vai_tro = 'cong_tac_vien'`];
  if (quanLyId) {
    params.push(quanLyId);
    conditions.push(`u.quan_ly_id = $${params.length}`);
  }

  const where = conditions.join(' AND ');
  // Tổng tiền dự kiến tính theo rate riêng từng công ty của từng CN.
  const result = await db.query(
    `SELECT u.id, u.ten_dang_nhap, u.ho_ten, u.vai_tro, u.active,
            u.so_dien_thoai, u.ngan_hang, u.so_tai_khoan, u.ten_chu_tk,
            u.hinh_thuc_thanh_toan, u.quan_ly_id, u.created_at,
            (SELECT COUNT(*)
               FROM cong_nhan cn
              WHERE cn.nguoi_tuyen_id = u.id
                AND cn.deleted_at IS NULL) AS so_cn_tuyen,
            -- Số CN đủ điều kiện 1 lần (>=26 ngày công) & chưa thanh toán mot_lan
            (
              SELECT COUNT(*) FROM (
                SELECT cn.id AS cong_nhan_id,
                       COALESCE(SUM((cc.so_gio + cc.so_gio_ot) / 8.0), 0) AS tong_ngay_cong
                  FROM cong_nhan cn
                  LEFT JOIN phan_cong pc ON pc.cong_nhan_id = cn.id
                  LEFT JOIN cham_cong cc ON cc.phan_cong_id = pc.id
                 WHERE cn.nguoi_tuyen_id = u.id
                   AND cn.deleted_at IS NULL
                 GROUP BY cn.id
              ) s
              WHERE s.tong_ngay_cong >= 26
                AND NOT EXISTS (
                  SELECT 1 FROM cong_tac_vien_thanh_toan tt
                   WHERE tt.cong_nhan_id = s.cong_nhan_id
                     AND tt.hinh_thuc = 'mot_lan'
                )
            ) AS so_cn_du_dieu_kien_mot_lan,
            -- Tổng tiền mot_lan dự kiến: sum rate(u, cn.cong_ty) cho CN đủ điều kiện chưa thanh toán
            (
              SELECT COALESCE(SUM(r.tien_cong_moi_nguoi), 0)
                FROM (
                  SELECT cn.id AS cong_nhan_id, cn.cong_ty_id,
                         COALESCE(SUM((cc.so_gio + cc.so_gio_ot) / 8.0), 0) AS tong_ngay_cong
                    FROM cong_nhan cn
                    LEFT JOIN phan_cong pc ON pc.cong_nhan_id = cn.id
                    LEFT JOIN cham_cong  cc ON cc.phan_cong_id = pc.id
                   WHERE cn.nguoi_tuyen_id = u.id
                     AND cn.deleted_at IS NULL
                   GROUP BY cn.id, cn.cong_ty_id
                ) s
                LEFT JOIN user_cong_ty_rate r
                       ON r.user_id = u.id AND r.cong_ty_id = s.cong_ty_id
               WHERE s.tong_ngay_cong >= 26
                 AND NOT EXISTS (
                   SELECT 1 FROM cong_tac_vien_thanh_toan tt
                    WHERE tt.cong_nhan_id = s.cong_nhan_id
                      AND tt.hinh_thuc = 'mot_lan'
                 )
            ) AS du_kien_mot_lan,
            -- Tổng tiền hang_thang dự kiến (tháng hiện tại): sum(gio * rate/26/8) theo cong_ty của CN
            (
              SELECT COALESCE(SUM(
                       (s.tong_gio) * (COALESCE(r.tien_cong_moi_nguoi, 0) / 26.0 / 8.0)
                     ), 0)
                FROM (
                  SELECT cn.id AS cong_nhan_id, cn.cong_ty_id,
                         COALESCE(SUM(cc.so_gio + cc.so_gio_ot), 0) AS tong_gio
                    FROM cong_nhan cn
                    JOIN phan_cong pc ON pc.cong_nhan_id = cn.id
                    JOIN cham_cong  cc ON cc.phan_cong_id = pc.id
                   WHERE cn.nguoi_tuyen_id = u.id
                     AND cn.deleted_at IS NULL
                     AND DATE_TRUNC('month', cc.ngay::timestamp) = DATE_TRUNC('month', NOW())
                   GROUP BY cn.id, cn.cong_ty_id
                ) s
                LEFT JOIN user_cong_ty_rate r
                       ON r.user_id = u.id AND r.cong_ty_id = s.cong_ty_id
            ) AS du_kien_hang_thang,
            (
              SELECT COALESCE(SUM(cc.so_gio + cc.so_gio_ot), 0)
                FROM cham_cong cc
                JOIN phan_cong pc ON pc.id = cc.phan_cong_id
                JOIN cong_nhan cn ON cn.id = pc.cong_nhan_id
               WHERE cn.nguoi_tuyen_id = u.id
                 AND DATE_TRUNC('month', cc.ngay::timestamp) = DATE_TRUNC('month', NOW())
            ) AS tong_gio_thang,
            (SELECT COUNT(DISTINCT cong_nhan_id)
               FROM cong_tac_vien_thanh_toan
              WHERE ctv_id = u.id) AS so_cn_da_thanh_toan,
            (SELECT COALESCE(SUM(so_tien), 0)
               FROM cong_tac_vien_thanh_toan
              WHERE ctv_id = u.id) AS tong_da_thanh_toan
     FROM users u
     WHERE ${where}
     ORDER BY u.id DESC`,
    params,
  );

  return result.rows.map((u) => {
    const duKienMotLan    = Number(u.du_kien_mot_lan || 0);
    const duKienHangThang = Number(u.du_kien_hang_thang || 0);
    const duKienThanhToan = u.hinh_thuc_thanh_toan === 'hang_thang'
      ? duKienHangThang
      : duKienMotLan;
    return {
      ...u,
      so_cn_du_dieu_kien_mot_lan: Number(u.so_cn_du_dieu_kien_mot_lan || 0),
      so_cn_da_thanh_toan: Number(u.so_cn_da_thanh_toan || 0),
      tong_da_thanh_toan:  Number(u.tong_da_thanh_toan || 0),
      du_kien_mot_lan:     duKienMotLan,
      du_kien_hang_thang:  duKienHangThang,
      du_kien_thanh_toan:  duKienThanhToan,
    };
  });
}

async function thanhToanCongTacVien({ ctvId, hinhThuc, thang, nam, createdBy, ghiChu }) {
  const now = new Date();
  const targetThang = thang || (now.getMonth() + 1);
  const targetNam = nam || now.getFullYear();

  await db.query('BEGIN');
  try {
    const ctvRes = await db.query(
      `SELECT id, vai_tro FROM users WHERE id = $1`,
      [ctvId],
    );
    const ctv = ctvRes.rows[0];
    if (!ctv || ctv.vai_tro !== 'cong_tac_vien') {
      const e = new Error('Không tìm thấy cộng tác viên');
      e.statusCode = 404;
      throw e;
    }

    if (hinhThuc === 'mot_lan') {
      // Mỗi CN đủ điều kiện được tính theo rate(ctv, cong_ty của CN).
      const inserted = await db.query(
        `WITH eligible AS (
           SELECT cn.id AS cong_nhan_id, cn.cong_ty_id
             FROM cong_nhan cn
             LEFT JOIN phan_cong pc ON pc.cong_nhan_id = cn.id
             LEFT JOIN cham_cong cc ON cc.phan_cong_id = pc.id
            WHERE cn.nguoi_tuyen_id = $1
              AND cn.deleted_at IS NULL
            GROUP BY cn.id
           HAVING COALESCE(SUM((cc.so_gio + cc.so_gio_ot) / 8.0), 0) >= 26
        ),
        inserted AS (
          INSERT INTO cong_tac_vien_thanh_toan
            (ctv_id, cong_nhan_id, hinh_thuc, so_tien, ghi_chu, created_by)
          SELECT $1, e.cong_nhan_id, 'mot_lan',
                 COALESCE(r.tien_cong_moi_nguoi, 0),
                 $2, $3
            FROM eligible e
            LEFT JOIN user_cong_ty_rate r
                   ON r.user_id = $1 AND r.cong_ty_id = e.cong_ty_id
           WHERE NOT EXISTS (
             SELECT 1 FROM cong_tac_vien_thanh_toan t
              WHERE t.cong_nhan_id = e.cong_nhan_id
                AND t.hinh_thuc = 'mot_lan'
           )
          RETURNING so_tien
        )
        SELECT COUNT(*)::int AS so_luong, COALESCE(SUM(so_tien), 0) AS tong_tien
          FROM inserted`,
        [ctvId, ghiChu ?? null, createdBy ?? null],
      );

      await db.query('COMMIT');
      return {
        hinh_thuc: 'mot_lan',
        so_luong:  Number(inserted.rows[0].so_luong || 0),
        tong_tien: Number(inserted.rows[0].tong_tien || 0),
      };
    }

    // hang_thang: tien = gio * (rate(ctv, cong_ty CN) / 26 / 8)
    const inserted = await db.query(
      `WITH hours_by_worker AS (
         SELECT cn.id AS cong_nhan_id, cn.cong_ty_id,
                COALESCE(SUM(cc.so_gio + cc.so_gio_ot), 0) AS tong_gio
           FROM cong_nhan cn
           JOIN phan_cong pc ON pc.cong_nhan_id = cn.id
           JOIN cham_cong cc ON cc.phan_cong_id = pc.id
          WHERE cn.nguoi_tuyen_id = $1
            AND cn.deleted_at IS NULL
            AND EXTRACT(MONTH FROM cc.ngay) = $2
            AND EXTRACT(YEAR  FROM cc.ngay) = $3
          GROUP BY cn.id, cn.cong_ty_id
        ),
        inserted AS (
          INSERT INTO cong_tac_vien_thanh_toan
            (ctv_id, cong_nhan_id, hinh_thuc, thang, nam, so_tien, ghi_chu, created_by)
          SELECT $1, h.cong_nhan_id, 'hang_thang', $2, $3,
                 ROUND(h.tong_gio * (COALESCE(r.tien_cong_moi_nguoi, 0) / 26.0 / 8.0)),
                 $4, $5
            FROM hours_by_worker h
            LEFT JOIN user_cong_ty_rate r
                   ON r.user_id = $1 AND r.cong_ty_id = h.cong_ty_id
           WHERE h.tong_gio > 0
             AND NOT EXISTS (
               SELECT 1 FROM cong_tac_vien_thanh_toan t
                WHERE t.cong_nhan_id = h.cong_nhan_id
                  AND t.hinh_thuc = 'hang_thang'
                  AND t.thang = $2
                  AND t.nam = $3
             )
          RETURNING so_tien
        )
        SELECT COUNT(*)::int AS so_luong, COALESCE(SUM(so_tien), 0) AS tong_tien
          FROM inserted`,
      [ctvId, targetThang, targetNam, ghiChu ?? null, createdBy ?? null],
    );

    await db.query('COMMIT');
    return {
      hinh_thuc: 'hang_thang',
      thang: targetThang,
      nam: targetNam,
      so_luong:  Number(inserted.rows[0].so_luong || 0),
      tong_tien: Number(inserted.rows[0].tong_tien || 0),
    };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

// Danh sách CN do 1 CTV tuyển kèm số liệu thanh toán/giờ làm
async function findCongNhanCuaCtv(ctvId) {
  const ctvRes = await db.query(
    `SELECT id, vai_tro, ho_ten, hinh_thuc_thanh_toan
       FROM users WHERE id = $1`,
    [ctvId],
  );
  const ctv = ctvRes.rows[0];
  if (!ctv || ctv.vai_tro !== 'cong_tac_vien') return null;

  const cnRes = await db.query(
    `SELECT cn.id, cn.ho_ten, cn.cccd, cn.so_dien_thoai, cn.trang_thai,
            cn.ngay_vao_lam, cn.ngay_nghi_viec, cn.cong_ty_id,
            ct.ten_cong_ty,
            COALESCE(r.tien_cong_moi_nguoi, 0) AS tien_cong_moi_nguoi,
            COALESCE((
              SELECT SUM(cc.so_gio + cc.so_gio_ot)
                FROM cham_cong cc
                JOIN phan_cong pc ON pc.id = cc.phan_cong_id
               WHERE pc.cong_nhan_id = cn.id
            ), 0) AS tong_gio,
            COALESCE((
              SELECT SUM(cc.so_gio + cc.so_gio_ot)
                FROM cham_cong cc
                JOIN phan_cong pc ON pc.id = cc.phan_cong_id
               WHERE pc.cong_nhan_id = cn.id
                 AND DATE_TRUNC('month', cc.ngay::timestamp) = DATE_TRUNC('month', NOW())
            ), 0) AS gio_thang_nay,
            EXISTS (
              SELECT 1 FROM cong_tac_vien_thanh_toan t
               WHERE t.cong_nhan_id = cn.id
                 AND t.ctv_id = $1
                 AND t.hinh_thuc = 'mot_lan'
            ) AS da_thanh_toan_mot_lan,
            (
              SELECT COALESCE(json_agg(json_build_object(
                'thang', t.thang, 'nam', t.nam, 'so_tien', t.so_tien, 'created_at', t.created_at
              ) ORDER BY t.nam DESC, t.thang DESC), '[]'::json)
                FROM cong_tac_vien_thanh_toan t
               WHERE t.cong_nhan_id = cn.id
                 AND t.ctv_id = $1
                 AND t.hinh_thuc = 'hang_thang'
            ) AS thanh_toan_hang_thang
     FROM cong_nhan cn
     LEFT JOIN cong_ty ct ON ct.id = cn.cong_ty_id
     LEFT JOIN user_cong_ty_rate r
            ON r.user_id = $1 AND r.cong_ty_id = cn.cong_ty_id
     WHERE cn.nguoi_tuyen_id = $1
       AND cn.deleted_at IS NULL
     ORDER BY cn.ho_ten ASC`,
    [ctvId],
  );

  const danhSach = cnRes.rows.map((cn) => {
    const tongGio = Number(cn.tong_gio || 0);
    const gioThang = Number(cn.gio_thang_nay || 0);
    const ngayCong = tongGio / 8;
    const tienCong = Number(cn.tien_cong_moi_nguoi || 0);
    const donGiaTheoGio = tienCong > 0 ? tienCong / 26 / 8 : 0;
    const duDieuKienMotLan = ngayCong >= 26;
    const canThanhToanMotLan = duDieuKienMotLan && !cn.da_thanh_toan_mot_lan;
    const canThanhToanThangNay = ctv.hinh_thuc_thanh_toan === 'hang_thang' && gioThang > 0;
    return {
      ...cn,
      tong_gio: tongGio,
      gio_thang_nay: gioThang,
      ngay_cong: ngayCong,
      tien_cong_moi_nguoi: tienCong,
      don_gia_theo_gio: donGiaTheoGio,
      du_dieu_kien_mot_lan: duDieuKienMotLan,
      da_thanh_toan_mot_lan: !!cn.da_thanh_toan_mot_lan,
      can_thanh_toan_mot_lan: canThanhToanMotLan,
      can_thanh_toan_thang_nay: canThanhToanThangNay,
      so_tien_mot_lan:   canThanhToanMotLan ? tienCong : 0,
      so_tien_thang_nay: canThanhToanThangNay ? Math.round(donGiaTheoGio * gioThang) : 0,
    };
  });

  return {
    ctv: {
      id: ctv.id, ho_ten: ctv.ho_ten,
      hinh_thuc_thanh_toan: ctv.hinh_thuc_thanh_toan,
    },
    cong_nhan: danhSach,
    tong: {
      so_cn: danhSach.length,
      so_du_dieu_kien_mot_lan: danhSach.filter((x) => x.du_dieu_kien_mot_lan).length,
      so_can_thanh_toan_mot_lan: danhSach.filter((x) => x.can_thanh_toan_mot_lan).length,
      so_can_thanh_toan_thang_nay: danhSach.filter((x) => x.can_thanh_toan_thang_nay).length,
      tong_tien_mot_lan:   danhSach.reduce((s, x) => s + x.so_tien_mot_lan, 0),
      tong_tien_thang_nay: danhSach.reduce((s, x) => s + x.so_tien_thang_nay, 0),
    },
  };
}

module.exports = {
  ROLE_VALUES,
  findByUsername, findById, findCongTyIds, findAll,
  create, update, setCongTyIds, hardDelete, findCongTacVien, thanhToanCongTacVien,
  findCongNhanCuaCtv,
};
