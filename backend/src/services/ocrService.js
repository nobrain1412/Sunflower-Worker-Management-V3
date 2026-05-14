const vision = require('@google-cloud/vision');

// ─── Client ──────────────────────────────────────────────────────────────────

function getClient() {
  // Hỗ trợ 2 cách cấu hình:
  // 1. GOOGLE_APPLICATION_CREDENTIALS = đường dẫn tới file JSON key
  // 2. GOOGLE_CLOUD_KEY_JSON = nội dung JSON (dùng trên Railway/cloud)
  if (process.env.GOOGLE_CLOUD_KEY_JSON) {
    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_CLOUD_KEY_JSON);
    } catch (e) {
      throw Object.assign(
        new Error(`GOOGLE_CLOUD_KEY_JSON không phải JSON hợp lệ: ${e.message}`),
        { statusCode: 503 },
      );
    }
    // Railway đôi khi chuyển \n thành ký tự newline thật trong private_key
    // Cần đảm bảo private_key có đúng ký tự newline (không phải chuỗi \n)
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    return new vision.ImageAnnotatorClient({ credentials });
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new vision.ImageAnnotatorClient();
  }
  throw Object.assign(
    new Error('Google Cloud credentials chưa được cấu hình (GOOGLE_APPLICATION_CREDENTIALS hoặc GOOGLE_CLOUD_KEY_JSON)'),
    { statusCode: 503 },
  );
}

// ─── CCCD parser ─────────────────────────────────────────────────────────────
// CCCD chip Việt Nam có bố cục cố định — parse theo nhãn field

function parseCCCD(fullText) {
  const lines = fullText.split('\n').map((l) => l.trim()).filter(Boolean);

  const result = {
    ho_ten: '', cccd: '', ngay_sinh: '', gioi_tinh: '',
    que_quan: '', dia_chi: '', ngay_cap: '', noi_cap: '',
  };

  // Số CCCD: 12 chữ số liên tiếp
  const cccdMatch = fullText.match(/\b(\d{12})\b/);
  if (cccdMatch) result.cccd = cccdMatch[1];

  // Tất cả ngày DD/MM/YYYY trong ảnh
  const allDates = (fullText.match(/\d{2}[\/\-.]\d{2}[\/\-.]\d{4}/g) ?? [])
    .map((d) => d.replace(/[\-.]/g, '/'));

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lo  = raw.toLowerCase();
    const nxt = lines[i + 1] ?? '';
    const nxt2 = lines[i + 2] ?? '';

    // Họ và tên
    if (/h[oọ]\s*(v[aà]\s*)?t[eêế]n|full\s*name/i.test(lo)) {
      const cand = nxt.replace(/[:\/]/g, '').trim();
      if (cand && !/ngày|giới|quê|nơi|date|sex|place|\d{2}\//i.test(cand)) {
        result.ho_ten = cand.toUpperCase();
      }
    }

    // Ngày sinh
    if (/ng[àa]y\s+sinh|date\s+of\s+birth/i.test(lo)) {
      const m = (raw + ' ' + nxt).match(/\d{2}[\/\-.]\d{2}[\/\-.]\d{4}/);
      if (m) result.ngay_sinh = m[0].replace(/[\-.]/g, '/');
    }

    // Giới tính
    if (/gi[ớo]i\s*t[íi]nh|sex\b/i.test(lo)) {
      const ctx = (raw + ' ' + nxt).toLowerCase();
      if (/\bnam\b/.test(ctx)) result.gioi_tinh = 'Nam';
      else if (/\bn[ữu]\b/.test(ctx)) result.gioi_tinh = 'Nữ';
    }

    // Quê quán
    if (/qu[eê]\s*qu[áa]n|place\s+of\s+origin/i.test(lo)) {
      const val = nxt.replace(/[:\/]/g, '').trim();
      if (val && !/nơi|place\s+of\s+res/i.test(val)) result.que_quan = val;
    }

    // Nơi thường trú (có thể 2 dòng)
    if (/n[oơ]i\s+th[uư][oờ]ng\s+tr[uú]|place\s+of\s+res/i.test(lo)) {
      const parts = [nxt, nxt2].filter((l) => l && !/c[oó]\s+gi[áa]\s+tr[ịi]|date\s+of\s+exp/i.test(l));
      result.dia_chi = parts.join(', ').replace(/[:\/]/g, '').trim();
    }

    // Ngày cấp (mặt sau)
    if (/ng[àa]y.*c[aấ]p|date\s+of\s+issue/i.test(lo)) {
      const m = (raw + ' ' + nxt).match(/\d{2}[\/\-.]\d{2}[\/\-.]\d{4}/);
      if (m) result.ngay_cap = m[0].replace(/[\-.]/g, '/');
    }

    // Nơi cấp (mặt sau)
    if (/n[oơ]i\s+c[aấ]p|place\s+of\s+issue/i.test(lo)) {
      result.noi_cap = nxt.replace(/[:\/]/g, '').trim();
    }
  }

  // Fallback: dùng các ngày tìm thấy nếu chưa parse được
  if (!result.ngay_sinh && allDates[0]) result.ngay_sinh = allDates[0];
  if (!result.ngay_cap && allDates.length > 1) result.ngay_cap = allDates[allDates.length - 1];

  return result;
}

// ─── Danh sách parser ────────────────────────────────────────────────────────
// Dùng bounding box của Google Vision để tái dựng từng dòng bảng
// Chính xác hơn dùng \n vì chữ viết tay không thẳng hàng hoàn toàn

function reconstructRows(fullTextAnnotation) {
  // Thu thập tất cả words cùng toạ độ Y trung tâm
  const words = [];
  for (const page of fullTextAnnotation.pages ?? []) {
    for (const block of page.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        for (const word of para.words ?? []) {
          const text = word.symbols.map((s) => s.text).join('');
          // Vision API trả về pixel vertices, không phải normalized
          const verts = word.boundingBox?.vertices ?? word.boundingBox?.normalizedVertices ?? [];
          if (!verts.length) continue;
          const y = ((verts[0].y ?? 0) + (verts[2].y ?? 0)) / 2;
          const x = ((verts[0].x ?? 0) + (verts[2].x ?? 0)) / 2;
          words.push({ text, x, y });
        }
      }
    }
  }
  if (!words.length) return [];

  words.sort((a, b) => a.y - b.y);

  // Tính ngưỡng tự động: normalized (0-1) dùng 0.02, pixel dùng 15px
  const maxY = Math.max(...words.map((w) => w.y));
  const threshold = maxY <= 1 ? 0.02 : 15;

  const rows = [];
  let current = [words[0]];
  for (let i = 1; i < words.length; i++) {
    if (Math.abs(words[i].y - current[0].y) < threshold) {
      current.push(words[i]);
    } else {
      rows.push(current);
      current = [words[i]];
    }
  }
  rows.push(current);

  // Sắp xếp theo X và nối thành chuỗi
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    return row.map((w) => w.text).join(' ');
  });
}

function parseDanhSach(textRows) {
  const people = [];

  for (const row of textRows) {
    if (row.trim().length < 3) continue;
    // Bỏ qua dòng tiêu đề bảng
    if (/h[oọ]\s*(v[aà]\s*)?t[eêế]n|stt|ng[àa]y\s+sinh|cccd|cmnd|qu[eê]\s*qu[áa]n|gi[ớo]i\s*t[íi]nh|^tt\b/i.test(row)) continue;

    const person = { ho_ten: '', cccd: '', ngay_sinh: '', gioi_tinh: '', que_quan: '' };

    // Ngày sinh
    const dateM = row.match(/\d{2}[\/\-.]\d{2}[\/\-.]\d{4}/);
    if (dateM) person.ngay_sinh = dateM[0].replace(/[\-.]/g, '/');

    // CCCD / CMND
    const idM = row.match(/\b(\d{12}|\d{9})\b/);
    if (idM) person.cccd = idM[1];

    // Giới tính
    if (/\bNam\b/i.test(row)) person.gioi_tinh = 'Nam';
    else if (/\bN[ữu]\b/i.test(row)) person.gioi_tinh = 'Nữ';

    // Bóc các phần đã nhận diện, phần còn lại → tên + quê quán
    let rest = row
      .replace(/\d{2}[\/\-.]\d{2}[\/\-.]\d{4}/g, '')
      .replace(/\b(\d{12}|\d{9})\b/g, '')
      .replace(/\bNam\b/gi, '')
      .replace(/\bN[ữu]\b/gi, '')
      .replace(/^\s*\d+[\.\)]\s*/, '') // bỏ số thứ tự đầu dòng
      .trim();

    // Tách theo khoảng trống lớn hoặc tab
    const parts = rest.split(/\t|\s{3,}/).map((p) => p.trim()).filter(Boolean);
    if (parts[0]) person.ho_ten = parts[0];
    if (parts[1]) person.que_quan = parts[1];

    if (person.ho_ten || person.cccd) people.push(person);
  }

  return people;
}

// ─── Public API ──────────────────────────────────────────────────────────────

async function scanCCCD(filePath) {
  const client = getClient();
  const [result] = await client.documentTextDetection(filePath);

  if (result.error) {
    throw Object.assign(new Error(result.error.message ?? 'Google Vision lỗi'), { statusCode: 502 });
  }

  const fullText = result.fullTextAnnotation?.text ?? '';
  if (!fullText.trim()) {
    throw Object.assign(new Error('Không đọc được văn bản từ ảnh, thử ảnh khác'), { statusCode: 422 });
  }

  return parseCCCD(fullText);
}

async function scanDanhSach(filePath) {
  const client = getClient();
  const [result] = await client.documentTextDetection(filePath);

  if (result.error) {
    throw Object.assign(new Error(result.error.message ?? 'Google Vision lỗi'), { statusCode: 502 });
  }

  const annotation = result.fullTextAnnotation;
  if (!annotation) {
    throw Object.assign(new Error('Không đọc được văn bản từ ảnh, thử ảnh khác'), { statusCode: 422 });
  }

  const rows = reconstructRows(annotation);
  return parseDanhSach(rows);
}

module.exports = { scanCCCD, scanDanhSach };
