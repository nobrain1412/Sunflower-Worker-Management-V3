-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  Migration 015: mã vender cho user                               ║
-- ║  Cho phép import Excel nhận diện vender theo MÃ thay vì họ tên.   ║
-- ╚══════════════════════════════════════════════════════════════════╝
BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ma_vender VARCHAR(50);

-- Mã vender là duy nhất (bỏ qua NULL) để tránh trùng khi import
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_ma_vender
  ON users (LOWER(ma_vender)) WHERE ma_vender IS NOT NULL;

COMMIT;
