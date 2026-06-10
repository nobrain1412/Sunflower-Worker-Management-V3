-- Migration 017: Thêm trạng thái 'doi_viec' (đợi việc / chờ phỏng vấn) cho công nhan
-- Luồng: vender tuyển → CN ở 'doi_viec' + gán công ty để phỏng vấn
--   → quản lý công ty đó duyệt → chuyển sang 'moi_vao'
--   → nếu trượt, người tuyển tự xoá.
-- Chỉ NỚI RỘNG ràng buộc CHECK, không đụng dữ liệu hiện có.

BEGIN;

ALTER TABLE cong_nhan DROP CONSTRAINT IF EXISTS cong_nhan_trang_thai_check;
ALTER TABLE cong_nhan ADD CONSTRAINT cong_nhan_trang_thai_check
  CHECK (trang_thai IN ('dang_lam', 'nghi_phep', 'moi_vao', 'nghi_viec', 'doi_viec'));

COMMIT;
