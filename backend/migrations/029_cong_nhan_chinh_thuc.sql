-- Migration 029: Thêm loại công nhân (thời vụ / chính thức) và thông tin lợi nhuận
-- Chạy: psql -d <db> -f backend/migrations/029_cong_nhan_chinh_thuc.sql

ALTER TABLE cong_nhan
  ADD COLUMN IF NOT EXISTS loai_cong_nhan VARCHAR(20) NOT NULL DEFAULT 'thoi_vu'
    CHECK (loai_cong_nhan IN ('thoi_vu', 'chinh_thuc')),
  ADD COLUMN IF NOT EXISTS loi_nhuan_thang NUMERIC(14,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS so_thang_huong_loi_nhuan INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ngay_chinh_thuc DATE DEFAULT NULL;

COMMENT ON COLUMN cong_nhan.loai_cong_nhan        IS 'thoi_vu (mặc định) | chinh_thuc';
COMMENT ON COLUMN cong_nhan.loi_nhuan_thang        IS 'Tiền lợi nhuận mỗi tháng (chỉ áp dụng cho chính thức)';
COMMENT ON COLUMN cong_nhan.so_thang_huong_loi_nhuan IS 'Số tháng được hưởng lợi nhuận kể từ ngay_chinh_thuc';
COMMENT ON COLUMN cong_nhan.ngay_chinh_thuc        IS 'Ngày bắt đầu tính lợi nhuận chính thức';
