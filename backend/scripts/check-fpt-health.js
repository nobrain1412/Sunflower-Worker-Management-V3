/**
 * Health-check dịch vụ nhận diện CCCD (FPT AI Inference).
 *
 * Chẩn đoán tình huống "còn tiền, status báo tốt nhưng quét CCCD vẫn fail".
 * Gọi thẳng endpoint FPT AI với đúng key/model đang cấu hình, in ra:
 *   - HTTP status + độ trễ
 *   - Body thô (rút gọn) để thấy lỗi thực (403 sai quyền model, JSON không hợp lệ...)
 *
 * Cách chạy (TRÊN SERVER có .env chứa FPT_AI_API_KEY):
 *   node scripts/check-fpt-health.js                 # ping text-only (rẻ, kiểm tra auth/model/balance)
 *   node scripts/check-fpt-health.js ./anh-cccd.jpg  # test thật với 1 ảnh CCCD
 *
 * KHÔNG in API key ra màn hình (chỉ hiện dạng đã che).
 */
require('dotenv').config();
const fs = require('fs');

const BASE_URL   = process.env.FPT_AI_BASE_URL || 'https://mkp-api.fptcloud.com/chat/completions';
const MODEL      = process.env.FPT_AI_MODEL    || 'Qwen2.5-VL-7B-Instruct';
const TIMEOUT_MS = Number(process.env.FPT_AI_TIMEOUT_MS) || 30000;
const API_KEY    = process.env.FPT_AI_API_KEY;

function mask(k) {
  if (!k) return '(trống)';
  if (k.length <= 8) return '****';
  return `${k.slice(0, 4)}...${k.slice(-4)} (dài ${k.length})`;
}

function detectMime(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf[0] === 0x52 && buf[1] === 0x49) return 'image/webp';
  if (buf.length > 11 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (/heic|heix|hevc|mif1|msf1/.test(brand)) return 'image/heic';
  }
  return 'image/jpeg';
}

async function main() {
  console.log('=== FPT AI Inference — Health Check ===');
  console.log('BASE_URL   :', BASE_URL);
  console.log('MODEL      :', MODEL);
  console.log('TIMEOUT_MS :', TIMEOUT_MS);
  console.log('API_KEY    :', mask(API_KEY));
  console.log('----------------------------------------');

  if (!API_KEY) {
    console.error('❌ Chưa cấu hình FPT_AI_API_KEY → quét CCCD sẽ luôn báo lỗi 503. Đây có thể là nguyên nhân.');
    process.exit(2);
  }

  const imgPath = process.argv[2];
  let userContent;
  if (imgPath) {
    const buf = fs.readFileSync(imgPath);
    const mime = detectMime(buf);
    console.log(`Ảnh test  : ${imgPath} (${(buf.length / 1024).toFixed(0)} KB, mime nhận diện: ${mime})`);
    if (mime === 'image/heic') {
      console.warn('⚠ Ảnh là HEIC — nhiều model VLM không đọc được HEIC. Nên test bằng JPEG/PNG.');
    }
    userContent = [
      { type: 'image_url', image_url: { url: `data:${mime};base64,${buf.toString('base64')}` } },
      { type: 'text', text: 'Ảnh này là gì? Trả lời ngắn gọn 1 câu.' },
    ];
  } else {
    console.log('Chế độ    : ping text-only (không kèm ảnh)');
    userContent = 'Trả lời đúng một từ: OK';
  }

  const body = {
    model: MODEL,
    temperature: 0,
    messages: [{ role: 'user', content: userContent }],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      console.error(`❌ TIMEOUT sau ${TIMEOUT_MS}ms — FPT AI không phản hồi kịp. Model có thể đang "nguội"/quá tải.`);
    } else {
      console.error('❌ Lỗi kết nối:', err?.message ?? err);
    }
    process.exit(1);
  }
  clearTimeout(timer);
  const ms = Date.now() - t0;

  const raw = await res.text().catch(() => '');
  console.log('----------------------------------------');
  console.log(`HTTP ${res.status} ${res.statusText} — ${ms}ms`);

  if (!res.ok) {
    console.error('❌ Gọi API THẤT BẠI. Body:');
    console.error(raw.slice(0, 800));
    if (res.status === 401 || res.status === 403) {
      console.error('\n→ 401/403: key sai HOẶC key CHƯA được cấp quyền dùng model này. Kiểm tra quyền model trên marketplace.');
    } else if (res.status === 404) {
      console.error('\n→ 404: sai BASE_URL hoặc tên MODEL không tồn tại. Đối chiếu lại FPT_AI_MODEL / FPT_AI_BASE_URL.');
    } else if (res.status === 402 || /balance|credit|insufficient/i.test(raw)) {
      console.error('\n→ Liên quan số dư/thanh toán dù dashboard báo còn tiền — kiểm tra loại quota cho model này.');
    }
    process.exit(1);
  }

  // HTTP 200 → kiểm tra nội dung có dùng được không (đây là chỗ "200 nhưng vẫn fail").
  let json;
  try { json = JSON.parse(raw); } catch {
    console.error('❌ HTTP 200 nhưng body KHÔNG phải JSON — bất thường:');
    console.error(raw.slice(0, 800));
    process.exit(1);
  }
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    console.error('❌ HTTP 200 nhưng KHÔNG có choices[0].message.content.');
    console.error('   → Đây chính là kiểu "trừ tiền, status xanh nhưng code báo fail". Cấu trúc response khác dự kiến:');
    console.error(JSON.stringify(json, null, 2).slice(0, 800));
    process.exit(1);
  }

  console.log('✅ API KHỎE. Nội dung model trả về:');
  console.log('   ', content.slice(0, 300).replace(/\n/g, ' '));
  if (json.usage) console.log('   usage:', JSON.stringify(json.usage));
  console.log('\n→ Nếu ping OK mà quét CCCD vẫn fail: khả năng model trả JSON không hợp lệ khi đọc ảnh thật.');
  console.log('  Hãy chạy lại kèm 1 ảnh CCCD (JPEG):  node scripts/check-fpt-health.js ./anh-cccd.jpg');
}

main().catch((e) => { console.error('Lỗi không mong đợi:', e); process.exit(1); });
