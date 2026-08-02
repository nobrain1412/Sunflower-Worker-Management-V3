-- Migration 032: Thêm ảnh VNeID (ảnh chụp thẻ CCCD trong app VNeID / Zalo) cho hồ sơ công nhân
-- Chạy: psql -d <db> -f backend/migrations/032_cong_nhan_anh_vneid.sql

ALTER TABLE cong_nhan
  ADD COLUMN IF NOT EXISTS anh_vneid VARCHAR(500) DEFAULT NULL;

COMMENT ON COLUMN cong_nhan.anh_vneid IS 'URL ảnh VNeID (ảnh chụp thông tin CCCD trong app VNeID/Zalo)';
