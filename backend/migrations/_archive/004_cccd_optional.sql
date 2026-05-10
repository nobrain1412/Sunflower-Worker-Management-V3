-- Migration 004: CCCD không bắt buộc nữa (theo Bug Report Đợt 1)
BEGIN;

ALTER TABLE cong_nhan ALTER COLUMN cccd DROP NOT NULL;

COMMIT;
