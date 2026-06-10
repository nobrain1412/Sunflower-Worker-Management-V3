-- Migration 018: Backfill phan_cong cho công nhân đã có công ty nhưng thiếu phan_cong.
--
-- Bối cảnh: trước đây khi tạo công nhân và gán công ty, hệ thống chỉ ghi
-- cong_nhan.cong_ty_id mà KHÔNG tạo dòng phan_cong. Bảng chấm công (cham_cong)
-- bám theo phan_cong nên những công nhân này không xuất hiện trong bảng công.
--
-- Migration này tạo 1 phan_cong cho mỗi công nhân đang hoạt động, có công ty,
-- nhưng chưa có phan_cong khớp công ty đó.
--   - ngay_bat_dau = ngay_vao_lam (hoặc ngày tạo hồ sơ nếu trống)
--   - nghi_viec    → ngay_ket_thuc = ngay_nghi_viec (đóng phan_cong)
--   - doi_viec     → BỎ QUA (chưa đi làm, không cần bảng công)
-- Chỉ THÊM dữ liệu, không sửa/xoá gì sẵn có.

BEGIN;

INSERT INTO phan_cong (cong_nhan_id, cong_ty_id, ngay_bat_dau, ngay_ket_thuc, ghi_chu)
SELECT cn.id,
       cn.cong_ty_id,
       COALESCE(cn.ngay_vao_lam, cn.created_at::date),
       CASE WHEN cn.trang_thai = 'nghi_viec' THEN cn.ngay_nghi_viec ELSE NULL END,
       'Backfill tự động (migration 018)'
FROM cong_nhan cn
WHERE cn.deleted_at IS NULL
  AND cn.cong_ty_id IS NOT NULL
  AND cn.trang_thai <> 'doi_viec'
  AND NOT EXISTS (
    SELECT 1 FROM phan_cong pc
    WHERE pc.cong_nhan_id = cn.id
      AND pc.cong_ty_id = cn.cong_ty_id
  );

COMMIT;
