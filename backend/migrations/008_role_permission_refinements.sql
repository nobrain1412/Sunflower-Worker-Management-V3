-- Migration 008: tinh chỉnh phân quyền
-- - Mỗi user có danh mục thu/chi RIÊNG (user_id NULL = danh mục mặc định hệ thống).
-- - hoat_dong_log có muc_do (thuong | quan_trong) để tách log cá nhân vs log hệ thống.
BEGIN;

-- ─── DANH MỤC THU/CHI: thêm user_id ──────────────────────────
ALTER TABLE danh_muc_giao_dich
  ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_dmgd_user_id ON danh_muc_giao_dich(user_id);

-- Đảm bảo (user_id, ten, loai) không trùng — null user_id được coi là khác
CREATE UNIQUE INDEX IF NOT EXISTS uq_dmgd_user_ten_loai_owned
  ON danh_muc_giao_dich(user_id, ten, loai)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dmgd_system_ten_loai
  ON danh_muc_giao_dich(ten, loai)
  WHERE user_id IS NULL;

-- ─── HOAT_DONG_LOG: thêm muc_do ──────────────────────────────
ALTER TABLE hoat_dong_log
  ADD COLUMN IF NOT EXISTS muc_do VARCHAR(20) NOT NULL DEFAULT 'thuong'
  CHECK (muc_do IN ('thuong', 'quan_trong'));

-- Index cho log hệ thống (admin xem mặc định)
CREATE INDEX IF NOT EXISTS idx_hdl_quan_trong
  ON hoat_dong_log(created_at DESC)
  WHERE muc_do = 'quan_trong';

-- Index cho log cá nhân (user xem log do chính mình tạo)
CREATE INDEX IF NOT EXISTS idx_hdl_created_by_time
  ON hoat_dong_log(created_by, created_at DESC);

COMMIT;
