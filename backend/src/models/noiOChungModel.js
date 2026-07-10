/**
 * Kiểm tra chung cho hai bảng lưu trú: thue_phong (KTX) và thue_phong_tro.
 *
 * Một công nhân không thể ở hai nơi cùng lúc, nên khi sửa ngày vào phải soi cả
 * hai bảng. Khoảng ở là [ngay_vao, ngay_ra]; ngay_ra NULL nghĩa là còn đang ở
 * → khoảng không có điểm cuối. daterange(..., '[]') bao gồm cả hai đầu mút,
 * đúng với cách tính tiền phòng (ở 1 ngày vẫn tính 1 ngày).
 */
const db = require('../utils/db');

// daterange(a, b) ném lỗi khi a > b. Dữ liệu cũ có thể chứa bản ghi ngày ra < ngày
// vào (trả phòng ngay sau khi xếp với ngày vào ở tương lai — traPhong không chặn),
// một dòng hỏng như vậy đủ làm cả query 500. Bỏ qua chúng thay vì gãy.
const KHOANG_HOP_LE = (alias) => `(${alias}.ngay_ra IS NULL OR ${alias}.ngay_ra >= ${alias}.ngay_vao)`;

// Date | string → 'yyyy-mm-dd' để so sánh chuỗi cho an toàn về múi giờ
function toIso(v) {
  if (!v) return null;
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

/**
 * Tìm bản ghi lưu trú khác của cùng công nhân bị giao khoảng thời gian.
 * @param boQuaKtxId / boQuaTroId  id bản ghi đang sửa, không tự so với chính nó
 * @returns { nguon: 'ktx'|'phong_tro', mo_ta, ngay_vao, ngay_ra } | null
 */
async function timChongLanNoiO({ congNhanId, ngayVao, ngayRa = null, boQuaKtxId = null, boQuaTroId = null }) {
  const { rows } = await db.query(
    `SELECT 'ktx' AS nguon, tp.id, tp.ngay_vao, tp.ngay_ra,
            k.ten || ' / phòng ' || p.ten_phong AS mo_ta
       FROM thue_phong tp
       JOIN giuong g    ON g.id = tp.giuong_id
       JOIN phong p     ON p.id = g.phong_id
       JOIN ky_tuc_xa k ON k.id = p.ktx_id
      WHERE tp.cong_nhan_id = $1
        AND ($2::int IS NULL OR tp.id <> $2)
        AND ${KHOANG_HOP_LE('tp')}
        AND daterange(tp.ngay_vao, tp.ngay_ra, '[]') && daterange($4::date, $5::date, '[]')
     UNION ALL
     SELECT 'phong_tro', tpt.id, tpt.ngay_vao, tpt.ngay_ra, pt.ten
       FROM thue_phong_tro tpt
       JOIN phong_tro pt ON pt.id = tpt.phong_tro_id
      WHERE tpt.cong_nhan_id = $1
        AND ($3::int IS NULL OR tpt.id <> $3)
        AND ${KHOANG_HOP_LE('tpt')}
        AND daterange(tpt.ngay_vao, tpt.ngay_ra, '[]') && daterange($4::date, $5::date, '[]')
     LIMIT 1`,
    [congNhanId, boQuaKtxId, boQuaTroId, ngayVao, ngayRa],
  );
  return rows[0] || null;
}

// Giường chỉ chứa 1 người → không cho hai lượt ở chồng ngày trên cùng giường
async function timChongLanGiuong({ giuongId, ngayVao, ngayRa = null, boQuaThuePhongId = null }) {
  const { rows } = await db.query(
    `SELECT tp.id, tp.ngay_vao, tp.ngay_ra, cn.ho_ten AS cong_nhan_ten
       FROM thue_phong tp
       JOIN cong_nhan cn ON cn.id = tp.cong_nhan_id
      WHERE tp.giuong_id = $1
        AND ($2::int IS NULL OR tp.id <> $2)
        AND ${KHOANG_HOP_LE('tp')}
        AND daterange(tp.ngay_vao, tp.ngay_ra, '[]') && daterange($3::date, $4::date, '[]')
      LIMIT 1`,
    [giuongId, boQuaThuePhongId, ngayVao, ngayRa],
  );
  return rows[0] || null;
}

// Lỗi 400 kèm mô tả khoảng bị đè, để người dùng biết vướng bản ghi nào
function loiChongLan(message) {
  const e = new Error(message);
  e.statusCode = 400;
  e.code = 'OVERLAP';
  return e;
}

module.exports = { toIso, timChongLanNoiO, timChongLanGiuong, loiChongLan };
