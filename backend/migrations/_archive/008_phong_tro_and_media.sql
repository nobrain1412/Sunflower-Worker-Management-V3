-- 008_phong_tro_and_media.sql
-- 1) Bổ sung cột mô tả công việc + media URL cho công ty
-- 2) Tạo bảng phong_tro (căn trọ thuê ngoài) và thue_phong_tro (gán công nhân)
-- 3) Thêm chỉ mục cho liên kết cong_ty <-> quan_ly và cong_ty <-> cong_nhan

-- ── 1. cong_ty: mô tả công việc + media (ảnh/video) ───────
ALTER TABLE cong_ty
  ADD COLUMN IF NOT EXISTS mo_ta_cong_viec TEXT,
  ADD COLUMN IF NOT EXISTS media_urls      JSONB NOT NULL DEFAULT '[]'::JSONB;

-- ── 2. phong_tro ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phong_tro (
  id            SERIAL PRIMARY KEY,
  ten           VARCHAR(200) NOT NULL,
  dia_chi       TEXT,
  map_url       TEXT,
  chu_tro       VARCHAR(200),
  sdt_chu_tro   VARCHAR(20),
  so_phong      INT NOT NULL DEFAULT 0,
  tien_phong    NUMERIC(14,2) NOT NULL DEFAULT 0,
  ghi_chu       TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phong_tro_active ON phong_tro(active);

DROP TRIGGER IF EXISTS trg_phong_tro_updated_at ON phong_tro;
CREATE TRIGGER trg_phong_tro_updated_at
  BEFORE UPDATE ON phong_tro
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ── 3. thue_phong_tro (cong_nhan ↔ phong_tro theo thời gian) ──
CREATE TABLE IF NOT EXISTS thue_phong_tro (
  id             SERIAL PRIMARY KEY,
  cong_nhan_id   INT NOT NULL REFERENCES cong_nhan(id) ON DELETE RESTRICT,
  phong_tro_id   INT NOT NULL REFERENCES phong_tro(id) ON DELETE RESTRICT,
  ngay_vao       DATE NOT NULL,
  ngay_ra        DATE,
  ghi_chu        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tpt_cn ON thue_phong_tro(cong_nhan_id);
CREATE INDEX IF NOT EXISTS idx_tpt_pt ON thue_phong_tro(phong_tro_id);

-- Mỗi công nhân chỉ có tối đa 1 thuê trọ active (ngay_ra IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_tpt_cn_active
  ON thue_phong_tro(cong_nhan_id) WHERE ngay_ra IS NULL;

-- ── 4. Củng cố liên kết công ty ↔ quản lý ↔ công nhân ─────
-- Index hỗ trợ filter "công nhân của công ty mà tôi đang quản lý"
CREATE INDEX IF NOT EXISTS idx_cong_nhan_cty_deleted
  ON cong_nhan(cong_ty_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cong_nhan_nguoi_tuyen_deleted
  ON cong_nhan(nguoi_tuyen_id) WHERE deleted_at IS NULL;
