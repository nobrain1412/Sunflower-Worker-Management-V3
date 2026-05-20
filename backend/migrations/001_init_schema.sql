-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  WorkerOS — Migration 001: Schema hoàn chỉnh (consolidated)      ║
-- ║  Phiên bản tổng hợp tất cả thay đổi schema trước đây.           ║
-- ║                                                                   ║
-- ║  CẢNH BÁO: File này XOÁ TOÀN BỘ schema public và tạo lại.        ║
-- ║  Chỉ chạy ở môi trường dev / khởi tạo lần đầu.                   ║
-- ╚══════════════════════════════════════════════════════════════════╝

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- TRIGGER FUNCTION: tự động cập nhật updated_at
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═════════════════════════════════════════════════════════════
-- 1. USERS — tài khoản & phân quyền
-- ═════════════════════════════════════════════════════════════
CREATE TABLE users (
  id                   SERIAL PRIMARY KEY,
  ten_dang_nhap        VARCHAR(50)  NOT NULL UNIQUE,
  mat_khau_hash        VARCHAR(255) NOT NULL,
  ho_ten               VARCHAR(100) NOT NULL,
  vai_tro              VARCHAR(20)  NOT NULL DEFAULT 'vender'
                       CHECK (vai_tro IN ('admin', 'quan_ly', 'vender', 'cong_tac_vien', 'ke_toan')),
  active               BOOLEAN      NOT NULL DEFAULT TRUE,
  -- Liên hệ + ngân hàng
  so_dien_thoai        VARCHAR(20),
  ngan_hang            VARCHAR(100),
  so_tai_khoan         VARCHAR(50),
  ten_chu_tk           VARCHAR(100),
  -- CTV: hình thức thanh toán (đơn giá theo công ty nằm ở user_cong_ty_rate)
  hinh_thuc_thanh_toan VARCHAR(20) NOT NULL DEFAULT 'mot_lan'
                       CHECK (hinh_thuc_thanh_toan IN ('mot_lan', 'hang_thang')),
  quan_ly_id           INT REFERENCES users(id) ON DELETE RESTRICT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_ten_dang_nhap ON users (ten_dang_nhap);
CREATE INDEX idx_users_vai_tro       ON users (vai_tro);
CREATE INDEX idx_users_quan_ly_id    ON users (quan_ly_id);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ═════════════════════════════════════════════════════════════
-- 2. CONG_TY — công ty + cấu hình lương
-- ═════════════════════════════════════════════════════════════
CREATE TABLE cong_ty (
  id              SERIAL PRIMARY KEY,
  ten_cong_ty     VARCHAR(200) NOT NULL,
  dia_chi         VARCHAR(500),
  map_url         TEXT,
  so_dien_thoai   VARCHAR(20),
  email           VARCHAR(100),
  -- Lương cơ bản
  luong_co_ban    NUMERIC(12,2) NOT NULL DEFAULT 0,
  luong_theo_gio  NUMERIC(10,2) NOT NULL DEFAULT 0,
  he_so_ot        NUMERIC(4,2)  NOT NULL DEFAULT 1.5,
  ngay_lam_chuan  SMALLINT      NOT NULL DEFAULT 26,
  -- Tăng ca chi tiết
  luong_tc_ngay   NUMERIC(10,2) NOT NULL DEFAULT 0,
  luong_hc_dem    NUMERIC(10,2) NOT NULL DEFAULT 0,
  luong_tc_dem    NUMERIC(10,2) NOT NULL DEFAULT 0,
  luong_chu_nhat  NUMERIC(10,2) NOT NULL DEFAULT 0,
  luong_ngay_le   NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Khấu trừ mặc định
  tien_dong_phuc  NUMERIC(12,2) NOT NULL DEFAULT 0,
  tien_phat_nghi  NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Trợ cấp (đơn giá vender theo công ty nằm ở user_cong_ty_rate)
  tro_cap                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  chuyen_can              NUMERIC(12,2) NOT NULL DEFAULT 0,
  ngay_chot_cong          SMALLINT      NOT NULL DEFAULT 25
                          CHECK (ngay_chot_cong BETWEEN 1 AND 31),
  -- Mô tả + media
  mo_ta_cong_viec TEXT,
  media_urls      JSONB NOT NULL DEFAULT '[]'::JSONB,
  ghi_chu         TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cong_ty_active ON cong_ty(active);
CREATE TRIGGER trg_cong_ty_updated_at BEFORE UPDATE ON cong_ty
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ═════════════════════════════════════════════════════════════
-- 3. QUAN_LY_CONG_TY — pivot: 1 quản lý ↔ nhiều công ty
-- ═════════════════════════════════════════════════════════════
CREATE TABLE quan_ly_cong_ty (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id)   ON DELETE RESTRICT,
  cong_ty_id  INT NOT NULL REFERENCES cong_ty(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, cong_ty_id)
);
CREATE INDEX idx_qlct_user ON quan_ly_cong_ty(user_id);
CREATE INDEX idx_qlct_cty  ON quan_ly_cong_ty(cong_ty_id);

-- ═════════════════════════════════════════════════════════════
-- 3.1. USER_CONG_TY_RATE — đơn giá thưởng (user × công ty)
-- - Vender: don_gia_theo_gio (VNĐ/giờ) khi tính lương vender
-- - CTV   : tien_cong_moi_nguoi (VNĐ/người tuyển đủ điều kiện)
-- ═════════════════════════════════════════════════════════════
CREATE TABLE user_cong_ty_rate (
  id                   SERIAL PRIMARY KEY,
  user_id              INT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  cong_ty_id           INT NOT NULL REFERENCES cong_ty(id) ON DELETE CASCADE,
  don_gia_theo_gio     NUMERIC(10,2) NOT NULL DEFAULT 0,
  tien_cong_moi_nguoi  NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, cong_ty_id)
);
CREATE INDEX idx_uctr_user ON user_cong_ty_rate(user_id);
CREATE INDEX idx_uctr_cty  ON user_cong_ty_rate(cong_ty_id);
CREATE TRIGGER trg_uctr_updated_at BEFORE UPDATE ON user_cong_ty_rate
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ═════════════════════════════════════════════════════════════
-- 4. CONG_NHAN — hồ sơ công nhân
-- ═════════════════════════════════════════════════════════════
CREATE TABLE cong_nhan (
  id                SERIAL PRIMARY KEY,
  -- Thông tin cá nhân
  ho_ten            VARCHAR(100) NOT NULL,
  cccd              VARCHAR(12),
  ngay_sinh         DATE,
  gioi_tinh         VARCHAR(10) CHECK (gioi_tinh IN ('Nam', 'Nữ', 'Khác')),
  que_quan          VARCHAR(200),
  dia_chi_hien_tai  TEXT,
  so_dien_thoai     VARCHAR(15),
  ngay_cap_cccd     DATE,
  noi_cap_cccd      VARCHAR(200),
  -- Trạng thái
  trang_thai        VARCHAR(20) NOT NULL DEFAULT 'moi_vao'
                    CHECK (trang_thai IN ('dang_lam', 'nghi_phep', 'moi_vao', 'nghi_viec')),
  ngay_vao_lam      DATE,
  ngay_nghi_viec    DATE,
  ghi_chu           TEXT,
  -- Liên kết
  nguoi_tuyen_id    INT REFERENCES users(id) ON DELETE RESTRICT,
  cong_ty_id        INT REFERENCES cong_ty(id) ON DELETE SET NULL,
  -- Ảnh
  anh_cccd_truoc    VARCHAR(500),
  anh_cccd_sau      VARCHAR(500),
  anh_chan_dung     VARCHAR(500),
  -- Khấu trừ tự động
  da_tra_dong_phuc  BOOLEAN NOT NULL DEFAULT FALSE,
  da_viet_don_nghi  BOOLEAN NOT NULL DEFAULT FALSE,
  -- Tài khoản ngân hàng
  ngan_hang         VARCHAR(100),
  so_tai_khoan      VARCHAR(50),
  ten_chu_tk        VARCHAR(100),
  -- CCCD đã trả & mượn xe
  cccd_da_tra       BOOLEAN NOT NULL DEFAULT FALSE,
  trang_thai_noi_o  VARCHAR(30) NOT NULL DEFAULT 'chua_co_phong'
                    CHECK (trang_thai_noi_o IN ('chua_co_phong', 'tu_tuc', 'ktx', 'phong_tro')),
  muon_xe           BOOLEAN NOT NULL DEFAULT FALSE,
  loai_xe           VARCHAR(20) CHECK (loai_xe IS NULL OR loai_xe IN ('xe_dap', 'xe_dien', 'xe_may')),
  xe_da_tra         BOOLEAN NOT NULL DEFAULT FALSE,
  ngay_muon_xe      DATE,
  anh_xe            VARCHAR(500),
  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);
-- CCCD unique chỉ với bản ghi chưa xoá
CREATE UNIQUE INDEX idx_cong_nhan_cccd_active ON cong_nhan(cccd) WHERE deleted_at IS NULL AND cccd IS NOT NULL;
CREATE INDEX idx_cong_nhan_cccd               ON cong_nhan(cccd);
CREATE INDEX idx_cong_nhan_trang_thai         ON cong_nhan(trang_thai);
CREATE INDEX idx_cong_nhan_deleted_at         ON cong_nhan(deleted_at);
CREATE INDEX idx_cong_nhan_nguoi_tuyen        ON cong_nhan(nguoi_tuyen_id);
CREATE INDEX idx_cong_nhan_cong_ty            ON cong_nhan(cong_ty_id);
CREATE INDEX idx_cong_nhan_cty_deleted        ON cong_nhan(cong_ty_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cong_nhan_nguoi_tuyen_deleted ON cong_nhan(nguoi_tuyen_id) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_cong_nhan_updated_at BEFORE UPDATE ON cong_nhan
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ═════════════════════════════════════════════════════════════
-- 5. PHAN_CONG — công nhân ↔ công ty theo thời gian
-- ═════════════════════════════════════════════════════════════
CREATE TABLE phan_cong (
  id            SERIAL PRIMARY KEY,
  cong_nhan_id  INT NOT NULL REFERENCES cong_nhan(id) ON DELETE RESTRICT,
  cong_ty_id    INT NOT NULL REFERENCES cong_ty(id)   ON DELETE RESTRICT,
  ngay_bat_dau  DATE NOT NULL,
  ngay_ket_thuc DATE,
  ghi_chu       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_phan_cong_cn   ON phan_cong(cong_nhan_id);
CREATE INDEX idx_phan_cong_cty  ON phan_cong(cong_ty_id);
CREATE INDEX idx_phan_cong_ngay ON phan_cong(cong_nhan_id, cong_ty_id);
CREATE TRIGGER trg_phan_cong_updated_at BEFORE UPDATE ON phan_cong
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ═════════════════════════════════════════════════════════════
-- 6. CHAM_CONG (đặt chỗ, chưa dùng nhiều — vẫn cần bảng)
-- ═════════════════════════════════════════════════════════════
CREATE TABLE cham_cong (
  id           SERIAL PRIMARY KEY,
  phan_cong_id INT NOT NULL REFERENCES phan_cong(id) ON DELETE RESTRICT,
  ngay         DATE NOT NULL,
  so_gio       NUMERIC(4,2) NOT NULL DEFAULT 0,
  so_gio_ot    NUMERIC(4,2) NOT NULL DEFAULT 0,
  ca_lam       VARCHAR(20),
  ghi_chu      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(phan_cong_id, ngay)
);
CREATE INDEX idx_cham_cong_phan_cong_ngay ON cham_cong(phan_cong_id, ngay);
CREATE TRIGGER trg_cham_cong_updated_at BEFORE UPDATE ON cham_cong
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ═════════════════════════════════════════════════════════════
-- 7. DANH_MUC_GIAO_DICH — phân loại thu/chi/tiêu
-- ═════════════════════════════════════════════════════════════
CREATE TABLE danh_muc_giao_dich (
  id         SERIAL PRIMARY KEY,
  ten        VARCHAR(100) NOT NULL,
  loai       VARCHAR(10)  NOT NULL CHECK (loai IN ('thu', 'chi', 'tieu')),
  mo_ta      TEXT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
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
  ('Khác',            'chi');

-- ═════════════════════════════════════════════════════════════
-- 8. GIAO_DICH_TAI_CHINH
-- ═════════════════════════════════════════════════════════════
CREATE TABLE giao_dich_tai_chinh (
  id              SERIAL PRIMARY KEY,
  cong_nhan_id    INT REFERENCES cong_nhan(id) ON DELETE RESTRICT,
  danh_muc_id     INT REFERENCES danh_muc_giao_dich(id) ON DELETE RESTRICT,
  loai            VARCHAR(20) NOT NULL
                  CHECK (loai IN ('thu','chi','tieu',
                                  'luong','thuong','phu_cap','hoan_ung',
                                  'khau_tru','tam_ung','tien_phong_ktx',
                                  'bao_hiem','dong_phuc','phat_nghi','khac')),
  so_tien         NUMERIC(14,2) NOT NULL DEFAULT 0,
  ngay            DATE NOT NULL DEFAULT CURRENT_DATE,
  ghi_chu         TEXT,
  da_hoan_tien    BOOLEAN NOT NULL DEFAULT FALSE,
  ngay_hoan       DATE,
  created_by      INT REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gdtc_cn   ON giao_dich_tai_chinh(cong_nhan_id);
CREATE INDEX idx_gdtc_ngay ON giao_dich_tai_chinh(ngay);
CREATE INDEX idx_gdtc_loai ON giao_dich_tai_chinh(loai);
CREATE TRIGGER trg_gdtc_updated_at BEFORE UPDATE ON giao_dich_tai_chinh
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ═════════════════════════════════════════════════════════════
-- 8.1. CONG_TAC_VIEN_THANH_TOAN
-- ═════════════════════════════════════════════════════════════
CREATE TABLE cong_tac_vien_thanh_toan (
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
CREATE INDEX idx_ctv_tt_ctv ON cong_tac_vien_thanh_toan(ctv_id);
CREATE INDEX idx_ctv_tt_cn ON cong_tac_vien_thanh_toan(cong_nhan_id);
CREATE INDEX idx_ctv_tt_thang_nam ON cong_tac_vien_thanh_toan(thang, nam);
CREATE UNIQUE INDEX uq_ctv_tt_mot_lan_cn
  ON cong_tac_vien_thanh_toan(cong_nhan_id)
  WHERE hinh_thuc = 'mot_lan';
CREATE UNIQUE INDEX uq_ctv_tt_thang_cn
  ON cong_tac_vien_thanh_toan(cong_nhan_id, thang, nam)
  WHERE hinh_thuc = 'hang_thang';

-- ═════════════════════════════════════════════════════════════
-- 9. KY_TUC_XA — căn KTX
-- ═════════════════════════════════════════════════════════════
CREATE TABLE ky_tuc_xa (
  id         SERIAL PRIMARY KEY,
  ten        VARCHAR(100) NOT NULL,
  dia_chi    TEXT,
  ghi_chu    TEXT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_ktx_updated_at BEFORE UPDATE ON ky_tuc_xa
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ═════════════════════════════════════════════════════════════
-- 10. PHONG (trong KTX)
-- ═════════════════════════════════════════════════════════════
CREATE TABLE phong (
  id          SERIAL PRIMARY KEY,
  ktx_id      INT NOT NULL REFERENCES ky_tuc_xa(id) ON DELETE RESTRICT,
  ten_phong   VARCHAR(20) NOT NULL,
  tang        SMALLINT NOT NULL DEFAULT 1,
  suc_chua    SMALLINT NOT NULL DEFAULT 6,
  tien_phong  NUMERIC(12,2) NOT NULL DEFAULT 0,
  ghi_chu     TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ktx_id, ten_phong)
);
CREATE INDEX idx_phong_ktx ON phong(ktx_id);
CREATE TRIGGER trg_phong_updated_at BEFORE UPDATE ON phong
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ═════════════════════════════════════════════════════════════
-- 11. GIUONG (trong phòng)
-- ═════════════════════════════════════════════════════════════
CREATE TABLE giuong (
  id         SERIAL PRIMARY KEY,
  phong_id   INT NOT NULL REFERENCES phong(id) ON DELETE RESTRICT,
  so_thu_tu  SMALLINT NOT NULL DEFAULT 1,
  ghi_chu    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(phong_id, so_thu_tu)
);
CREATE INDEX idx_giuong_phong ON giuong(phong_id);

-- ═════════════════════════════════════════════════════════════
-- 12. THUE_PHONG (công nhân ↔ giường)
-- ═════════════════════════════════════════════════════════════
CREATE TABLE thue_phong (
  id            SERIAL PRIMARY KEY,
  cong_nhan_id  INT NOT NULL REFERENCES cong_nhan(id) ON DELETE RESTRICT,
  giuong_id     INT NOT NULL REFERENCES giuong(id)    ON DELETE RESTRICT,
  ngay_vao      DATE NOT NULL,
  ngay_ra       DATE,
  ghi_chu       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_thue_phong_cn     ON thue_phong(cong_nhan_id);
CREATE INDEX idx_thue_phong_giuong ON thue_phong(giuong_id);
CREATE TRIGGER trg_thue_phong_updated_at BEFORE UPDATE ON thue_phong
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ═════════════════════════════════════════════════════════════
-- 13. HOA_DON_KTX — hoá đơn điện/nước/phòng theo tháng
-- ═════════════════════════════════════════════════════════════
CREATE TABLE hoa_don_ktx (
  id            SERIAL PRIMARY KEY,
  phong_id      INT NOT NULL REFERENCES phong(id) ON DELETE RESTRICT,
  thang         SMALLINT NOT NULL,
  nam           SMALLINT NOT NULL,
  dien_cu       NUMERIC(10,2) NOT NULL DEFAULT 0,
  dien_moi      NUMERIC(10,2) NOT NULL DEFAULT 0,
  don_gia_dien  NUMERIC(8,2)  NOT NULL DEFAULT 0,
  nuoc_cu       NUMERIC(10,2) NOT NULL DEFAULT 0,
  nuoc_moi      NUMERIC(10,2) NOT NULL DEFAULT 0,
  don_gia_nuoc  NUMERIC(8,2)  NOT NULL DEFAULT 0,
  tien_phong    NUMERIC(12,2) NOT NULL DEFAULT 0,
  ghi_chu       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(phong_id, thang, nam)
);
CREATE INDEX idx_hoadon_phong ON hoa_don_ktx(phong_id);
CREATE INDEX idx_hoadon_thang ON hoa_don_ktx(thang, nam);
CREATE TRIGGER trg_hoadon_updated_at BEFORE UPDATE ON hoa_don_ktx
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ═════════════════════════════════════════════════════════════
-- 14. PHONG_TRO — căn trọ thuê ngoài
-- ═════════════════════════════════════════════════════════════
CREATE TABLE phong_tro (
  id            SERIAL PRIMARY KEY,
  ten           VARCHAR(200) NOT NULL,
  dia_chi       TEXT,
  map_url       TEXT,
  chu_tro       VARCHAR(200),
  sdt_chu_tro   VARCHAR(20),
  so_phong      INT NOT NULL DEFAULT 0,
  tien_phong    NUMERIC(14,2) NOT NULL DEFAULT 0,
  ghi_chu       TEXT,
  -- Tài khoản ngân hàng chủ trọ
  ngan_hang     VARCHAR(100),
  so_tai_khoan  VARCHAR(50),
  ten_chu_tk    VARCHAR(100),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_phong_tro_active ON phong_tro(active);
CREATE TRIGGER trg_phong_tro_updated_at BEFORE UPDATE ON phong_tro
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ═════════════════════════════════════════════════════════════
-- 15. THUE_PHONG_TRO (công nhân ↔ phong_tro)
-- ═════════════════════════════════════════════════════════════
CREATE TABLE thue_phong_tro (
  id             SERIAL PRIMARY KEY,
  cong_nhan_id   INT NOT NULL REFERENCES cong_nhan(id) ON DELETE RESTRICT,
  phong_tro_id   INT NOT NULL REFERENCES phong_tro(id) ON DELETE RESTRICT,
  ngay_vao       DATE NOT NULL,
  ngay_ra        DATE,
  ghi_chu        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tpt_cn ON thue_phong_tro(cong_nhan_id);
CREATE INDEX idx_tpt_pt ON thue_phong_tro(phong_tro_id);
CREATE UNIQUE INDEX uq_tpt_cn_active
  ON thue_phong_tro(cong_nhan_id) WHERE ngay_ra IS NULL;

-- ═════════════════════════════════════════════════════════════
-- 16. OCR_QUET — lưu lịch sử OCR (CCCD / danh sách viết tay)
-- ═════════════════════════════════════════════════════════════
CREATE TABLE ocr_quet (
  id           SERIAL PRIMARY KEY,
  loai         VARCHAR(20) NOT NULL CHECK (loai IN ('cccd', 'danh_sach')),
  duong_dan_anh VARCHAR(500),
  ket_qua_json  JSONB,
  trang_thai   VARCHAR(20) NOT NULL DEFAULT 'cho_duyet'
               CHECK (trang_thai IN ('cho_duyet', 'da_duyet', 'tu_choi')),
  created_by   INT REFERENCES users(id) ON DELETE RESTRICT,
  cong_nhan_id INT REFERENCES cong_nhan(id) ON DELETE SET NULL,
  ghi_chu      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ocr_quet_trang_thai ON ocr_quet(trang_thai);
CREATE TRIGGER trg_ocr_quet_updated_at BEFORE UPDATE ON ocr_quet
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

COMMIT;
