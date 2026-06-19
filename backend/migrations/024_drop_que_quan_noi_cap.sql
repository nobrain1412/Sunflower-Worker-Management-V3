-- Migration 024: Xoá hẳn cột que_quan & noi_cap_cccd khỏi cong_nhan
--
-- Lý do: chuyển sang quét QR CCCD — QR không chứa quê quán/nơi cấp. Nghiệp vụ
-- gom về dùng dia_chi_hien_tai (địa chỉ thường trú) cho mọi lọc/hiển thị.
-- Bộ lọc "Tỉnh" và import/export Excel cột "Địa chỉ" nay chạy trên dia_chi_hien_tai.
--
-- ⚠ PHÁ HUỶ: dữ liệu trong 2 cột này sẽ mất. migrate.js đã backup TRƯỚC khi chạy.

BEGIN;

ALTER TABLE cong_nhan DROP COLUMN IF EXISTS que_quan;
ALTER TABLE cong_nhan DROP COLUMN IF EXISTS noi_cap_cccd;

COMMIT;
