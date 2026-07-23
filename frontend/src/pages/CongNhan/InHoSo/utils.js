// Helper dùng chung cho bộ hồ sơ in (4 tờ A4).
// Mọi hàm đều chịu được giá trị null/rỗng vì hồ sơ công nhân thường thiếu field.

/** Parse chuỗi ngày từ API (ISO hoặc yyyy-mm-dd) → Date, trả null nếu không hợp lệ. */
export function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** dd/mm/yyyy — dùng cho ô một dòng. */
export function fmtDate(value) {
  const d = toDate(value);
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Tách ngày thành 3 mảnh để điền vào mẫu "......../......../........".
 * Thiếu ngày → trả dấu chấm lửng giữ nguyên chỗ trống cho người ký viết tay.
 */
export function tachNgay(value, chamThay = '……') {
  const d = toDate(value);
  if (!d) return { ngay: chamThay, thang: chamThay, nam: chamThay };
  return {
    ngay:  String(d.getDate()).padStart(2, '0'),
    thang: String(d.getMonth() + 1).padStart(2, '0'),
    nam:   String(d.getFullYear()),
  };
}

/**
 * Tuổi tròn tại một mốc thời gian.
 * Mốc mặc định là hôm nay; phiếu kiểm tra độ tuổi dùng mốc = ngày nhận việc.
 */
export function tinhTuoi(ngaySinh, moc = new Date()) {
  const ns = toDate(ngaySinh);
  const m  = toDate(moc) ?? new Date();
  if (!ns) return null;
  let tuoi = m.getFullYear() - ns.getFullYear();
  const chuaToiSinhNhat =
    m.getMonth() < ns.getMonth() ||
    (m.getMonth() === ns.getMonth() && m.getDate() < ns.getDate());
  if (chuaToiSinhNhat) tuoi -= 1;
  return tuoi;
}

/**
 * Mốc "thời điểm tuyển dụng": ưu tiên ngày vào làm, không có thì lấy ngày in.
 * Dùng chung cho tờ kiểm tra độ tuổi và điều kiện in tờ phiếu đồng ý.
 */
export function mocTuyenDung(cn) {
  return toDate(cn?.ngay_vao_lam) ?? new Date();
}

/** Chưa đủ 18 tại thời điểm tuyển dụng → cần phiếu đồng ý của người đại diện. */
export function chuaDu18(cn) {
  const tuoi = tinhTuoi(cn?.ngay_sinh, mocTuyenDung(cn));
  return tuoi != null && tuoi < 18;
}

/** Ảnh lưu ở Cloudinary (URL tuyệt đối); giữ nguyên đường dẫn tương đối nếu có. */
export function mediaUrl(path) {
  return path || '';
}

/**
 * Ảnh chân dung resize về cỡ ảnh thẻ 3x4 (tỉ lệ 3:4) trước khi gán vào hồ sơ in.
 * Dùng transform Cloudinary ngay trên URL: cắt đầy khung 3:4, ưu tiên khuôn mặt.
 * URL không phải Cloudinary → trả nguyên (khung CSS 3:4 vẫn giữ tỉ lệ khi in).
 */
export function anh3x4(path) {
  const u = mediaUrl(path);
  if (!u) return '';
  if (u.includes('/image/upload/')) {
    return u.replace('/image/upload/', '/image/upload/c_fill,ar_3:4,g_face,q_auto/');
  }
  return u;
}

/** Danh sách tờ sẽ in cho một công nhân — phiếu đồng ý chỉ áp dụng CN dưới 18. */
export function cacToCanIn(cn) {
  const to = ['ung_vien', 'do_tuoi'];
  if (chuaDu18(cn)) to.push('dong_y');
  to.push('anh_cccd');
  return to;
}
