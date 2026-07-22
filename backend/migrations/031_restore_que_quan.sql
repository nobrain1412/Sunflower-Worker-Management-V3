-- Migration 031: Khôi phục cột que_quan trên cong_nhan.
--
-- Lý do: bật lại nhận diện ảnh CCCD qua FPT.AI (dùng khi ảnh không đọc được QR).
-- FPT trả về trường `home` = quê quán — QR CCCD không có thông tin này.
--
-- Cột nullable, không đụng dữ liệu cũ → an toàn.
-- Lưu ý: bộ lọc "Tỉnh" và import Excel vẫn chạy trên dia_chi_hien_tai (không đổi).

BEGIN;

ALTER TABLE cong_nhan
  ADD COLUMN IF NOT EXISTS que_quan VARCHAR(200);

COMMIT;
