-- Migration 005: Đợt 2 — OT fields, KTX, giao_dich_tai_chinh, danh_muc, phan_cong
-- WorkerOS v1.0 — 05/2026

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Thêm 5 cột tăng ca vào cong_ty
-- ─────────────────────────────────────────────────────────────
ALTER TABLE cong_ty
  ADD COLUMN IF NOT EXISTS luong_tc_ngay    NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS luong_hc_dem     NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS luong_tc_dem     NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS luong_chu_nhat   NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS luong_ngay_le    NUMERIC(10,2) NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- 2. Bảng phân công: công nhân ↔ công ty theo thời gian
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phan_cong (
  id            SERIAL PRIMARY KEY,
  cong_nhan_id  INT NOT NULL REFERENCES cong_nhan(id) ON DELETE RESTRICT,
  cong_ty_id    INT NOT NULL REFERENCES cong_ty(id)   ON DELETE RESTRICT,
  ngay_bat_dau  DATE NOT NULL,
  ngay_ket_thuc DATE,
  ghi_chu       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phan_cong_cn  ON phan_cong(cong_nhan_id);
CREATE INDEX IF NOT EXISTS idx_phan_cong_cty ON phan_cong(cong_ty_id);
CREATE INDEX IF NOT EXISTS idx_phan_cong_ngay ON phan_cong(cong_nhan_id, cong_ty_id);

CREATE OR REPLACE TRIGGER trg_phan_cong_updated_at
  BEFORE UPDATE ON phan_cong
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 3. Tài chính: danh_muc_giao_dich
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS danh_muc_giao_dich (
  id        SERIAL PRIMARY KEY,
  ten       VARCHAR(100) NOT NULL,
  loai      VARCHAR(10)  NOT NULL CHECK (loai IN ('thu', 'chi', 'tieu')),
  mo_ta     TEXT,
  active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Danh mục mặc định
INSERT INTO danh_muc_giao_dich (ten, loai) VALUES
  ('Lương',           'thu'),
  ('Thưởng',          'thu'),
  ('Phụ cấp',         'thu'),
  ('Hoàn ứng',        'thu'),
  ('Khấu trừ',        'chi'),
  ('Tạm ứng',         'chi'),
  ('Tiền phòng KTX',  'chi'),
  ('Bảo hiểm',        'chi'),
  ('Đồng phục',       'chi'),
  ('Phạt nghỉ',       'chi'),
  ('Chi phí lương',   'tieu'),
  ('Khác',            'chi')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 4. Tài chính: giao_dich_tai_chinh
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS giao_dich_tai_chinh (
  id              SERIAL PRIMARY KEY,
  cong_nhan_id    INT REFERENCES cong_nhan(id) ON DELETE RESTRICT,
  danh_muc_id     INT REFERENCES danh_muc_giao_dich(id) ON DELETE RESTRICT,
  loai            VARCHAR(20) NOT NULL
                  CHECK (loai IN ('luong','thuong','phu_cap','hoan_ung',
                                  'khau_tru','tam_ung','tien_phong_ktx',
                                  'bao_hiem','dong_phuc','phat_nghi','khac')),
  so_tien         NUMERIC(14,2) NOT NULL DEFAULT 0,
  ngay            DATE NOT NULL DEFAULT CURRENT_DATE,
  ghi_chu         TEXT,
  -- Toggle hoàn tiền (chỉ áp dụng cho loại chi)
  da_hoan_tien    BOOLEAN NOT NULL DEFAULT FALSE,
  ngay_hoan       DATE,
  created_by      INT REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gdtc_cn    ON giao_dich_tai_chinh(cong_nhan_id);
CREATE INDEX IF NOT EXISTS idx_gdtc_ngay  ON giao_dich_tai_chinh(ngay);
CREATE INDEX IF NOT EXISTS idx_gdtc_loai  ON giao_dich_tai_chinh(loai);

CREATE OR REPLACE TRIGGER trg_gdtc_updated_at
  BEFORE UPDATE ON giao_dich_tai_chinh
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 5. KTX: ky_tuc_xa (căn/khu)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ky_tuc_xa (
  id         SERIAL PRIMARY KEY,
  ten        VARCHAR(100) NOT NULL,
  dia_chi    TEXT,
  ghi_chu    TEXT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_ktx_updated_at
  BEFORE UPDATE ON ky_tuc_xa
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 6. KTX: phong (phòng trong căn)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phong (
  id          SERIAL PRIMARY KEY,
  ktx_id      INT NOT NULL REFERENCES ky_tuc_xa(id) ON DELETE RESTRICT,
  ten_phong   VARCHAR(20) NOT NULL,
  tang        SMALLINT NOT NULL DEFAULT 1,
  suc_chua    SMALLINT NOT NULL DEFAULT 6,
  tien_phong  NUMERIC(12,2) NOT NULL DEFAULT 0,  -- tiền phòng/tháng
  ghi_chu     TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ktx_id, ten_phong)
);

CREATE INDEX IF NOT EXISTS idx_phong_ktx ON phong(ktx_id);

CREATE OR REPLACE TRIGGER trg_phong_updated_at
  BEFORE UPDATE ON phong
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 7. KTX: giuong (giường trong phòng)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS giuong (
  id         SERIAL PRIMARY KEY,
  phong_id   INT NOT NULL REFERENCES phong(id) ON DELETE RESTRICT,
  so_thu_tu  SMALLINT NOT NULL DEFAULT 1,
  ghi_chu    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(phong_id, so_thu_tu)
);

CREATE INDEX IF NOT EXISTS idx_giuong_phong ON giuong(phong_id);

-- ─────────────────────────────────────────────────────────────
-- 8. KTX: thue_phong (công nhân ↔ giường, 1 active tại 1 thời điểm)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS thue_phong (
  id            SERIAL PRIMARY KEY,
  cong_nhan_id  INT NOT NULL REFERENCES cong_nhan(id) ON DELETE RESTRICT,
  giuong_id     INT NOT NULL REFERENCES giuong(id)    ON DELETE RESTRICT,
  ngay_vao      DATE NOT NULL,
  ngay_ra       DATE,
  ghi_chu       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thue_phong_cn     ON thue_phong(cong_nhan_id);
CREATE INDEX IF NOT EXISTS idx_thue_phong_giuong ON thue_phong(giuong_id);

CREATE OR REPLACE TRIGGER trg_thue_phong_updated_at
  BEFORE UPDATE ON thue_phong
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 9. KTX: hoa_don_ktx (điện, nước, tiền phòng hàng tháng)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hoa_don_ktx (
  id            SERIAL PRIMARY KEY,
  phong_id      INT NOT NULL REFERENCES phong(id) ON DELETE RESTRICT,
  thang         SMALLINT NOT NULL,
  nam           SMALLINT NOT NULL,
  -- Điện
  dien_cu       NUMERIC(10,2) NOT NULL DEFAULT 0,  -- số điện tháng trước
  dien_moi      NUMERIC(10,2) NOT NULL DEFAULT 0,  -- số điện tháng này
  don_gia_dien  NUMERIC(8,2)  NOT NULL DEFAULT 0,
  -- Nước
  nuoc_cu       NUMERIC(10,2) NOT NULL DEFAULT 0,
  nuoc_moi      NUMERIC(10,2) NOT NULL DEFAULT 0,
  don_gia_nuoc  NUMERIC(8,2)  NOT NULL DEFAULT 0,
  -- Tiền phòng (snapshot tại thời điểm tạo)
  tien_phong    NUMERIC(12,2) NOT NULL DEFAULT 0,
  ghi_chu       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(phong_id, thang, nam)
);

CREATE INDEX IF NOT EXISTS idx_hoadon_phong ON hoa_don_ktx(phong_id);
CREATE INDEX IF NOT EXISTS idx_hoadon_thang ON hoa_don_ktx(thang, nam);

CREATE OR REPLACE TRIGGER trg_hoadon_updated_at
  BEFORE UPDATE ON hoa_don_ktx
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

COMMIT;
