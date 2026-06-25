-- Migration 025: Lưu giờ chấm chi tiết từ máy vân tay.
--   - gio_den       : giờ đến (giờ chấm vào đầu ca)
--   - gio_nghi_trua : giờ chấm nghỉ trưa
--   - gio_ve        : giờ về (giờ chấm cuối ca)
--
-- Lưu dạng VARCHAR(8) ('HH:MM' hoặc 'HH:MM:SS') vì máy vân tay xuất nhiều định dạng;
-- không ép TIME để tránh lỗi parse khi import. Cột nullable, không đụng dữ liệu cũ.

BEGIN;

ALTER TABLE cham_cong
  ADD COLUMN IF NOT EXISTS gio_den       VARCHAR(8),
  ADD COLUMN IF NOT EXISTS gio_nghi_trua VARCHAR(8),
  ADD COLUMN IF NOT EXISTS gio_ve        VARCHAR(8);

COMMIT;
