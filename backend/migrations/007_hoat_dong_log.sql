BEGIN;

-- Bảng audit log các hoạt động liên quan tới công nhân.
-- Dùng cho cả "Hệ thống" timeline trong chi tiết CN lẫn "Hoạt động gần đây"
-- của người tuyển trên Dashboard.
CREATE TABLE IF NOT EXISTS hoat_dong_log (
  id              SERIAL PRIMARY KEY,
  loai            VARCHAR(40) NOT NULL,
  -- Ví dụ: chuyen_cong_ty, chuyen_phong, hoan_ung, bao_nghi_phep,
  -- bao_nghi_viec, cham_cong_batch, them_cn, sua_cn
  cong_nhan_id    INT REFERENCES cong_nhan(id) ON DELETE SET NULL,
  nguoi_tuyen_id  INT REFERENCES users(id)     ON DELETE SET NULL,
  du_lieu         JSONB,
  ghi_chu         TEXT,
  created_by      INT REFERENCES users(id)     ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hdl_cong_nhan   ON hoat_dong_log(cong_nhan_id);
CREATE INDEX IF NOT EXISTS idx_hdl_nguoi_tuyen ON hoat_dong_log(nguoi_tuyen_id);
CREATE INDEX IF NOT EXISTS idx_hdl_created_at  ON hoat_dong_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hdl_loai        ON hoat_dong_log(loai);

COMMIT;
