-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  Migration 016: quyền sử dụng chức năng Ký túc xá                 ║
-- ║  Admin phân công user nào (ngoài admin) được dùng module KTX.      ║
-- ║  Additive — không ảnh hưởng dữ liệu hiện có.                       ║
-- ╚══════════════════════════════════════════════════════════════════╝
BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS quyen_ktx BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
