-- Migration 013: Cột tiền công cho quản lý theo VNĐ/giờ
BEGIN;
ALTER TABLE cong_ty
  ADD COLUMN IF NOT EXISTS tien_cong_quan_ly_theo_gio NUMERIC(10,2) NOT NULL DEFAULT 0;
COMMIT;
