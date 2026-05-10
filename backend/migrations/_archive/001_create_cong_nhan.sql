-- Migration 001: Tạo bảng cong_nhan
-- WorkerOS v1.0 — 05/2026

BEGIN;

CREATE TABLE IF NOT EXISTS cong_nhan (
  id              SERIAL PRIMARY KEY,

  -- Thông tin cá nhân
  ho_ten          VARCHAR(100)  NOT NULL,
  cccd            VARCHAR(12)   NOT NULL,
  ngay_sinh       DATE,
  gioi_tinh       VARCHAR(10)   CHECK (gioi_tinh IN ('Nam', 'Nữ', 'Khác')),
  que_quan        VARCHAR(200),
  dia_chi_hien_tai TEXT,
  so_dien_thoai   VARCHAR(15),

  -- Thông tin CCCD
  ngay_cap_cccd   DATE,
  noi_cap_cccd    VARCHAR(200),

  -- Trạng thái công việc
  -- dang_lam | nghi_phep | moi_vao | nghi_viec
  trang_thai      VARCHAR(20)   NOT NULL DEFAULT 'moi_vao'
                  CHECK (trang_thai IN ('dang_lam', 'nghi_phep', 'moi_vao', 'nghi_viec')),

  ngay_vao_lam    DATE,
  ngay_nghi_viec  DATE,
  ghi_chu         TEXT,

  -- Timestamps
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ   -- soft delete
);

-- Unique CCCD chỉ áp dụng khi chưa bị xoá
CREATE UNIQUE INDEX IF NOT EXISTS idx_cong_nhan_cccd_active
  ON cong_nhan (cccd)
  WHERE deleted_at IS NULL;

-- Index bắt buộc theo CODING_REQUIREMENTS
CREATE INDEX IF NOT EXISTS idx_cong_nhan_cccd        ON cong_nhan (cccd);
CREATE INDEX IF NOT EXISTS idx_cong_nhan_trang_thai  ON cong_nhan (trang_thai);
CREATE INDEX IF NOT EXISTS idx_cong_nhan_deleted_at  ON cong_nhan (deleted_at);

-- Tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_cong_nhan_updated_at
  BEFORE UPDATE ON cong_nhan
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

COMMIT;
