const { createWorker } = require('tesseract.js');
const logger = require('../utils/logger');

// ─── FPT.AI CCCD recognition ─────────────────────────────────────────────────
// Endpoint nhận diện CCCD/CMND VN, tự detect mặt trước/sau, trả JSON parsed sẵn.
// Doc: https://docs.fpt.ai/docs/api-recognition/cmnd-cccd
const FPT_AI_ENDPOINT = 'https://api.fpt.ai/vision/idr/vnm';

function mapFptSex(sex) {
  if (!sex) return '';
  const s = String(sex).toLowerCase();
  if (s.includes('nam')) return 'Nam';
  if (s.includes('n')) return 'Nữ';
  return '';
}

async function recognizeCCCDViaFPT(imageBuffer, apiKey) {
  const blob = new Blob([imageBuffer]);
  const fd = new FormData();
  fd.append('image', blob, 'cccd.jpg');

  const res = await fetch(FPT_AI_ENDPOINT, {
    method: 'POST',
    headers: { 'api-key': apiKey },
    body: fd,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`FPT.AI HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }

  const json = await res.json();
  if (json.errorCode !== 0 || !Array.isArray(json.data) || json.data.length === 0) {
    throw new Error(`FPT.AI ${json.errorCode}: ${json.errorMessage || 'Không nhận diện được CCCD'}`);
  }

  const d = json.data[0];
  logger.info({
    type: d.type_new || d.type,
    has_id: !!d.id, has_name: !!d.name, has_dob: !!d.dob,
    has_issue: !!d.issue_date,
  }, 'FPT.AI CCCD parsed');

  // Map sang schema cũ — giữ tương thích frontend OCR review.
  return {
    ho_ten:   d.name      ?? '',
    cccd:     d.id        ?? '',
    ngay_sinh:d.dob       ?? '',
    gioi_tinh:mapFptSex(d.sex),
    dia_chi:  d.address   ?? '',
    ngay_cap: d.issue_date ?? '',
    _provider: 'fpt_ai',
    _type:     d.type_new || d.type || '',
  };
}

// Nhận Buffer trực tiếp — không cần đọc từ disk
async function recognize(imageBuffer) {
  const worker = await createWorker(['vie', 'eng'], 1, {
    logger: () => {},
  });
  try {
    const { data } = await worker.recognize(imageBuffer);
    logger.info({
      textLength: data.text?.length ?? 0,
      rawText:    data.text?.slice(0, 500),
      confidence: data.confidence,
    }, 'OCR raw result');
    return data;
  } finally {
    await worker.terminate();
  }
}

// ─── CCCD parser ─────────────────────────────────────────────────────────────

function parseCCCD(fullText) {
  const lines = fullText.split('\n').map((l) => l.trim()).filter(Boolean);

  const result = {
    ho_ten: '', cccd: '', ngay_sinh: '', gioi_tinh: '',
    dia_chi: '', ngay_cap: '',
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

    if (/n[oơ]i\s+th[uư][oờ]ng\s+tr[uú]|place\s+of\s+res/i.test(lo)) {
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

// ─── Public API ──────────────────────────────────────────────────────────────

async function scanCCCD(imageBuffer) {
  const apiKey = process.env.FPT_AI_API_KEY;
  if (apiKey) {
    try {
      return await recognizeCCCDViaFPT(imageBuffer, apiKey);
    } catch (err) {
      // FPT.AI fail → log và fallback sang Tesseract để không vỡ luồng demo.
      logger.warn({ err: err.message }, 'FPT.AI CCCD failed, fallback to Tesseract');
    }
  }
  const data = await recognize(imageBuffer);
  return { ...parseCCCD(data.text ?? ''), _provider: 'tesseract' };
}

async function scanDanhSach(imageBuffer) {
  const data = await recognize(imageBuffer);
  const lines = (data.lines ?? []).map((l) => l.text.trim()).filter(Boolean);
  return parseDanhSach(lines);
}

module.exports = { scanCCCD, scanDanhSach };
