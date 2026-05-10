-- 007_simplify_loai.sql
-- Đơn giản hoá `giao_dich_tai_chinh.loai` xuống còn 3 giá trị chính: thu/chi/tieu.
-- Các phân loại nhỏ hơn (lương, thưởng, tạm ứng...) chuyển sang `danh_muc_id`.
-- Vẫn giữ tương thích ngược: các giá trị enum cũ vẫn hợp lệ (không phá dữ liệu hiện có).

ALTER TABLE giao_dich_tai_chinh DROP CONSTRAINT IF EXISTS giao_dich_tai_chinh_loai_check;

ALTER TABLE giao_dich_tai_chinh
  ADD CONSTRAINT giao_dich_tai_chinh_loai_check
  CHECK (loai IN (
    -- Mới: 3 nhóm chính
    'thu', 'chi', 'tieu',
    -- Cũ (giữ tương thích để không phá dữ liệu cũ)
    'luong','thuong','phu_cap','hoan_ung',
    'khau_tru','tam_ung','tien_phong_ktx',
    'bao_hiem','dong_phuc','phat_nghi','khac'
  ));
