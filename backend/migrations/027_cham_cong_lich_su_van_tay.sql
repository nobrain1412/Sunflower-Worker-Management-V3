-- Migration 027: Lưu toàn bộ chuỗi lịch sử chấm vân tay (Kangyin).
-- Máy vân tay Kangyin xuất 1 cột "Lịch sử chấm vân tay" dạng "07:30| 08:35| 19:33|"
-- không thể tách thành gio_den/gio_nghi_trua/gio_ve vì số mốc biến thiên.
-- Cột mới lưu chuỗi thô; gio_den/gio_ve vẫn được populate từ mốc đầu/cuối.

BEGIN;

ALTER TABLE cham_cong
  ADD COLUMN IF NOT EXISTS lich_su_van_tay TEXT;

COMMIT;
