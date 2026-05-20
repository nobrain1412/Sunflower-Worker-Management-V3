-- Migration 010: Đơn giá thưởng theo từng cặp (user × công ty)
-- Mỗi vender / cộng tác viên có 1 mức thưởng riêng ở mỗi công ty.
-- - Vender   : don_gia_theo_gio (VNĐ/giờ)
-- - CTV      : tien_cong_moi_nguoi (VNĐ/người tuyển đủ điều kiện)
-- Cột cũ cong_ty.don_gia_theo_gio_vender và users.tien_cong_moi_nguoi bị BỎ.

BEGIN;

CREATE TABLE IF NOT EXISTS user_cong_ty_rate (
  id                   SERIAL PRIMARY KEY,
  user_id              INT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  cong_ty_id           INT NOT NULL REFERENCES cong_ty(id) ON DELETE CASCADE,
  -- Vender: đơn giá / giờ
  don_gia_theo_gio     NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- CTV: tiền công mỗi người tuyển đủ điều kiện
  tien_cong_moi_nguoi  NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, cong_ty_id)
);
CREATE INDEX IF NOT EXISTS idx_uctr_user ON user_cong_ty_rate(user_id);
CREATE INDEX IF NOT EXISTS idx_uctr_cty  ON user_cong_ty_rate(cong_ty_id);

DROP TRIGGER IF EXISTS trg_uctr_updated_at ON user_cong_ty_rate;
CREATE TRIGGER trg_uctr_updated_at BEFORE UPDATE ON user_cong_ty_rate
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- Bỏ cột cũ
ALTER TABLE cong_ty DROP COLUMN IF EXISTS don_gia_theo_gio_vender;
ALTER TABLE users   DROP COLUMN IF EXISTS tien_cong_moi_nguoi;

COMMIT;
