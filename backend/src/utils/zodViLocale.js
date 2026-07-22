/**
 * Zod locale tiếng Việt — error map toàn cục + nhãn field tiếng Việt.
 *
 * Mặc định Zod trả message tiếng Anh ("Required", "Invalid enum value",
 * "String must contain at most X character(s)"...). Require file này 1 lần
 * (validate.js đã require) là mọi schema trong app dùng message tiếng Việt,
 * trừ field đã khai báo message riêng (message riêng luôn được ưu tiên).
 */
const { z, ZodIssueCode } = require('zod');

// Nhãn tiếng Việt cho field — dùng để ghép vào message ("Họ tên: Tối đa 100 ký tự")
const FIELD_LABELS = {
  // Công nhân
  ho_ten: 'Họ tên',
  cccd: 'CCCD',
  ngay_sinh: 'Ngày sinh',
  gioi_tinh: 'Giới tính',
  que_quan: 'Quê quán',
  dia_chi_hien_tai: 'Địa chỉ hiện tại',
  so_dien_thoai: 'Số điện thoại',
  ngay_cap_cccd: 'Ngày cấp CCCD',
  trang_thai: 'Trạng thái',
  ngay_vao_lam: 'Ngày vào làm',
  ngay_nghi_viec: 'Ngày nghỉ việc',
  ghi_chu: 'Ghi chú',
  cong_ty_id: 'Công ty',
  nguoi_tuyen_id: 'Người tuyển',
  trang_thai_noi_o: 'Trạng thái nơi ở',
  loai_xe: 'Loại xe',
  ngay_muon_xe: 'Ngày mượn xe',
  ma_van_tay: 'Mã vân tay',
  anh_cccd_truoc: 'Ảnh CCCD mặt trước',
  anh_cccd_sau: 'Ảnh CCCD mặt sau',
  anh_chan_dung: 'Ảnh chân dung',
  ngan_hang: 'Ngân hàng',
  so_tai_khoan: 'Số tài khoản',
  ten_chu_tk: 'Tên chủ tài khoản',
  // Công ty
  ten_cong_ty: 'Tên công ty',
  dia_chi: 'Địa chỉ',
  map_url: 'Link Google Maps',
  email: 'Email',
  luong_co_ban: 'Lương cơ bản',
  luong_theo_gio: 'Lương theo giờ',
  he_so_ot: 'Hệ số OT',
  ngay_lam_chuan: 'Ngày làm chuẩn',
  luong_tc_ngay: 'Lương tăng ca ngày',
  luong_hc_dem: 'Lương hành chính đêm',
  luong_tc_dem: 'Lương tăng ca đêm',
  luong_chu_nhat: 'Lương chủ nhật',
  luong_ngay_le: 'Lương ngày lễ',
  tien_dong_phuc: 'Tiền đồng phục',
  tien_phat_nghi: 'Tiền phạt nghỉ',
  tro_cap: 'Trợ cấp',
  chuyen_can: 'Chuyên cần',
  ngay_chot_cong: 'Ngày chốt công',
  tien_cong_quan_ly_theo_gio: 'Tiền công quản lý theo giờ',
  mo_ta_cong_viec: 'Mô tả công việc',
  media_urls: 'Ảnh/video',
  don_gia_theo_gio: 'Đơn giá theo giờ',
  tien_cong_moi_nguoi: 'Tiền công mỗi người',
  // Tài chính
  ten: 'Tên',
  loai: 'Loại',
  mo_ta: 'Mô tả',
  danh_muc_id: 'Danh mục',
  so_tien: 'Số tiền',
  ngay: 'Ngày',
  nguoi_nhan_id: 'Người nhận',
  so_tien_da_hoan: 'Số tiền đã hoàn',
  // KTX / phòng trọ
  ktx_id: 'Khu KTX',
  ten_phong: 'Tên phòng',
  tang: 'Tầng',
  suc_chua: 'Sức chứa',
  tien_phong: 'Tiền phòng',
  cong_nhan_id: 'Công nhân',
  ngay_vao: 'Ngày vào',
  ngay_ra: 'Ngày ra',
  thang: 'Tháng',
  nam: 'Năm',
  dien_cu: 'Số điện cũ',
  dien_moi: 'Số điện mới',
  don_gia_dien: 'Đơn giá điện',
  nuoc_cu: 'Số nước cũ',
  nuoc_moi: 'Số nước mới',
  don_gia_nuoc: 'Đơn giá nước',
  chu_tro: 'Chủ trọ',
  sdt_chu_tro: 'SĐT chủ trọ',
  so_phong: 'Số phòng',
  // Users / auth
  ten_dang_nhap: 'Tên đăng nhập',
  mat_khau: 'Mật khẩu',
  mat_khau_cu: 'Mật khẩu hiện tại',
  mat_khau_moi: 'Mật khẩu mới',
  nhap_lai_mat_khau: 'Mật khẩu nhập lại',
  vai_tro: 'Vai trò',
  hinh_thuc_thanh_toan: 'Hình thức thanh toán',
  ma_vender: 'Mã vender',
  cong_ty_ids: 'Danh sách công ty',
  // Chấm công
  phan_cong_id: 'Phân công',
  entries: 'Danh sách chấm công',
  so_gio: 'Số giờ',
  so_gio_ot: 'Số giờ OT',
  ca_lam: 'Ca làm',
  // Todo / đề xuất
  tieu_de: 'Tiêu đề',
  noi_dung: 'Nội dung',
  category_id: 'Loại đầu việc',
  assignee_id: 'Người nhận việc',
  han: 'Hạn',
  gio_lam: 'Giờ làm',
  icon: 'Icon',
  mau_sac: 'Màu sắc',
  thu_tu: 'Thứ tự',
};

// Error map tiếng Việt cho mọi loại lỗi Zod chưa có message riêng
function viErrorMap(issue, ctx) {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: 'Trường này là bắt buộc' };
      }
      if (issue.expected === 'number' || issue.expected === 'integer') {
        return { message: 'Vui lòng nhập số hợp lệ' };
      }
      if (issue.expected === 'string') return { message: 'Vui lòng nhập chuỗi ký tự' };
      if (issue.expected === 'boolean') return { message: 'Giá trị phải là đúng/sai' };
      if (issue.expected === 'array') return { message: 'Dữ liệu phải là danh sách' };
      return { message: 'Kiểu dữ liệu không hợp lệ' };

    case ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return {
          message: Number(issue.minimum) <= 1
            ? 'Không được để trống'
            : `Tối thiểu ${issue.minimum} ký tự`,
        };
      }
      if (issue.type === 'number') {
        if (Number(issue.minimum) === 0) {
          return { message: issue.inclusive ? 'Giá trị không được âm' : 'Giá trị phải lớn hơn 0' };
        }
        return { message: `Giá trị phải ${issue.inclusive ? 'từ' : 'lớn hơn'} ${issue.minimum}` };
      }
      if (issue.type === 'array') return { message: `Cần chọn ít nhất ${issue.minimum} mục` };
      return { message: 'Giá trị quá nhỏ' };

    case ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `Tối đa ${issue.maximum} ký tự` };
      if (issue.type === 'number') return { message: `Giá trị tối đa là ${issue.maximum}` };
      if (issue.type === 'array') return { message: `Chỉ được chọn tối đa ${issue.maximum} mục` };
      return { message: 'Giá trị quá lớn' };

    case ZodIssueCode.invalid_enum_value:
      return { message: 'Giá trị không nằm trong danh sách cho phép' };

    case ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'Email không hợp lệ' };
      if (issue.validation === 'url') return { message: 'Đường dẫn (URL) không hợp lệ' };
      if (issue.validation === 'date') return { message: 'Ngày không hợp lệ (định dạng YYYY-MM-DD)' };
      return { message: 'Định dạng không hợp lệ' };

    case ZodIssueCode.invalid_date:
      return { message: 'Ngày không hợp lệ' };

    case ZodIssueCode.unrecognized_keys:
      return { message: 'Dữ liệu chứa trường không được hỗ trợ' };

    case ZodIssueCode.invalid_union:
      return { message: 'Dữ liệu không hợp lệ' };

    default:
      // Không trả ctx.defaultError vì message mặc định của Zod là tiếng Anh
      return { message: 'Dữ liệu không hợp lệ' };
  }
}

// Kích hoạt ngay khi module được require — áp dụng cho toàn bộ schema trong app
z.setErrorMap(viErrorMap);

/**
 * Ghép nhãn field tiếng Việt vào message nếu message chưa nhắc tới field đó.
 * path: mảng path của ZodIssue (có thể chứa index mảng, vd ['entries', 0, 'ngay'])
 */
function ghepNhanField(path, message) {
  const last = [...path].reverse().find((p) => typeof p === 'string');
  const label = last ? FIELD_LABELS[last] : null;
  if (!label) return message;
  return message.toLowerCase().includes(label.toLowerCase())
    ? message
    : `${label}: ${message}`;
}

module.exports = { FIELD_LABELS, viErrorMap, ghepNhanField };
