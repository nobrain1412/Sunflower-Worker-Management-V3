-- Migration 023: Cho phép thêm công nhân TRÙNG CCCD (qua bước duyệt)
--
-- Bối cảnh: khi import Excel, dòng trùng CCCD trước đây bị skip cứng. Nay người
-- dùng có thêm lựa chọn "thêm mới riêng biệt" dù trùng CCCD → cần:
--   1. Bỏ ràng buộc UNIQUE trên cccd (chỉ còn index thường để tra cứu nhanh).
--   2. Thêm trạng thái 'cho_duyet' — công nhân trùng CCCD thêm mới sẽ ở trạng thái
--      này, admin vào hồ sơ đổi sang 'moi_vao'/'dang_lam' để duyệt.
--
-- KHÔNG xoá/sửa dữ liệu hiện có — chỉ nới ràng buộc. An toàn để chạy trước demo.

BEGIN;

-- 1) Bỏ unique index trên cccd (giữ lại index thường idx_cong_nhan_cccd để tra cứu)
DROP INDEX IF EXISTS idx_cong_nhan_cccd_active;

-- 2) Nới CHECK trạng thái để có 'cho_duyet'
ALTER TABLE cong_nhan DROP CONSTRAINT IF EXISTS cong_nhan_trang_thai_check;
ALTER TABLE cong_nhan ADD CONSTRAINT cong_nhan_trang_thai_check
  CHECK (trang_thai IN ('dang_lam', 'nghi_phep', 'moi_vao', 'nghi_viec', 'doi_viec', 'cho_duyet'));

COMMIT;
