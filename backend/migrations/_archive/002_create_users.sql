-- Migration 002: Tạo bảng users
BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  ten_dang_nhap   VARCHAR(50)  NOT NULL UNIQUE,
  mat_khau_hash   VARCHAR(255) NOT NULL,
  ho_ten          VARCHAR(100) NOT NULL,
  vai_tro         VARCHAR(20)  NOT NULL DEFAULT 'xem'
                  CHECK (vai_tro IN ('admin', 'quan_ly', 'xem')),
  active          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_ten_dang_nhap ON users (ten_dang_nhap);

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

COMMIT;
