-- Migration 009: Seed dữ liệu mẫu cho cong_ty, ky_tuc_xa và giao_dich_tai_chinh
-- Toàn bộ dữ liệu đều liên kết với cong_nhan đang có trong hệ thống
-- WorkerOS v1.0 — 05/2026

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. CÔNG TY — 4 công ty mẫu kèm cấu hình lương
-- ─────────────────────────────────────────────────────────────
INSERT INTO cong_ty (
  ten_cong_ty, dia_chi, so_dien_thoai, email,
  luong_co_ban, luong_theo_gio, he_so_ot, ngay_lam_chuan,
  luong_tc_ngay, luong_hc_dem, luong_tc_dem, luong_chu_nhat, luong_ngay_le,
  mo_ta_cong_viec, active
)
SELECT * FROM (VALUES
  ('Công ty TNHH Samsung Electronics VN', 'KCN Yên Phong, Bắc Ninh', '02223123456', 'hr@samsung.vn',
   8500000, 38000, 1.5, 26, 57000, 45600, 68400, 76000, 152000,
   'Lắp ráp linh kiện điện tử, môi trường máy lạnh, ca 8h.', TRUE),
  ('Công ty TNHH Canon Việt Nam', 'KCN Thăng Long, Hà Nội', '02438581234', 'recruit@canon.vn',
   8000000, 36000, 1.5, 26, 54000, 43200, 64800, 72000, 144000,
   'Sản xuất máy in, máy ảnh. Yêu cầu mắt tốt, tỉ mỉ.', TRUE),
  ('Công ty CP Foxconn Bắc Giang', 'KCN Quang Châu, Bắc Giang', '02046501234', 'tuyendung@foxconn.vn',
   9000000, 40000, 2.0, 26, 60000, 48000, 72000, 80000, 160000,
   'Lắp ráp iPhone/iPad. Tăng ca thường xuyên.', TRUE),
  ('Công ty TNHH Luxshare-ICT VN', 'KCN Vân Trung, Bắc Giang', '02046601234', 'hr@luxshare.vn',
   8200000, 37000, 1.5, 26, 55500, 44400, 66600, 74000, 148000,
   'Sản xuất tai nghe, cáp sạc. Ca ngày + ca đêm.', TRUE)
) AS v(ten_cong_ty, dia_chi, so_dien_thoai, email,
       luong_co_ban, luong_theo_gio, he_so_ot, ngay_lam_chuan,
       luong_tc_ngay, luong_hc_dem, luong_tc_dem, luong_chu_nhat, luong_ngay_le,
       mo_ta_cong_viec, active)
WHERE NOT EXISTS (
  SELECT 1 FROM cong_ty c WHERE c.ten_cong_ty = v.ten_cong_ty
);

-- ─────────────────────────────────────────────────────────────
-- 2. PHÂN CÔNG — chia đều công nhân (chưa nghỉ việc) vào 4 công ty
--    Liên kết: cong_nhan ↔ cong_ty qua bảng phan_cong
-- ─────────────────────────────────────────────────────────────
WITH cn_active AS (
  SELECT
    id AS cong_nhan_id,
    ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM cong_nhan
  WHERE deleted_at IS NULL AND trang_thai <> 'nghi_viec'
),
cty_list AS (
  SELECT
    id AS cong_ty_id,
    ROW_NUMBER() OVER (ORDER BY id) AS rn,
    (SELECT COUNT(*) FROM cong_ty WHERE active = TRUE) AS total
  FROM cong_ty
  WHERE active = TRUE
)
INSERT INTO phan_cong (cong_nhan_id, cong_ty_id, ngay_bat_dau, ghi_chu)
SELECT
  cn.cong_nhan_id,
  cty.cong_ty_id,
  COALESCE(
    (SELECT ngay_vao_lam FROM cong_nhan WHERE id = cn.cong_nhan_id),
    CURRENT_DATE - INTERVAL '30 days'
  )::date,
  'Seed dữ liệu mẫu — phân công tự động'
FROM cn_active cn
JOIN cty_list cty
  ON cty.rn = ((cn.rn - 1) % (SELECT total FROM cty_list LIMIT 1)) + 1
WHERE NOT EXISTS (
  SELECT 1 FROM phan_cong pc
  WHERE pc.cong_nhan_id = cn.cong_nhan_id
    AND pc.ngay_ket_thuc IS NULL
);

-- ─────────────────────────────────────────────────────────────
-- 3. KÝ TÚC XÁ — 2 căn, mỗi căn 4 phòng, mỗi phòng 6 giường
-- ─────────────────────────────────────────────────────────────
INSERT INTO ky_tuc_xa (ten, dia_chi, ghi_chu, active)
SELECT * FROM (VALUES
  ('KTX Số 1 — Yên Phong',  'Thôn Đông, Yên Phong, Bắc Ninh', 'Căn chính, gần KCN Samsung', TRUE),
  ('KTX Số 2 — Quang Châu', 'Quang Châu, Việt Yên, Bắc Giang', 'Căn phụ, gần KCN Foxconn', TRUE)
) AS v(ten, dia_chi, ghi_chu, active)
WHERE NOT EXISTS (SELECT 1 FROM ky_tuc_xa k WHERE k.ten = v.ten);

-- Phòng — 4 phòng/căn (P101..P104), tiền phòng 1.500.000đ/tháng
INSERT INTO phong (ktx_id, ten_phong, tang, suc_chua, tien_phong, active)
SELECT k.id, p.ten_phong, p.tang, 6, 1500000, TRUE
FROM ky_tuc_xa k
CROSS JOIN (VALUES
  ('P101', 1), ('P102', 1), ('P103', 1), ('P104', 1)
) AS p(ten_phong, tang)
WHERE k.active = TRUE
ON CONFLICT (ktx_id, ten_phong) DO NOTHING;

-- Giường — 6 giường/phòng
INSERT INTO giuong (phong_id, so_thu_tu)
SELECT p.id, g.so_thu_tu
FROM phong p
CROSS JOIN generate_series(1, 6) AS g(so_thu_tu)
ON CONFLICT (phong_id, so_thu_tu) DO NOTHING;

-- Thuê phòng — gán mỗi công nhân (chưa nghỉ) vào 1 giường còn trống
WITH cn_can_xep AS (
  SELECT
    cn.id AS cong_nhan_id,
    ROW_NUMBER() OVER (ORDER BY cn.id) AS rn
  FROM cong_nhan cn
  WHERE cn.deleted_at IS NULL
    AND cn.trang_thai <> 'nghi_viec'
    AND NOT EXISTS (
      SELECT 1 FROM thue_phong tp
      WHERE tp.cong_nhan_id = cn.id AND tp.ngay_ra IS NULL
    )
),
giuong_trong AS (
  SELECT
    g.id AS giuong_id,
    ROW_NUMBER() OVER (ORDER BY g.id) AS rn
  FROM giuong g
  WHERE NOT EXISTS (
    SELECT 1 FROM thue_phong tp
    WHERE tp.giuong_id = g.id AND tp.ngay_ra IS NULL
  )
)
INSERT INTO thue_phong (cong_nhan_id, giuong_id, ngay_vao, ghi_chu)
SELECT
  cn.cong_nhan_id,
  gt.giuong_id,
  CURRENT_DATE - INTERVAL '20 days',
  'Seed dữ liệu mẫu — xếp giường tự động'
FROM cn_can_xep cn
JOIN giuong_trong gt ON gt.rn = cn.rn;

-- Hoá đơn KTX tháng hiện tại cho mỗi phòng có người ở
INSERT INTO hoa_don_ktx (
  phong_id, thang, nam,
  dien_cu, dien_moi, don_gia_dien,
  nuoc_cu, nuoc_moi, don_gia_nuoc,
  tien_phong, ghi_chu
)
SELECT DISTINCT
  g.phong_id,
  EXTRACT(MONTH FROM CURRENT_DATE)::SMALLINT,
  EXTRACT(YEAR  FROM CURRENT_DATE)::SMALLINT,
  1200, 1380, 3500,
  45,   58,   25000,
  p.tien_phong,
  'Seed dữ liệu mẫu'
FROM thue_phong tp
JOIN giuong g ON g.id = tp.giuong_id
JOIN phong  p ON p.id = g.phong_id
WHERE tp.ngay_ra IS NULL
ON CONFLICT (phong_id, thang, nam) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 4. TÀI CHÍNH — mỗi công nhân có lương + tạm ứng + tiền KTX
--    Liên kết: cong_nhan ↔ giao_dich_tai_chinh qua cong_nhan_id
-- ─────────────────────────────────────────────────────────────
-- 4.1 Lương tháng trước (thu)
INSERT INTO giao_dich_tai_chinh
  (cong_nhan_id, danh_muc_id, loai, so_tien, ngay, ghi_chu)
SELECT
  cn.id,
  (SELECT id FROM danh_muc_giao_dich WHERE ten = 'Lương' LIMIT 1),
  'luong',
  8500000 + (cn.id % 5) * 200000,
  date_trunc('month', CURRENT_DATE)::date - INTERVAL '5 days',
  'Lương tháng ' || TO_CHAR(CURRENT_DATE - INTERVAL '1 month', 'MM/YYYY')
FROM cong_nhan cn
WHERE cn.deleted_at IS NULL AND cn.trang_thai <> 'nghi_viec'
  AND NOT EXISTS (
    SELECT 1 FROM giao_dich_tai_chinh g
    WHERE g.cong_nhan_id = cn.id AND g.loai = 'luong'
      AND g.ghi_chu LIKE 'Lương tháng%'
  );

-- 4.2 Tạm ứng (chi)
INSERT INTO giao_dich_tai_chinh
  (cong_nhan_id, danh_muc_id, loai, so_tien, ngay, ghi_chu, da_hoan_tien)
SELECT
  cn.id,
  (SELECT id FROM danh_muc_giao_dich WHERE ten = 'Tạm ứng' LIMIT 1),
  'tam_ung',
  500000 + (cn.id % 4) * 250000,
  CURRENT_DATE - ((cn.id % 10) || ' days')::INTERVAL,
  'Tạm ứng đầu kỳ',
  FALSE
FROM cong_nhan cn
WHERE cn.deleted_at IS NULL AND cn.trang_thai <> 'nghi_viec'
  AND NOT EXISTS (
    SELECT 1 FROM giao_dich_tai_chinh g
    WHERE g.cong_nhan_id = cn.id AND g.loai = 'tam_ung'
      AND g.ghi_chu = 'Tạm ứng đầu kỳ'
  );

-- 4.3 Tiền phòng KTX (chi) — chỉ cho công nhân có thuê giường active
INSERT INTO giao_dich_tai_chinh
  (cong_nhan_id, danh_muc_id, loai, so_tien, ngay, ghi_chu)
SELECT
  tp.cong_nhan_id,
  (SELECT id FROM danh_muc_giao_dich WHERE ten = 'Tiền phòng KTX' LIMIT 1),
  'tien_phong_ktx',
  ROUND(p.tien_phong / NULLIF(p.suc_chua, 0), 0),
  date_trunc('month', CURRENT_DATE)::date,
  'Tiền KTX tháng ' || TO_CHAR(CURRENT_DATE, 'MM/YYYY')
FROM thue_phong tp
JOIN giuong g ON g.id = tp.giuong_id
JOIN phong  p ON p.id = g.phong_id
WHERE tp.ngay_ra IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM giao_dich_tai_chinh gd
    WHERE gd.cong_nhan_id = tp.cong_nhan_id
      AND gd.loai = 'tien_phong_ktx'
      AND gd.ngay = date_trunc('month', CURRENT_DATE)::date
  );

COMMIT;
