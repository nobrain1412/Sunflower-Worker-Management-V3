-- Migration 010: Mở rộng tính năng theo BUG_REPORT.md
-- - Roles mới: cong_tac_vien, ke_toan
-- - Thông tin tài khoản ngân hàng cho users, cong_nhan, phong_tro
-- - cong_nhan: trang_thai_cccd, muon_xe, loai_xe
-- - cong_ty: don_gia_theo_gio_vender, tro_cap, chuyen_can, ngay_chot_cong
-- - users: tien_cong_moi_nguoi (cho cộng tác viên)
-- WorkerOS v1.0 — 05/2026

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Mở rộng role: thêm 'cong_tac_vien' và 'ke_toan'
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_vai_tro_check;
ALTER TABLE users ADD CONSTRAINT users_vai_tro_check
  CHECK (vai_tro IN ('admin', 'quan_ly', 'vender', 'cong_tac_vien', 'ke_toan'));

-- ─────────────────────────────────────────────────────────────
-- 2. Thông tin ngân hàng (3 bảng: users, cong_nhan, phong_tro)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ngan_hang     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS so_tai_khoan  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ten_chu_tk    VARCHAR(100),
  -- Số điện thoại + ghi chú (cộng tác viên cần SĐT)
  ADD COLUMN IF NOT EXISTS so_dien_thoai VARCHAR(20),
  -- Tiền công mỗi người tuyển (cho cộng tác viên)
  ADD COLUMN IF NOT EXISTS tien_cong_moi_nguoi NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE cong_nhan
  ADD COLUMN IF NOT EXISTS ngan_hang     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS so_tai_khoan  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ten_chu_tk    VARCHAR(100);

ALTER TABLE phong_tro
  ADD COLUMN IF NOT EXISTS ngan_hang     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS so_tai_khoan  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ten_chu_tk    VARCHAR(100);

-- ─────────────────────────────────────────────────────────────
-- 3. cong_nhan: trạng thái CCCD đã trả & mượn xe
-- ─────────────────────────────────────────────────────────────
ALTER TABLE cong_nhan
  ADD COLUMN IF NOT EXISTS cccd_da_tra   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS muon_xe       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS loai_xe       VARCHAR(20)
                  CHECK (loai_xe IS NULL OR loai_xe IN ('xe_dap', 'xe_dien', 'xe_may')),
  ADD COLUMN IF NOT EXISTS xe_da_tra     BOOLEAN NOT NULL DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────
-- 4. cong_ty: đơn giá theo giờ trả vender + trợ cấp + chuyên cần + ngày chốt công
-- ─────────────────────────────────────────────────────────────
ALTER TABLE cong_ty
  ADD COLUMN IF NOT EXISTS don_gia_theo_gio_vender NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tro_cap                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chuyen_can              NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ngay_chot_cong          SMALLINT      NOT NULL DEFAULT 25
                                                    CHECK (ngay_chot_cong BETWEEN 1 AND 31);

COMMIT;
