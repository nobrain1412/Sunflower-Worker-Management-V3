const { createWorker } = require('tesseract.js');
const logger = require('../utils/logger');

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
    que_quan: '', dia_chi: '', ngay_cap: '', noi_cap: '',
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

    if (/qu[eê]\s*qu[áa]n|place\s+of\s+origin/i.test(lo)) {
      const val = nxt.replace(/[:\/]/g, '').trim();
      if (val && !/nơi|place\s+of\s+res/i.test(val)) result.que_quan = val;
    }

    if (/n[oơ]i\s+th[uư][oờ]ng\s+tr[uú]|place\s+of\s+res/i.test(lo)) {
      const parts = [nxt, nxt2].filter((l) => l && !/c[oó]\s+gi[áa]\s+tr[ịi]|date\s+of\s+exp/i.test(l));
      result.dia_chi = parts.join(', ').replace(/[:\/]/g, '').trim();
    }

    if (/ng[àa]y.*c[aấ]p|date\s+of\s+issue/i.test(lo)) {
      const m = (lines[i] + ' ' + nxt).match(/\d{2}[\/\-.]\d{2}[\/\-.]\d{4}/);
      if (m) result.ngay_cap = m[0].replace(/[\-.]/g, '/');
    }

    if (/n[oơ]i\s+c[aấ]p|place\s+of\s+issue/i.test(lo)) {
      result.noi_cap = nxt.replace(/[:\/]/g, '').trim();
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

    const person = { ho_ten: '', cccd: '', ngay_sinh: '', gioi_tinh: '', que_quan: '' };

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
    if (parts[1]) person.que_quan = parts[1];

    if (person.ho_ten || person.cccd) people.push(person);
  }

  return people;
}

// ─── Public API ──────────────────────────────────────────────────────────────

async function scanCCCD(imageBuffer) {
  const data = await recognize(imageBuffer);
  return parseCCCD(data.text ?? '');
}

async function scanDanhSach(imageBuffer) {
  const data = await recognize(imageBuffer);
  const lines = (data.lines ?? []).map((l) => l.text.trim()).filter(Boolean);
  return parseDanhSach(lines);
}

module.exports = { scanCCCD, scanDanhSach };
