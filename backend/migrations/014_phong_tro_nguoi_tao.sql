-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  Migration 014: phong_tro riêng tư theo người tạo                ║
-- ║  Mỗi nhà trọ chỉ người tạo (và admin) được xem/sửa.              ║
-- ║  CHỈ áp dụng cho phong_tro — KHÔNG đụng tới ky_tuc_xa.           ║
-- ╚══════════════════════════════════════════════════════════════════╝
BEGIN;

ALTER TABLE phong_tro
  ADD COLUMN IF NOT EXISTS nguoi_tao_id INT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_phong_tro_nguoi_tao ON phong_tro(nguoi_tao_id);

COMMIT;
