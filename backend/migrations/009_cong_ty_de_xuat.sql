-- Migration 009: Bảng đề xuất công ty (workflow approval cho quản lý)
-- Quản lý có thể đề xuất:
--   - Tạo mới công ty (loai = 'tao_moi', cong_ty_id = NULL)
--   - Sửa thông tin công ty (loai = 'sua_doi', cong_ty_id = id công ty cần sửa)
-- Admin duyệt → công ty được tạo/cập nhật + đánh dấu da_duyet
-- Admin từ chối → đánh dấu tu_choi + có thể kèm ghi_chu_admin

BEGIN;

CREATE TABLE IF NOT EXISTS cong_ty_de_xuat (
  id                SERIAL PRIMARY KEY,
  loai              VARCHAR(20) NOT NULL
                    CHECK (loai IN ('tao_moi', 'sua_doi')),
  -- NULL khi tao_moi, set khi sua_doi
  cong_ty_id        INT REFERENCES cong_ty(id) ON DELETE CASCADE,
  -- Toàn bộ field công ty được đề xuất (kể cả ten_cong_ty, lương, mô tả, media...)
  du_lieu           JSONB NOT NULL,
  trang_thai        VARCHAR(20) NOT NULL DEFAULT 'cho_duyet'
                    CHECK (trang_thai IN ('cho_duyet', 'da_duyet', 'tu_choi')),
  -- Ghi chú từ người đề xuất (vd: lý do tạo công ty mới)
  ghi_chu           TEXT,
  -- Ghi chú của admin khi duyệt/từ chối
  ghi_chu_admin     TEXT,
  nguoi_de_xuat_id  INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  nguoi_duyet_id    INT REFERENCES users(id) ON DELETE SET NULL,
  duyet_luc         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- sua_doi BẮT BUỘC có cong_ty_id
  CHECK (loai = 'tao_moi' OR cong_ty_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_ctdx_trang_thai
  ON cong_ty_de_xuat(trang_thai, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ctdx_nguoi_de_xuat
  ON cong_ty_de_xuat(nguoi_de_xuat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ctdx_cong_ty
  ON cong_ty_de_xuat(cong_ty_id) WHERE cong_ty_id IS NOT NULL;

CREATE TRIGGER trg_ctdx_updated_at BEFORE UPDATE ON cong_ty_de_xuat
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

COMMIT;
