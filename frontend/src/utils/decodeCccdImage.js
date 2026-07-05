import QrScanner from 'qr-scanner';
import { parseCccdQr } from './parseCccdQr';

// Giải mã QR CCCD từ ảnh tải lên — nhiều lượt tiền xử lý để tăng độ chính xác.
// Ảnh chụp thật thường có QR nhỏ / mờ / loá / nhiễu hạt / xoay theo EXIF nên
// decode 1 phát (QrScanner.scanImage mặc định) hay trượt. Ở đây thử lần lượt,
// dừng ngay khi đọc được, và có lượt cắt ô để bắt QR nhỏ trong ảnh lớn.
//
// Ghi chú kỹ thuật:
// - Xoay trong mặt phẳng: decoder (ZBar/BarcodeDetector) tự bất biến với góc xoay
//   nhờ 3 ô định vị, nên không cần deskew. EXIF chỉ để dựng lại chiều đúng của ảnh.
// - Méo phối cảnh nặng (chụp xiên) không được nắn — hiếm gặp nếu chụp tương đối thẳng.
//
// Trả về:
//   { parsed }   đọc & tách được QR CCCD hợp lệ
//   { rawText }  đọc được QR nhưng không phải CCCD
//   null         không tìm thấy QR nào

// ─── Load & vẽ ảnh ───────────────────────────────────────────────────────────

// Load file → drawable (ImageBitmap ưu tiên vì tôn trọng xoay EXIF). Kèm cleanup.
async function loadDrawable(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { drawable: bmp, cleanup: () => bmp.close?.() };
    } catch {
      try {
        const bmp = await createImageBitmap(file);
        return { drawable: bmp, cleanup: () => bmp.close?.() };
      } catch { /* rơi xuống <img> */ }
    }
  }
  const url = URL.createObjectURL(file);
  const img = await new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = url;
  });
  return { drawable: img, cleanup: () => URL.revokeObjectURL(url) };
}

function drawableSize(d) {
  return { w: d.naturalWidth || d.width, h: d.naturalHeight || d.height };
}

function newCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

// Vẽ toàn ảnh ra canvas, scale sao cho cạnh dài = targetMaxSide (cho phép phóng to).
function makeCanvas(drawable, targetMaxSide, fn) {
  const { w: bw, h: bh } = drawableSize(drawable);
  const maxSide = Math.max(bw, bh) || 1;
  const scale = targetMaxSide ? targetMaxSide / maxSide : 1;
  const w = Math.round(bw * scale);
  const h = Math.round(bh * scale);
  const { canvas, ctx } = newCanvas(w, h);
  ctx.drawImage(drawable, 0, 0, canvas.width, canvas.height);
  if (fn) fn(ctx, canvas.width, canvas.height);
  return canvas;
}

// Cắt 1 vùng (region) rồi phóng to cạnh dài = outMax — bắt QR nhỏ trong ảnh lớn.
function cropCanvas(drawable, region, outMax, fn) {
  const scale = outMax / Math.max(region.w, region.h);
  const w = Math.round(region.w * scale);
  const h = Math.round(region.h * scale);
  const { canvas, ctx } = newCanvas(w, h);
  ctx.drawImage(drawable, region.x, region.y, region.w, region.h, 0, 0, canvas.width, canvas.height);
  if (fn) fn(ctx, canvas.width, canvas.height);
  return canvas;
}

// Lưới 3×3 ô chồng lấn ~50% — mỗi ô ~ nửa ảnh, phủ hết vị trí QR có thể nằm.
function tileRegions(w, h) {
  const cols = 3, rows = 3;
  const tw = Math.round(w / 2), th = Math.round(h / 2);
  const stepX = (w - tw) / (cols - 1);
  const stepY = (h - th) / (rows - 1);
  const regions = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      regions.push({ x: Math.round(c * stepX), y: Math.round(r * stepY), w: tw, h: th });
    }
  }
  return regions;
}

// ─── Bộ lọc pixel (technical) ────────────────────────────────────────────────

function toGray(data) {
  const gray = new Uint8ClampedArray(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
  }
  return gray;
}

function writeGrayBinary(ctx, w, h, values) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    d[i] = d[i + 1] = d[i + 2] = values[j];
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function otsuThreshold(gray) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, max = 0, threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) { max = between; threshold = t; }
  }
  return threshold;
}

// Làm mượt 3×3 (box blur) trên grayscale — khử nhiễu hạt trước khi nhị phân hoá.
function boxBlur3(gray, w, h) {
  const out = new Uint8ClampedArray(gray.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          s += gray[yy * w + xx];
          c++;
        }
      }
      out[y * w + x] = (s / c) | 0;
    }
  }
  return out;
}

// Nhị phân hoá Otsu (ngưỡng toàn cục) — QR đen/trắng sắc nét.
function otsuBinarize(ctx, w, h) {
  const gray = toGray(ctx.getImageData(0, 0, w, h).data);
  const th = otsuThreshold(gray);
  const out = new Uint8ClampedArray(gray.length);
  for (let j = 0; j < gray.length; j++) out[j] = gray[j] > th ? 255 : 0;
  writeGrayBinary(ctx, w, h, out);
}

// Khử nhiễu hạt (box blur) rồi Otsu — cho ảnh nhiễu ISO cao / nén mạnh.
function denoiseBinarize(ctx, w, h) {
  const gray = boxBlur3(toGray(ctx.getImageData(0, 0, w, h).data), w, h);
  const th = otsuThreshold(gray);
  const out = new Uint8ClampedArray(gray.length);
  for (let j = 0; j < gray.length; j++) out[j] = gray[j] > th ? 255 : 0;
  writeGrayBinary(ctx, w, h, out);
}

// Ngưỡng thích nghi cục bộ (mean qua ảnh tích phân) — chịu được loá / sáng lệch.
function adaptiveThreshold(ctx, w, h) {
  const gray = toGray(ctx.getImageData(0, 0, w, h).data);
  const iw = w + 1;
  const integ = new Float64Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      integ[(y + 1) * iw + (x + 1)] =
        gray[y * w + x] + integ[y * iw + (x + 1)] + integ[(y + 1) * iw + x] - integ[y * iw + x];
    }
  }
  const rad = Math.max(7, Math.floor(Math.min(w, h) / 16));
  const C = 7; // bù ngưỡng: pixel phải sáng hơn nền cục bộ mới coi là trắng
  const out = new Uint8ClampedArray(gray.length);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - rad), y1 = Math.min(h - 1, y + rad);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - rad), x1 = Math.min(w - 1, x + rad);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = integ[(y1 + 1) * iw + (x1 + 1)] - integ[y0 * iw + (x1 + 1)]
                - integ[(y1 + 1) * iw + x0] + integ[y0 * iw + x0];
      out[y * w + x] = gray[y * w + x] > sum / count - C ? 255 : 0;
    }
  }
  writeGrayBinary(ctx, w, h, out);
}

// Kéo giãn tương phản theo phân vị 2%–98% — giữ gradient khi Otsu quá gắt.
function contrastStretch(ctx, w, h) {
  const gray = toGray(ctx.getImageData(0, 0, w, h).data);
  const hist = new Array(256).fill(0);
  for (let j = 0; j < gray.length; j++) hist[gray[j]]++;
  const total = gray.length;
  let acc = 0, lo = 0, hi = 255;
  for (let t = 0; t < 256; t++) { acc += hist[t]; if (acc >= total * 0.02) { lo = t; break; } }
  acc = 0;
  for (let t = 255; t >= 0; t--) { acc += hist[t]; if (acc >= total * 0.02) { hi = t; break; } }
  const range = Math.max(1, hi - lo);
  const out = new Uint8ClampedArray(gray.length);
  for (let j = 0; j < gray.length; j++) {
    let v = ((gray[j] - lo) / range) * 255;
    out[j] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  writeGrayBinary(ctx, w, h, out);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function decodeCccdQrFromImage(file) {
  const engine = await QrScanner.createQrEngine().catch(() => undefined);
  let lastRaw = null;

  // Thử decode 1 nguồn (file/canvas/bitmap) → parse; trả object CCCD hoặc null.
  const attempt = async (source) => {
    try {
      const r = await QrScanner.scanImage(source, { qrEngine: engine, returnDetailedScanResult: true });
      const raw = r?.data ?? r;
      if (raw) {
        lastRaw = raw;
        const parsed = parseCccdQr(raw);
        if (parsed) return parsed;
      }
    } catch { /* nguồn này không đọc được — thử nguồn khác */ }
    return null;
  };

  let cleanup = () => {};
  try {
    // P1 — ảnh gốc (đường <img>, tôn trọng EXIF, engine native nếu có).
    let p = await attempt(file);
    if (p) return { parsed: p };

    const loaded = await loadDrawable(file);
    cleanup = loaded.cleanup;
    const d = loaded.drawable;
    const { w: bw, h: bh } = drawableSize(d);
    const maxSide = Math.max(bw, bh) || 0;
    const mainSide = Math.min(maxSide || 2200, 2200);

    // Lượt xử lý toàn ảnh (dừng ở lượt đầu ra kết quả).
    const passes = [
      () => makeCanvas(d, mainSide, contrastStretch),
      () => makeCanvas(d, mainSide, otsuBinarize),
      () => makeCanvas(d, mainSide, adaptiveThreshold), // loá / sáng lệch
      () => makeCanvas(d, mainSide, denoiseBinarize),   // nhiễu hạt
    ];
    if (maxSide && maxSide < 1600) passes.push(() => makeCanvas(d, maxSide * 2, otsuBinarize));
    if (maxSide > 2600) passes.push(() => makeCanvas(d, 1100, denoiseBinarize));

    for (const make of passes) {
      p = await attempt(make());
      if (p) return { parsed: p };
    }

    // QR nhỏ trong ảnh lớn — cắt lưới ô chồng lấn rồi phóng to từng ô.
    if (maxSide >= 1400) {
      for (const region of tileRegions(bw, bh)) {
        p = await attempt(cropCanvas(d, region, 1000, otsuBinarize));
        if (p) return { parsed: p };
      }
    }

    return lastRaw ? { rawText: lastRaw } : null;
  } finally {
    cleanup();
    if (engine && typeof engine.terminate === 'function') {
      try { engine.terminate(); } catch { /* bỏ qua */ }
    }
  }
}
