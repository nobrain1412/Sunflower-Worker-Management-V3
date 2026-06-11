-- Migration 019:
--   1. Gán khoản chi cho user khác:
--      - nguoi_nhan_id: user được gán (trên khoản CHI gốc)
--      - lien_ket_id:   khoản THU mirror trỏ về khoản CHI gốc.
--        Xoá khoản chi gốc → mirror tự xoá theo (CASCADE).
--   2. Đề xuất chung: cong_ty_de_xuat thêm loai 'khac' (đề xuất tự do gửi admin,
--      duyệt không tác động bảng cong_ty). Sửa CHECK cong_ty_id chỉ bắt buộc khi sua_doi.

BEGIN;

ALTER TABLE giao_dich_tai_chinh
  ADD COLUMN IF NOT EXISTS nguoi_nhan_id INT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lien_ket_id   INT REFERENCES giao_dich_tai_chinh(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_gdtc_lien_ket
  ON giao_dich_tai_chinh(lien_ket_id) WHERE lien_ket_id IS NOT NULL;

-- Mở rộng loại đề xuất
ALTER TABLE cong_ty_de_xuat DROP CONSTRAINT IF EXISTS cong_ty_de_xuat_loai_check;
ALTER TABLE cong_ty_de_xuat
  ADD CONSTRAINT cong_ty_de_xuat_loai_check
  CHECK (loai IN ('tao_moi', 'sua_doi', 'khac'));

-- CHECK cũ: (loai = 'tao_moi' OR cong_ty_id IS NOT NULL) — chặn loai 'khac' không có cong_ty_id
ALTER TABLE cong_ty_de_xuat DROP CONSTRAINT IF EXISTS cong_ty_de_xuat_check;
ALTER TABLE cong_ty_de_xuat
  ADD CONSTRAINT cong_ty_de_xuat_check
  CHECK (loai <> 'sua_doi' OR cong_ty_id IS NOT NULL);

COMMIT;
