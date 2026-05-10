// Tất cả chuỗi tiếng Việt hiển thị trên UI — không hardcode trực tiếp trong JSX

export const TRANG_THAI_LABEL = {
  dang_lam:  'Đang làm',
  nghi_phep: 'Nghỉ phép',
  moi_vao:   'Mới vào',
  nghi_viec: 'Nghỉ việc',
};

export const TRANG_THAI_PILL = {
  dang_lam:  'pill-green',
  nghi_phep: 'pill-amber',
  moi_vao:   'pill-blue',
  nghi_viec: 'pill-red',
};

export const GIOI_TINH_OPTIONS = ['Nam', 'Nữ', 'Khác'];

export const TRANG_THAI_OPTIONS = Object.entries(TRANG_THAI_LABEL).map(
  ([value, label]) => ({ value, label }),
);

export const MSG = {
  loading:       'Đang tải...',
  error_generic: 'Đã xảy ra lỗi, vui lòng thử lại',
  not_found:     'Không tìm thấy',
  saved:         'Lưu thành công',
  deleted:       'Đã xoá',
  confirm_delete:'Bạn có chắc muốn xoá?',
};
