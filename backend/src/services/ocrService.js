const { createWorker } = require('tesseract.js');
const logger = require('../utils/logger');
const { recognizeCCCDViaVLM } = require('./ocrCccdVlm');

// ─── Tesseract (fallback khi VLM lỗi hoặc chưa cấu hình key) ──────────────────
// Nhận Buffer trực tiếp — không cần đọc từ disk.
async function recognize(imageBuffer) {
  const worker = await createWorker(['vie', 'eng'], 1, { logger: () => {} });
  try {
    const { data } = await worker.recognize(imageBuffer);
    // Không log nội dung text (chứa CCCD/tên nhạy cảm) — chỉ log số liệu.
    logger.info({ textLength: data.text?.length ?? 0, confidence: data.confidence }, 'Tesseract OCR done');
    return data;
  } finally {
    await worker.terminate();
  }
}

// ─── CCCD parser cho Tesseract ───────────────────────────────────────────────

function parseCCCD(fullText) {
  const lines = fullText.split('\n').map((l) => l.trim()).filter(Boolean);

  const result = {
    ho_ten: '', cccd: '', ngay_sinh: '', gioi_tinh: '',
    que_quan: '', dia_chi: '', ngay_cap: '',
  };

  const cccdMatch = fullText.match(/\b(\d{12})\b/);
  if (cccdMatch) result.cccd = cccdMatch[1];

  const allDates = (fullText.match(/\d{2}[\/\-.]\d{2}[\/\-.]\d{4}/g) ?? [])
    .map((d) => d.replace(/[\-.]/g, '/'));

  for (let i = 0; i < lines.length; i++) {
    const lo   = lines[i].toLowerCase();
    const nxt  = lines[i + 1] ?? '';
    const nxt2 = lines[i + 2] ?? '';

    if (/h[oọ]\s*(v[aà]\s*)?t[eêế]n|full\s*name/i.test(lo)) {
      const cand = nxt.replace(/[:\/]/g, '').trim();
      if (cand && !/ngày|giới|quê|nơi|date|sex|place|\d{2}\//i.test(cand))
        result.ho_ten = cand.toUpperCase();
    }

    if (/ng[àa]y\s+sinh|date\s+of\s+birth/i.test(lo)) {
      const m = (lines[i] + ' ' + nxt).match(/\d{2}[\/\-.]\d{2}[\/\-.]\d{4}/);
      if (m) result.ngay_sinh = m[0].replace(/[\-.]/g, '/');
    }

    if (/gi[ớo]i\s*t[íi]nh|sex\b/i.test(lo)) {
      const ctx = (lines[i] + ' ' + nxt).toLowerCase();
      if (/\bnam\b/.test(ctx)) result.gioi_tinh = 'Nam';
      else if (/\bn[ữu]\b/.test(ctx)) result.gioi_tinh = 'Nữ';
    }

    // Mẫu cũ: "Quê quán" · Mẫu mới: "Nơi đăng ký khai sinh"
    if (/qu[eê]\s*qu[áa]n|place\s+of\s+origin|n[oơ]i\s+đăng\s*k[ýy]\s+khai\s+sinh|place\s+of\s+birth/i.test(lo)) {
      const val = nxt.replace(/[:\/]/g, '').trim();
      if (val && !/nơi|place\s+of\s+res/i.test(val)) result.que_quan = val;
    }

    // Mẫu cũ: "Nơi thường trú" · Mẫu mới: "Nơi cư trú"
    if (/n[oơ]i\s+th[uư][oờ]ng\s+tr[uú]|n[oơ]i\s+c[uư]\s+tr[uú]|place\s+of\s+res/i.test(lo)) {
      const parts = [nxt, nxt2].filter((l) => l && !/c[oó]\s+gi[áa]\s+tr[ịi]|date\s+of\s+exp/i.test(l));
      result.dia_chi = parts.join(', ').replace(/[:\/]/g, '').trim();
    }

    if (/ng[àa]y.*c[aấ]p|date\s+of\s+issue/i.test(lo)) {
      const m = (lines[i] + ' ' + nxt).match(/\d{2}[\/\-.]\d{2}[\/\-.]\d{4}/);
      if (m) result.ngay_cap = m[0].replace(/[\-.]/g, '/');
    }
  }

  if (!result.ngay_sinh && allDates[0]) result.ngay_sinh = allDates[0];
  if (!result.ngay_cap && allDates.length > 1) result.ngay_cap = allDates[allDates.length - 1];

  return result;
}

// ─── Danh sách parser ────────────────────────────────────────────────────────

function parseDanhSach(textLines) {
  const people = [];

  for (const row of textLines) {
    if (row.trim().length < 3) continue;
    if (/h[oọ]\s*(v[aà]\s*)?t[eêế]n|stt|ng[àa]y\s+sinh|cccd|cmnd|qu[eê]\s*qu[áa]n|gi[ớo]i\s*t[íi]nh|^tt\b/i.test(row)) continue;

    const person = { ho_ten: '', cccd: '', ngay_sinh: '', gioi_tinh: '', dia_chi_hien_tai: '' };

    const dateM = row.match(/\d{2}[\/\-.]\d{2}[\/\-.]\d{4}/);
    if (dateM) person.ngay_sinh = dateM[0].replace(/[\-.]/g, '/');

    const idM = row.match(/\b(\d{12}|\d{9})\b/);
    if (idM) person.cccd = idM[1];

    if (/\bNam\b/i.test(row)) person.gioi_tinh = 'Nam';
    else if (/\bN[ữu]\b/i.test(row)) person.gioi_tinh = 'Nữ';

    let rest = row
      .replace(/\d{2}[\/\-.]\d{2}[\/\-.]\d{4}/g, '')
      .replace(/\b(\d{12}|\d{9})\b/g, '')
      .replace(/\bNam\b/gi, '')
      .replace(/\bN[ữu]\b/gi, '')
      .replace(/^\s*\d+[\.\)]\s*/, '')
      .trim();

    const parts = rest.split(/\t|\s{3,}/).map((p) => p.trim()).filter(Boolean);
    if (parts[0]) person.ho_ten = parts[0];
    if (parts[1]) person.dia_chi_hien_tai = parts[1];

    if (person.ho_ten || person.cccd) people.push(person);
  }

  return people;
}

// ─── Chuẩn hóa & gộp kết quả CCCD ────────────────────────────────────────────

const CCCD_FIELDS = ['ho_ten', 'cccd', 'ngay_sinh', 'gioi_tinh', 'que_quan', 'dia_chi', 'ngay_cap'];

const isValidCccd = (s) => /^\d{12}$/.test(s);

// Loại dữ liệu rác trước khi dùng: số CCCD phải đúng 12 chữ số (chặn chuỗi MRZ),
// họ tên chứa "<" hoặc chữ số là đọc nhầm từ MRZ → bỏ; ngày chuẩn hóa về DD/MM/YYYY.
function sanitizeCccdResult(r) {
  if (!r) return r;
  const out = { ...r };

  const cccd = String(out.cccd ?? '').replace(/\s+/g, '');
  out.cccd = isValidCccd(cccd) ? cccd : '';

  const name = String(out.ho_ten ?? '').trim();
  out.ho_ten = /[<\d]/.test(name) ? '' : name;

  for (const f of ['ngay_sinh', 'ngay_cap']) {
    const m = String(out[f] ?? '').match(/\d{2}[\/\-.]\d{2}[\/\-.]\d{4}/);
    out[f] = m ? m[0].replace(/[\-.]/g, '/') : '';
  }
  return out;
}

// Gộp kết quả nhiều mặt CCCD. Mặt có CCCD 12 số hợp lệ (mặt định danh) được ưu tiên
// cho mọi trường; các trường mặt đó bỏ trống (vd địa chỉ ở mặt sau mẫu mới) sẽ lấy từ mặt kia.
function mergeCccdSides(results) {
  const valid = results.filter(Boolean).map(sanitizeCccdResult);
  if (valid.length === 0) return null;

  const ordered = [...valid].sort(
    (a, b) => (isValidCccd(b.cccd) ? 1 : 0) - (isValidCccd(a.cccd) ? 1 : 0),
  );

  const out = { _provider: ordered[0]?._provider ?? '', _type: '' };
  for (const f of CCCD_FIELDS) {
    out[f] = '';
    for (const r of ordered) {
      if (typeof r[f] === 'string' && r[f].trim()) { out[f] = r[f].trim(); break; }
    }
  }
  out._type = ordered.map((r) => r._type).filter(Boolean).join('+');
  if (ordered.some((r) => r._degraded)) out._degraded = true;
  return out;
}

// ─── Public API ──────────────────────────────────────────────────────────────

// Quét 1 mặt CCCD. Ưu tiên VLM (FPT AI Inference); lỗi/không có key → fallback Tesseract.
// Kết quả luôn kèm `_provider` ('fpt_vlm' | 'tesseract') và `_degraded` khi chạy engine dự phòng,
// để tầng trên hiển thị cảnh báo thay vì "kém âm thầm".
async function scanCCCD(imageBuffer) {
  const apiKey = process.env.FPT_AI_API_KEY;
  if (apiKey) {
    try {
      return sanitizeCccdResult(await recognizeCCCDViaVLM(imageBuffer, apiKey));
    } catch (err) {
      logger.warn({ err: err.message }, 'FPT AI Inference lỗi — fallback Tesseract (độ chính xác thấp)');
    }
  } else {
    logger.warn('Chưa cấu hình FPT_AI_API_KEY — dùng Tesseract (độ chính xác thấp)');
  }

  const data = await recognize(imageBuffer);
  const r = sanitizeCccdResult({ ...parseCCCD(data.text ?? ''), _provider: 'tesseract', _type: '' });
  r._degraded = true;
  return r;
}

// Quét đủ 2 mặt CCCD rồi gộp. Mỗi mặt quét độc lập: một mặt lỗi vẫn dùng được mặt kia.
async function scanCCCDSides(imageBuffers) {
  const buffers = (imageBuffers || []).filter(Boolean);
  if (buffers.length <= 1) return scanCCCD(buffers[0]);

  const settled = await Promise.allSettled(buffers.map((b) => scanCCCD(b)));
  const ok = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
  if (ok.length === 0) {
    const firstErr = settled.find((s) => s.status === 'rejected');
    throw firstErr?.reason ?? new Error('Không nhận diện được CCCD từ ảnh đã tải lên');
  }
  return mergeCccdSides(ok);
}

async function scanDanhSach(imageBuffer) {
  const data = await recognize(imageBuffer);
  const lines = (data.lines ?? []).map((l) => l.text.trim()).filter(Boolean);
  return parseDanhSach(lines);
}

module.exports = { scanCCCD, scanCCCDSides, scanDanhSach };
// Export thêm các hàm thuần để viết test (không dùng trong controller).
module.exports._internal = { sanitizeCccdResult, mergeCccdSides };
