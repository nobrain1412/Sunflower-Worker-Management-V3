// Nhận diện ảnh CCCD bằng OCR phía backend (FPT.AI, fallback Tesseract).
// Dùng khi ảnh KHÔNG đọc được mã QR — CCCD cũ 9 số, thẻ mờ/xước, ảnh chụp thiếu góc QR.
// Backend đã upload ảnh lên Cloudinary trong cùng request → trả luôn URL để gắn vào hồ sơ.
import api from '../hooks/useApi';

// Các field OCR đổ thẳng vào form quét CCCD (bỏ qua _provider, _type...)
const FIELDS = ['ho_ten', 'cccd', 'ngay_sinh', 'gioi_tinh', 'que_quan', 'dia_chi', 'ngay_cap'];

/**
 * @param {File|Blob} file ảnh mặt trước CCCD
 * @returns {Promise<{ parsed: object|null, duongDanAnh: string|null, provider: string }>}
 *          parsed = null khi OCR chạy được nhưng không bóc được thông tin nào đáng kể
 */
export async function ocrCccdFromImage(file) {
  const fd = new FormData();
  fd.append('loai', 'cccd');
  fd.append('anh', file, file.name || 'cccd.jpg');

  const res = await api.post('/ocr/scan', fd, { headers: { 'Content-Type': undefined } });
  const ketQua = res?.data?.ket_qua ?? {};

  const parsed = {};
  for (const k of FIELDS) {
    const v = ketQua[k];
    if (typeof v === 'string' && v.trim()) parsed[k] = v.trim();
  }

  // Không có tên lẫn số CCCD → coi như nhận diện thất bại, không đổ vào form.
  const usable = parsed.ho_ten || parsed.cccd;

  return {
    parsed: usable ? parsed : null,
    duongDanAnh: res?.data?.duong_dan_anh ?? null,
    provider: ketQua._provider ?? '',
  };
}

/**
 * Nhận diện CCCD từ ĐỦ 2 MẶT — gửi cả mặt trước & sau, backend gộp lại cho dữ liệu
 * đầy đủ (mặt trước: định danh; mặt sau: ngày cấp). Trả URL đã upload của cả 2 ảnh.
 * @param {File|Blob} front ảnh mặt trước
 * @param {File|Blob} back  ảnh mặt sau
 */
export async function ocrCccdBothSides(front, back) {
  const fd = new FormData();
  fd.append('loai', 'cccd');
  fd.append('anh_truoc', front, front.name || 'cccd-truoc.jpg');
  fd.append('anh_sau', back, back.name || 'cccd-sau.jpg');

  const res = await api.post('/ocr/scan', fd, { headers: { 'Content-Type': undefined } });
  const ketQua = res?.data?.ket_qua ?? {};

  const parsed = {};
  for (const k of FIELDS) {
    const v = ketQua[k];
    if (typeof v === 'string' && v.trim()) parsed[k] = v.trim();
  }
  const usable = parsed.ho_ten || parsed.cccd;

  return {
    parsed: usable ? parsed : null,
    duongDanAnh:    res?.data?.duong_dan_anh ?? null,
    duongDanAnhSau: res?.data?.duong_dan_anh_sau ?? null,
    provider: ketQua._provider ?? '',
  };
}

/** Chụp khung hình hiện tại của <video> thành File JPEG để gửi đi OCR. */
export function captureVideoFrame(video) {
  return new Promise((resolve) => {
    const w = video?.videoWidth ?? 0;
    const h = video?.videoHeight ?? 0;
    if (!w || !h) return resolve(null);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => resolve(blob ? new File([blob], 'cccd-camera.jpg', { type: 'image/jpeg' }) : null),
      'image/jpeg',
      0.92,
    );
  });
}
