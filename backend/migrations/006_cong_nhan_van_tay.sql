BEGIN;

-- Mã vân tay dùng cho máy chấm công (mã số định danh trên thiết bị)
ALTER TABLE cong_nhan
  ADD COLUMN IF NOT EXISTS ma_van_tay VARCHAR(50);

COMMIT;
