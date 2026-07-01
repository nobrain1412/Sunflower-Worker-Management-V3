-- 028: Bảng hóa đơn điện/nước/tiền phòng cho phòng trọ thuê ngoài
-- Cấu trúc tương tự hoa_don_ktx nhưng gắn với phong_tro thay vì phong (KTX).
-- UNIQUE(phong_tro_id, thang, nam) → upsert khi nhập lại cùng tháng.

CREATE TABLE IF NOT EXISTS hoa_don_phong_tro (
  id            SERIAL PRIMARY KEY,
  phong_tro_id  INT          NOT NULL REFERENCES phong_tro(id) ON DELETE RESTRICT,
  thang         SMALLINT     NOT NULL CHECK (thang BETWEEN 1 AND 12),
  nam           SMALLINT     NOT NULL CHECK (nam >= 2020),
  dien_cu       NUMERIC(10,2) NOT NULL DEFAULT 0,
  dien_moi      NUMERIC(10,2) NOT NULL DEFAULT 0,
  don_gia_dien  NUMERIC(8,2)  NOT NULL DEFAULT 3000,
  nuoc_cu       NUMERIC(10,2) NOT NULL DEFAULT 0,
  nuoc_moi      NUMERIC(10,2) NOT NULL DEFAULT 0,
  don_gia_nuoc  NUMERIC(8,2)  NOT NULL DEFAULT 15000,
  tien_phong    NUMERIC(12,2) NOT NULL DEFAULT 0,
  ghi_chu       TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (phong_tro_id, thang, nam)
);
