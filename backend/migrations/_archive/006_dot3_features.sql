-- Migration 006: Đợt 3 — upload ảnh, khấu trừ CN, phan_cong integration
-- WorkerOS v1.0 — 05/2026

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Thêm cột ảnh vào cong_nhan
-- ─────────────────────────────────────────────────────────────
ALTER TABLE cong_nhan
  ADD COLUMN IF NOT EXISTS anh_cccd_truoc   VARCHAR(500),
  ADD COLUMN IF NOT EXISTS anh_cccd_sau     VARCHAR(500),
  ADD COLUMN IF NOT EXISTS anh_chan_dung    VARCHAR(500);

-- ─────────────────────────────────────────────────────────────
-- 2. Thêm trạng thái đồng phục & đơn nghỉ vào cong_nhan
--    (dùng cho tự động tính khấu trừ)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE cong_nhan
  ADD COLUMN IF NOT EXISTS da_tra_dong_phuc  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS da_viet_don_nghi  BOOLEAN NOT NULL DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────
-- 3. Thêm tiền khấu trừ tự động vào cong_ty
-- ─────────────────────────────────────────────────────────────
ALTER TABLE cong_ty
  ADD COLUMN IF NOT EXISTS tien_dong_phuc   NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tien_phat_nghi   NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- 4. Thêm cột cong_ty_id vào cong_nhan (phân công hiện tại)
--    Đây là shortcut FK cho truy vấn nhanh;
--    bảng phan_cong giữ lịch sử đầy đủ
-- ─────────────────────────────────────────────────────────────
ALTER TABLE cong_nhan
  ADD COLUMN IF NOT EXISTS cong_ty_id INT REFERENCES cong_ty(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cong_nhan_cong_ty ON cong_nhan(cong_ty_id);

COMMIT;
