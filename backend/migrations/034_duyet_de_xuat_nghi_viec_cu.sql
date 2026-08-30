-- Migration 034: Duyệt TẤT CẢ đề xuất nghỉ việc cũ (cho_duyet) → nghỉ việc thật.
--
-- Bối cảnh: luồng "Duyệt nghỉ việc" đã bỏ hàng đợi đề xuất, chuyển sang duyệt trực
-- tiếp. Các đề xuất 'cho_duyet' tạo ra trước đây trở thành mồ côi (không còn màn
-- hình xử lý). Theo yêu cầu: duyệt hết số này sang nghỉ việc thật, KHÔNG đối chiếu
-- lại bảng vân tay mới nhất.
--
-- Tác động (mô phỏng đúng congNhanService.capNhat khi chuyển 'nghi_viec'):
--   1) cong_nhan.trang_thai = 'nghi_viec', ngay_nghi_viec = ngày công cuối
--      (fallback ngày chốt bảng) — chỉ với CN còn hiệu lực & chưa nghỉ việc.
--   2) Chốt các chặng phan_cong đang mở (ngay_ket_thuc = ngày nghỉ).
--   3) Đánh dấu đề xuất 'cho_duyet' → 'da_duyet' để dọn hàng đợi.
--
-- Idempotent: chạy lại không tạo thay đổi mới (không còn 'cho_duyet' nào).

BEGIN;

-- 1) Chuyển công nhân sang nghỉ việc.
UPDATE cong_nhan cn
   SET trang_thai     = 'nghi_viec',
       ngay_nghi_viec = COALESCE(dx.ngay_cuoi_cung_di_lam, dx.ngay_chot_bang, cn.ngay_nghi_viec)
  FROM de_xuat_nghi_viec dx
 WHERE dx.cong_nhan_id = cn.id
   AND dx.trang_thai   = 'cho_duyet'
   AND cn.deleted_at IS NULL
   AND cn.trang_thai <> 'nghi_viec';

-- 2) Chốt phan_cong đang mở của những CN vừa nghỉ việc (để bảng công/lịch sử đúng).
UPDATE phan_cong pc
   SET ngay_ket_thuc = COALESCE(dx.ngay_cuoi_cung_di_lam, dx.ngay_chot_bang, CURRENT_DATE)
  FROM de_xuat_nghi_viec dx
  JOIN cong_nhan cn ON cn.id = dx.cong_nhan_id
 WHERE dx.cong_nhan_id = pc.cong_nhan_id
   AND dx.trang_thai   = 'cho_duyet'
   AND cn.deleted_at IS NULL
   AND pc.ngay_ket_thuc IS NULL;

-- 3) Đánh dấu tất cả đề xuất cho_duyet là đã duyệt (dọn hàng đợi).
UPDATE de_xuat_nghi_viec
   SET trang_thai = 'da_duyet',
       duyet_luc  = NOW(),
       ghi_chu    = COALESCE(ghi_chu, '') ||
                    CASE WHEN ghi_chu IS NULL OR ghi_chu = '' THEN '' ELSE ' · ' END ||
                    'Duyệt hàng loạt (migration 034)'
 WHERE trang_thai = 'cho_duyet';

COMMIT;
