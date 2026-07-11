-- Migration 030: Bảng tra cứu chấm công vân tay theo tháng (lưu nguyên JSON).
--
-- File Excel máy vân tay (~15-20k dòng/tháng) được convert sang JSON và lưu
-- 1 blob JSONB / (công ty, tháng) thay vì normalize từng dòng vào cham_cong.
-- Mỗi lần upload GHI ĐÈ toàn bộ dữ liệu tháng đó — máy vân tay luôn xuất full
-- cả tháng nên file mới nhất là bản đúng nhất (đã sửa các ngày trước đó).
--
-- JSONB được Postgres nén qua TOAST → mỗi tháng chỉ ~1-3 MB, không tạo gánh
-- nặng cho DB dù bảng gốc rất "nặng" khi để nguyên .xlsx.

BEGIN;

CREATE TABLE IF NOT EXISTS bang_van_tay_thang (
  id           SERIAL PRIMARY KEY,
  cong_ty_id   INTEGER  NOT NULL REFERENCES cong_ty(id) ON DELETE RESTRICT,
  thang        SMALLINT NOT NULL CHECK (thang BETWEEN 1 AND 12),
  nam          SMALLINT NOT NULL CHECK (nam BETWEEN 2000 AND 2100),
  du_lieu      JSONB    NOT NULL,   -- { headers: [...], rows: [ {header: value} ] }
  so_dong      INTEGER  NOT NULL DEFAULT 0,   -- số dòng dữ liệu (không kể header)
  so_cong_nhan INTEGER  NOT NULL DEFAULT 0,   -- số mã thẻ khác nhau trong file
  uploaded_by  INTEGER  REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Mỗi (công ty, tháng, năm) chỉ 1 bản → UPSERT ghi đè
  CONSTRAINT uq_bang_van_tay_thang UNIQUE (cong_ty_id, thang, nam)
);

-- Index phục vụ tra cứu theo kỳ + liệt kê các tháng đã có của 1 công ty
CREATE INDEX IF NOT EXISTS idx_bang_van_tay_thang_ky
  ON bang_van_tay_thang (cong_ty_id, nam DESC, thang DESC);

COMMIT;
