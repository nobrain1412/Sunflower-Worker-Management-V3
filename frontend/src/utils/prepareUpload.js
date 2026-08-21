// Chuẩn hóa ảnh trước khi gửi OCR/upload:
//  1) HEIC/HEIF từ iPhone → JPEG (Safari giải mã được HEIC nên vẽ ra canvas rồi
//     xuất JPEG là chuyển đổi được ngay trên máy, backend không cần đọc HEIC).
//  2) Giảm cạnh dài về MAX_SIDE → ảnh gốc iPhone ~4000px/4-8MB rất nặng khiến VLM
//     xử lý chậm và dễ timeout; thu nhỏ giúp quét nhanh và ổn định hơn nhiều.
//
// Không dùng được canvas (định dạng lạ, lỗi decode) → trả lại file gốc để backend
// tự xử lý, không chặn luồng.

const MAX_SIDE = 1600;   // đủ nét cho VLM đọc chữ CCCD, mà vẫn nhẹ
const QUALITY  = 0.85;

// Load file thành drawable, ưu tiên createImageBitmap (tôn trọng xoay EXIF).
async function loadDrawable(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { drawable: bmp, cleanup: () => bmp.close?.() };
    } catch { /* rơi xuống <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    });
    return { drawable: img, cleanup: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Chuyển 1 ảnh về JPEG đã giảm cỡ, phục vụ upload/OCR.
 * @param {File|Blob} file
 * @returns {Promise<File>} luôn trả về 1 File (JPEG nếu chuyển được, ngược lại là file gốc)
 */
export async function toUploadJpeg(file) {
  if (!file) return file;
  let loaded;
  try {
    loaded = await loadDrawable(file);
    const d = loaded.drawable;
    const bw = d.naturalWidth || d.width;
    const bh = d.naturalHeight || d.height;
    if (!bw || !bh) return file;

    const scale = Math.min(1, MAX_SIDE / Math.max(bw, bh));
    const w = Math.max(1, Math.round(bw * scale));
    const h = Math.max(1, Math.round(bh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(d, 0, 0, w, h);

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', QUALITY));
    if (!blob) return file;

    const baseName = (file.name || 'anh').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file; // không chuyển được → dùng ảnh gốc
  } finally {
    loaded?.cleanup?.();
  }
}
