BEGIN;

-- Mở rộng users cho cộng tác viên theo quản lý + hình thức thanh toán.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS quan_ly_id INT REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS hinh_thuc_thanh_toan VARCHAR(20) NOT NULL DEFAULT 'mot_lan'
    CHECK (hinh_thuc_thanh_toan IN ('mot_lan', 'hang_thang'));

CREATE INDEX IF NOT EXISTS idx_users_quan_ly_id ON users(quan_ly_id);

-- Mở rộng cong_nhan cho thông tin mượn xe.
ALTER TABLE cong_nhan
  ADD COLUMN IF NOT EXISTS trang_thai_noi_o VARCHAR(30) NOT NULL DEFAULT 'chua_co_phong'
    CHECK (trang_thai_noi_o IN ('chua_co_phong', 'tu_tuc', 'ktx', 'phong_tro')),
  ADD COLUMN IF NOT EXISTS ngay_muon_xe DATE,
  ADD COLUMN IF NOT EXISTS anh_xe VARCHAR(500);

-- Bổ sung bản đồ nhúng cho công ty.
ALTER TABLE cong_ty
  ADD COLUMN IF NOT EXISTS map_url TEXT;

-- Bảng ghi nhận thanh toán cộng tác viên.
CREATE TABLE IF NOT EXISTS cong_tac_vien_thanh_toan (
  id            SERIAL PRIMARY KEY,
  ctv_id        INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  cong_nhan_id  INT NOT NULL REFERENCES cong_nhan(id) ON DELETE RESTRICT,
  hinh_thuc     VARCHAR(20) NOT NULL CHECK (hinh_thuc IN ('mot_lan', 'hang_thang')),
  thang         SMALLINT,
  nam           SMALLINT,
  so_tien       NUMERIC(14,2) NOT NULL DEFAULT 0,
  ghi_chu       TEXT,
  created_by    INT REFERENCES users(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (hinh_thuc = 'mot_lan' AND thang IS NULL AND nam IS NULL)
    OR
    (hinh_thuc = 'hang_thang' AND thang BETWEEN 1 AND 12 AND nam >= 2020)
  )
);
CREATE INDEX IF NOT EXISTS idx_ctv_tt_ctv ON cong_tac_vien_thanh_toan(ctv_id);
CREATE INDEX IF NOT EXISTS idx_ctv_tt_cn ON cong_tac_vien_thanh_toan(cong_nhan_id);
CREATE INDEX IF NOT EXISTS idx_ctv_tt_thang_nam ON cong_tac_vien_thanh_toan(thang, nam);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ctv_tt_mot_lan_cn
  ON cong_tac_vien_thanh_toan(cong_nhan_id)
  WHERE hinh_thuc = 'mot_lan';
CREATE UNIQUE INDEX IF NOT EXISTS uq_ctv_tt_thang_cn
  ON cong_tac_vien_thanh_toan(cong_nhan_id, thang, nam)
  WHERE hinh_thuc = 'hang_thang';

COMMIT;
