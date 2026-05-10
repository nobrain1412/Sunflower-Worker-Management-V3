-- Migration 003: Hệ thống phân quyền — cong_ty, quan_ly_cong_ty, role vender, nguoi_tuyen_id
BEGIN;

-- 1. Tạo bảng cong_ty
CREATE TABLE IF NOT EXISTS cong_ty (
  id              SERIAL PRIMARY KEY,
  ten_cong_ty     VARCHAR(200) NOT NULL,
  dia_chi         VARCHAR(500),
  so_dien_thoai   VARCHAR(20),
  email           VARCHAR(100),
  -- Cấu hình bảng lương
  luong_co_ban    NUMERIC(12,2) NOT NULL DEFAULT 0,
  luong_theo_gio  NUMERIC(10,2) NOT NULL DEFAULT 0,
  he_so_ot        NUMERIC(4,2)  NOT NULL DEFAULT 1.5,
  ngay_lam_chuan  SMALLINT      NOT NULL DEFAULT 26,
  -- Trạng thái
  active          BOOLEAN      NOT NULL DEFAULT TRUE,
  ghi_chu         TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cong_ty_active ON cong_ty(active);

CREATE OR REPLACE TRIGGER trg_cong_ty_updated_at
  BEFORE UPDATE ON cong_ty
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- 2. Migrate role cũ 'xem' → 'vender', sau đó cập nhật constraint
UPDATE users SET vai_tro = 'vender' WHERE vai_tro = 'xem';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_vai_tro_check;
ALTER TABLE users ALTER COLUMN vai_tro SET DEFAULT 'vender';
ALTER TABLE users ADD CONSTRAINT users_vai_tro_check
  CHECK (vai_tro IN ('admin', 'quan_ly', 'vender'));

-- 3. Bảng pivot quản lý ↔ công ty (many-to-many: 1 QL nhiều cty, 1 cty nhiều QL)
CREATE TABLE IF NOT EXISTS quan_ly_cong_ty (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id)   ON DELETE RESTRICT,
  cong_ty_id  INT NOT NULL REFERENCES cong_ty(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, cong_ty_id)
);

CREATE INDEX IF NOT EXISTS idx_qlct_user   ON quan_ly_cong_ty(user_id);
CREATE INDEX IF NOT EXISTS idx_qlct_cty    ON quan_ly_cong_ty(cong_ty_id);

-- 4. Thêm nguoi_tuyen_id vào cong_nhan (ai tuyển công nhân này)
ALTER TABLE cong_nhan
  ADD COLUMN IF NOT EXISTS nguoi_tuyen_id INT REFERENCES users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_cong_nhan_nguoi_tuyen ON cong_nhan(nguoi_tuyen_id);

COMMIT;
