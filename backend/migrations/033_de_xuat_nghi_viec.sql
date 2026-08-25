-- Migration 033: Bảng đề xuất nghỉ việc (phát hiện từ bảng vân tay)
--
-- Bối cảnh: sau khi upload bảng vân tay theo tháng, hệ thống dò những công nhân
-- đã không đi làm >= 3 ngày (lịch) tính tới ngày cuối cùng trong bảng, mà trạng
-- thái chưa phải 'nghi_viec'. Những người này KHÔNG bị đổi trạng thái ngay — chỉ
-- được đưa vào hàng đợi "Duyệt nghỉ việc" để người quản lý xác nhận (giống luồng
-- duyệt OCR / duyệt công ty). Khi duyệt → công nhân mới thực sự chuyển 'nghi_viec'.
--
-- Chỉ THÊM bảng mới, không đụng dữ liệu hiện có → an toàn để chạy trước demo.

BEGIN;

CREATE TABLE IF NOT EXISTS de_xuat_nghi_viec (
  id                     SERIAL PRIMARY KEY,
  cong_nhan_id           INT NOT NULL REFERENCES cong_nhan(id) ON DELETE RESTRICT,
  -- Công ty tại thời điểm phát hiện (để lọc theo quyền quản lý)
  cong_ty_id             INT REFERENCES cong_ty(id) ON DELETE RESTRICT,
  -- Ngày chấm công gần nhất tìm thấy trong bảng vân tay (NULL = cả kỳ không có công)
  ngay_cuoi_cung_di_lam  DATE,
  -- Số ngày lịch vắng tính tới ngay_chot_bang (NULL khi không xác định được)
  so_ngay_vang           INT,
  -- Ngày cuối cùng có trong bảng vân tay — mốc để tính số ngày vắng
  ngay_chot_bang         DATE,
  ky_thang               INT,
  ky_nam                 INT,
  nguon                  VARCHAR(20) NOT NULL DEFAULT 'van_tay'
                         CHECK (nguon IN ('van_tay')),
  trang_thai             VARCHAR(20) NOT NULL DEFAULT 'cho_duyet'
                         CHECK (trang_thai IN ('cho_duyet', 'da_duyet', 'tu_choi')),
  ghi_chu                TEXT,
  nguoi_tao_id           INT REFERENCES users(id) ON DELETE SET NULL,
  nguoi_duyet_id         INT REFERENCES users(id) ON DELETE SET NULL,
  duyet_luc              TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mỗi công nhân chỉ có tối đa 1 đề xuất ĐANG CHỜ duyệt (idempotent khi upload lại).
CREATE UNIQUE INDEX IF NOT EXISTS uq_dxnv_cho_duyet
  ON de_xuat_nghi_viec(cong_nhan_id) WHERE trang_thai = 'cho_duyet';

CREATE INDEX IF NOT EXISTS idx_dxnv_trang_thai
  ON de_xuat_nghi_viec(trang_thai, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dxnv_cong_ty
  ON de_xuat_nghi_viec(cong_ty_id) WHERE cong_ty_id IS NOT NULL;

CREATE TRIGGER trg_dxnv_updated_at BEFORE UPDATE ON de_xuat_nghi_viec
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

COMMIT;
