-- Migration 026: Thêm "bộ phận" vào hồ sơ công nhân.
--   - bo_phan: bộ phận/phòng ban của công nhân, thường lấy từ file import vân tay.
-- Cột nullable, không đụng dữ liệu cũ → an toàn.

BEGIN;

ALTER TABLE cong_nhan
  ADD COLUMN IF NOT EXISTS bo_phan VARCHAR(100);

COMMIT;
