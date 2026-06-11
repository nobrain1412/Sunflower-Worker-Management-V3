-- Migration 020: Hoàn tiền 1 phần cho khoản chi.
--   - so_tien_da_hoan: tổng tiền đã hoàn luỹ kế (0 → so_tien).
--   - da_hoan_tien giữ lại làm cờ "đã hoàn đủ" (sync tự động khi cập nhật).
--   - Backfill: khoản đã đánh dấu hoàn (bool) → coi như hoàn đủ.

BEGIN;

ALTER TABLE giao_dich_tai_chinh
  ADD COLUMN IF NOT EXISTS so_tien_da_hoan NUMERIC(14,2) NOT NULL DEFAULT 0;

UPDATE giao_dich_tai_chinh
SET so_tien_da_hoan = so_tien
WHERE da_hoan_tien = TRUE AND so_tien_da_hoan = 0;

COMMIT;
