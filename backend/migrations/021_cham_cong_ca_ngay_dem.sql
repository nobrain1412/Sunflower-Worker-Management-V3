-- Migration 021: Tách giờ chấm công thành 4 loại — hành chính / tăng ca × ca ngày / ca đêm.
--   - gio_hc_ngay : giờ hành chính ca ngày
--   - gio_tc_ngay : tăng ca ca ngày
--   - gio_hc_dem  : giờ hành chính ca đêm
--   - gio_tc_dem  : tăng ca ca đêm
--
-- so_gio / so_gio_ot ĐƯỢC GIỮ LẠI làm TỔNG để các tính toán cũ không phải đổi:
--   so_gio    = gio_hc_ngay + gio_hc_dem      (tổng giờ hành chính)
--   so_gio_ot = gio_tc_ngay + gio_tc_dem      (tổng giờ tăng ca)
--
-- Migration CHỈ THÊM cột (an toàn, không mất dữ liệu). Backfill dữ liệu cũ → coi như ca ngày.

BEGIN;

ALTER TABLE cham_cong
  ADD COLUMN IF NOT EXISTS gio_hc_ngay NUMERIC(4,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gio_tc_ngay NUMERIC(4,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gio_hc_dem  NUMERIC(4,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gio_tc_dem  NUMERIC(4,2) NOT NULL DEFAULT 0;

-- Backfill: dữ liệu cũ (so_gio/so_gio_ot) coi như ca NGÀY.
-- Chỉ chạy với bản ghi mà 4 cột mới còn = 0 (idempotent, chạy lại không hỏng).
UPDATE cham_cong
   SET gio_hc_ngay = so_gio,
       gio_tc_ngay = so_gio_ot
 WHERE gio_hc_ngay = 0 AND gio_tc_ngay = 0
   AND gio_hc_dem  = 0 AND gio_tc_dem  = 0
   AND (so_gio <> 0 OR so_gio_ot <> 0);

COMMIT;
