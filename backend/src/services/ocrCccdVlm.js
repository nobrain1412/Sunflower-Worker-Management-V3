// Nhận diện CCCD bằng Vision-Language Model trên FPT AI Inference (OpenAI-compatible).
// Thay cho endpoint FPT.AI Vision (api.fpt.ai/vision/idr/vnm) đã ngừng cung cấp.
// Doc: https://ai-docs.fptcloud.com/fpt-ai-inference — base URL + /chat/completions.
const logger = require('../utils/logger');

// Cho phép override qua env; mặc định là cấu hình đã test đạt trên CCCD thật.
const BASE_URL = process.env.FPT_AI_BASE_URL || 'https://mkp-api.fptcloud.com/chat/completions';
const MODEL    = process.env.FPT_AI_MODEL    || 'Qwen2.5-VL-7B-Instruct';

const SYSTEM_PROMPT =
  'Bạn là hệ thống trích xuất thông tin từ ảnh thẻ Căn cước công dân / Căn cước của Việt Nam. ' +
  'Chỉ trả về DUY NHẤT một object JSON hợp lệ, không markdown, không lời giải thích.';

// Prompt xử lý được CẢ 2 mẫu (cũ "Căn cước công dân" + mới "Căn cước") và cả 2 mặt.
const USER_PROMPT = `Đọc ảnh thẻ này (có thể là mặt trước hoặc mặt sau) và trích xuất vào đúng schema JSON sau:
{
  "ho_ten":   "Họ và tên CHỦ THẺ (dòng chữ lớn dưới ảnh chân dung ở mặt trước)",
  "cccd":     "Số định danh cá nhân / Số CCCD — đúng 12 chữ số",
  "ngay_sinh":"Ngày sinh, định dạng DD/MM/YYYY",
  "gioi_tinh":"Chỉ ghi 'Nam' hoặc 'Nữ'",
  "que_quan": "Quê quán HOẶC Nơi đăng ký khai sinh (tùy mẫu thẻ)",
  "dia_chi":  "Nơi thường trú HOẶC Nơi cư trú (tùy mẫu thẻ), đầy đủ các cấp",
  "ngay_cap": "Ngày cấp / Ngày, tháng, năm cấp (thường ở mặt sau), định dạng DD/MM/YYYY"
}

QUY TẮC BẮT BUỘC:
- Chỉ in ra JSON thuần, không kèm bất kỳ chữ nào khác.
- GIỮ NGUYÊN dấu tiếng Việt và chữ hoa/thường đúng như in trên thẻ (ví dụ "Púng Luông", "Thôn Tà Chí Lừ"). Tuyệt đối KHÔNG bỏ dấu.
- "cccd" chỉ gồm đúng 12 chữ số ở mục "Số" / "Số định danh cá nhân". TUYỆT ĐỐI KHÔNG đọc số từ dòng mã máy (MRZ — các dòng chứa ký tự "<" hoặc bắt đầu bằng "IDVNM" ở mặt sau).
- "ho_ten" chỉ lấy tên CHỦ THẺ. KHÔNG lấy tên từ dòng MRZ (chứa "<"), KHÔNG lấy tên người ký hoặc chữ trong con dấu ở mặt sau. Nếu ảnh không có tên chủ thẻ rõ ràng thì để "".
- Mọi ngày tháng đều định dạng DD/MM/YYYY.
- Trường nào không nhìn thấy trên ảnh thì để chuỗi rỗng "". Không suy đoán, không bịa.`;

function mapSex(sex) {
  if (!sex) return '';
  const s = String(sex).toLowerCase().trim();
  if (s.includes('nam') || s === 'male' || s === 'm') return 'Nam';
  if (s.includes('nữ') || s.includes('nu') || s.includes('female') || s === 'f') return 'Nữ';
  return '';
}

// Đoán MIME từ magic bytes để tạo data URL đúng định dạng.
function detectMime(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf[0] === 0x52 && buf[1] === 0x49) return 'image/webp'; // "RI" của RIFF
  return 'image/jpeg';
}

// Bóc JSON ra khỏi text kể cả khi model lỡ bọc ```json ... ``` hoặc kèm chữ thừa.
function extractJson(text) {
  if (!text) return null;
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '');
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s === -1 || e <= s) return null;
  try { return JSON.parse(t.slice(s, e + 1)); } catch { return null; }
}

// Nhận Buffer ảnh 1 mặt CCCD → object trường CCCD. Ném lỗi nếu API/parse thất bại.
async function recognizeCCCDViaVLM(imageBuffer, apiKey) {
  const dataUrl = `data:${detectMime(imageBuffer)};base64,${imageBuffer.toString('base64')}`;
  const body = {
    model: MODEL,
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: USER_PROMPT },
        ],
      },
    ],
  };

  const t0 = Date.now();
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`FPT AI Inference HTTP ${res.status}: ${txt.slice(0, 160)}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content ?? '';
  const parsed = extractJson(content);
  if (!parsed) throw new Error('VLM không trả về JSON hợp lệ');

  // Không log giá trị CCCD/tên (nhạy cảm) — chỉ log cờ có/không và độ trễ.
  logger.info({ model: MODEL, ms, has_id: !!parsed.cccd, has_name: !!parsed.ho_ten }, 'FPT AI Inference CCCD parsed');

  const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
  return {
    ho_ten:    str(parsed.ho_ten),
    cccd:      str(parsed.cccd),
    ngay_sinh: str(parsed.ngay_sinh),
    gioi_tinh: mapSex(parsed.gioi_tinh),
    que_quan:  str(parsed.que_quan),
    dia_chi:   str(parsed.dia_chi),
    ngay_cap:  str(parsed.ngay_cap),
    _provider: 'fpt_vlm',
    _type: '',
  };
}

module.exports = { recognizeCCCDViaVLM, MODEL };
