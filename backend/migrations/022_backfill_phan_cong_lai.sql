-- Migration 022: Backfill lại phan_cong cho công nhân được gán công ty SAU migration 018.
--
-- Bối cảnh: một số công nhân (vd batch KANGYIN) được import chưa có công ty, sau đó
-- gán công ty bằng cách sửa thẳng cong_nhan.cong_ty_id qua DB console — KHÔNG tạo dòng
-- phan_cong. Vì bảng chấm công + số người hiện tại của công ty đều bám theo phan_cong,
-- những công nhân này không xuất hiện trong bảng công và không được đếm.
--
-- Migration này tạo 1 phan_cong cho mỗi công nhân đang hoạt động, có công ty, nhưng
-- chưa có phan_cong khớp công ty đó. Idempotent (NOT EXISTS) — chạy lại nhiều lần an toàn,
-- chỉ THÊM dữ liệu, không sửa/xoá gì sẵn có.
--   - ngay_bat_dau = ngay_vao_lam (hoặc ngày tạo hồ sơ nếu trống)
--   - nghi_viec    → ngay_ket_thuc = ngay_nghi_viec (đóng phan_cong)
--   - doi_viec     → BỎ QUA (chưa đi làm, không cần bảng công)

BEGIN;

INSERT INTO phan_cong (cong_nhan_id, cong_ty_id, ngay_bat_dau, ngay_ket_thuc, ghi_chu)
SELECT cn.id,
       cn.cong_ty_id,
       COALESCE(cn.ngay_vao_lam, cn.created_at::date),
       CASE WHEN cn.trang_thai = 'nghi_viec' THEN cn.ngay_nghi_viec ELSE NULL END,
       'Backfill tự động (migration 022)'
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
