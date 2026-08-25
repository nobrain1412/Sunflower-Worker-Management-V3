const db = require('../utils/db');

/**
 * Model đề xuất nghỉ việc (phát hiện từ bảng vân tay).
 * Đề xuất chỉ là bản ghi trung gian — khi được duyệt, tầng service mới gọi
 * congNhanService.capNhat để công nhân thực sự chuyển 'nghi_viec'.
 */

// Tạo/cập nhật đề xuất cho 1 công nhân. Idempotent: nếu công nhân đã có đề xuất
// 'cho_duyet' thì cập nhật lại số liệu (upload bảng vân tay mới không tạo trùng).
async function upsert({
  cong_nhan_id, cong_ty_id, ngay_cuoi_cung_di_lam, so_ngay_vang,
  ngay_chot_bang, ky_thang, ky_nam, ghi_chu, nguoi_tao_id,
}, exec = db) {
  const { rows } = await exec.query(
    `INSERT INTO de_xuat_nghi_viec
       (cong_nhan_id, cong_ty_id, ngay_cuoi_cung_di_lam, so_ngay_vang,
        ngay_chot_bang, ky_thang, ky_nam, ghi_chu, nguoi_tao_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (cong_nhan_id) WHERE (trang_thai = 'cho_duyet')
     DO UPDATE SET
        cong_ty_id            = EXCLUDED.cong_ty_id,
        ngay_cuoi_cung_di_lam = EXCLUDED.ngay_cuoi_cung_di_lam,
        so_ngay_vang          = EXCLUDED.so_ngay_vang,
        ngay_chot_bang        = EXCLUDED.ngay_chot_bang,
        ky_thang              = EXCLUDED.ky_thang,
        ky_nam                = EXCLUDED.ky_nam,
        ghi_chu               = EXCLUDED.ghi_chu,
        nguoi_tao_id          = EXCLUDED.nguoi_tao_id,
        updated_at            = NOW()
     RETURNING *`,
    [cong_nhan_id, cong_ty_id ?? null, ngay_cuoi_cung_di_lam ?? null, so_ngay_vang ?? null,
     ngay_chot_bang ?? null, ky_thang ?? null, ky_nam ?? null, ghi_chu ?? null, nguoi_tao_id ?? null],
  );
  return rows[0];
}

// Gỡ các đề xuất 'cho_duyet' của những công nhân đã đi làm lại (không còn là ứng viên).
// Trả về số dòng bị gỡ.
async function xoaChoDuyetTheoCongNhan(congNhanIds, exec = db) {
  if (!Array.isArray(congNhanIds) || congNhanIds.length === 0) return 0;
  const { rowCount } = await exec.query(
    `DELETE FROM de_xuat_nghi_viec
      WHERE trang_thai = 'cho_duyet' AND cong_nhan_id = ANY($1::int[])`,
    [congNhanIds],
  );
  return rowCount;
}

// Danh sách đề xuất, lọc theo trạng thái + scope quyền.
// scope: { type:'all' } | { type:'cong_ty', ids:[], userId } | { type:'vender', userId }
async function findAll({ trang_thai = 'cho_duyet', scope } = {}) {
  const params = [];
  const conds = [];
  if (trang_thai) { params.push(trang_thai); conds.push(`dx.trang_thai = $${params.length}`); }

  if (scope && scope.type === 'cong_ty') {
    // Quản lý: đề xuất thuộc công ty mình quản lý HOẶC công nhân do mình tuyển.
    params.push(scope.ids ?? []);
    const pIds = `$${params.length}`;
    params.push(scope.userId);
    const pUser = `$${params.length}`;
    conds.push(`(dx.cong_ty_id = ANY(${pIds}::int[]) OR cn.nguoi_tuyen_id = ${pUser})`);
  } else if (scope && scope.type === 'vender') {
    params.push(scope.userId);
    conds.push(`cn.nguoi_tuyen_id = $${params.length}`);
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const { rows } = await db.query(
    `SELECT dx.id, dx.cong_nhan_id, dx.cong_ty_id, dx.ngay_cuoi_cung_di_lam,
            dx.so_ngay_vang, dx.ngay_chot_bang, dx.ky_thang, dx.ky_nam,
            dx.trang_thai, dx.ghi_chu, dx.created_at,
            cn.ho_ten, cn.ma_van_tay, cn.so_dien_thoai, cn.trang_thai AS cn_trang_thai,
            cn.nguoi_tuyen_id,
            ct.ten_cong_ty,
            u.ho_ten AS nguoi_tuyen_ho_ten
       FROM de_xuat_nghi_viec dx
       JOIN cong_nhan cn ON cn.id = dx.cong_nhan_id AND cn.deleted_at IS NULL
       LEFT JOIN cong_ty ct ON ct.id = dx.cong_ty_id
       LEFT JOIN users u ON u.id = cn.nguoi_tuyen_id
       ${where}
       ORDER BY dx.created_at DESC
       LIMIT 300`,
    params,
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query(
    `SELECT dx.*, cn.ho_ten, cn.nguoi_tuyen_id, cn.cong_ty_id AS cn_cong_ty_id
       FROM de_xuat_nghi_viec dx
       JOIN cong_nhan cn ON cn.id = dx.cong_nhan_id
      WHERE dx.id = $1`,
    [id],
  );
  return rows[0] || null;
}

// Đánh dấu đã duyệt (trong transaction cùng với việc đổi trạng thái công nhân).
async function markApproved(id, nguoiDuyetId, exec = db) {
  const { rows } = await exec.query(
    `UPDATE de_xuat_nghi_viec
        SET trang_thai = 'da_duyet', nguoi_duyet_id = $2, duyet_luc = NOW()
      WHERE id = $1 AND trang_thai = 'cho_duyet'
      RETURNING *`,
    [id, nguoiDuyetId ?? null],
  );
  return rows[0] || null;
}

async function markRejected(id, nguoiDuyetId, ghiChu, exec = db) {
  const { rows } = await exec.query(
    `UPDATE de_xuat_nghi_viec
        SET trang_thai = 'tu_choi', nguoi_duyet_id = $2,
            ghi_chu = COALESCE($3, ghi_chu), duyet_luc = NOW()
      WHERE id = $1 AND trang_thai = 'cho_duyet'
      RETURNING *`,
    [id, nguoiDuyetId ?? null, ghiChu ?? null],
  );
  return rows[0] || null;
}

// Tập cong_nhan_id đang có đề xuất 'cho_duyet' (để đánh dấu ở kết quả phân tích).
async function pendingCongNhanIds(congNhanIds) {
  if (!Array.isArray(congNhanIds) || congNhanIds.length === 0) return new Set();
  const { rows } = await db.query(
    `SELECT cong_nhan_id FROM de_xuat_nghi_viec
      WHERE trang_thai = 'cho_duyet' AND cong_nhan_id = ANY($1::int[])`,
    [congNhanIds],
  );
  return new Set(rows.map((r) => r.cong_nhan_id));
}

async function countPending() {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM de_xuat_nghi_viec WHERE trang_thai = 'cho_duyet'`,
  );
  return rows[0]?.n ?? 0;
}

module.exports = {
  upsert, xoaChoDuyetTheoCongNhan, findAll, findById,
  markApproved, markRejected, pendingCongNhanIds, countPending,
};
