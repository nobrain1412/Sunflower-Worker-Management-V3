/**
 * Chèn số thẳng vào XML của file .xlsx (surgical injection).
 *
 * Vì sao cần: ExcelJS.writeBuffer() serialize lại TOÀN BỘ workbook; với khuôn có
 * conditional formatting phức tạp, nó ghi hỏng styles.xml → Excel báo "file
 * corrupted". Tính năng xuất bảng công chỉ cần đổ số vào vài ô ngày, nên ta mở
 * file gốc như zip và CHỈ sửa đúng các ô trong XML của từng sheet, giữ NGUYÊN
 * BYTE mọi phần khác (styles, conditional formatting, công thức, ảnh…).
 * => miễn nhiễm với mọi bug serialize của ExcelJS.
 */

// Số cột (1-based) → chữ cái cột ("D", "AB"…).
function colLetter(col) {
  let s = '';
  let n = col;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function decodeXmlEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

// Dựng XML 1 ô, giữ nguyên attribute style s="..".
function buildCellXml(ref, sAttr, value) {
  if (value === null || value === undefined || value === '') return `<c r="${ref}"${sAttr}/>`;
  if (typeof value === 'number') return `<c r="${ref}"${sAttr}><v>${value}</v></c>`;
  // Chuỗi (ký hiệu điểm danh D/N…) — dùng inlineStr để không đụng sharedStrings.
  return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

// Chỉ số cột từ cell ref ("AB12" → 28). Dùng để chèn ô đúng thứ tự.
function colIndexFromRef(ref) {
  const letters = ref.match(/^[A-Z]+/)[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

// Chèn 1 ô mới vào đúng thứ tự cột trong <row r="..">. Dùng khi ô chưa tồn tại
// (khuôn đầy đủ thường đã có sẵn mọi ô ngày, nên đây chỉ là fallback an toàn).
function insertCellIntoRow(xml, row, ref, cellXml) {
  const rowRe = new RegExp(`(<row r="${row}"[^>]*>)([\\s\\S]*?)(</row>)`);
  const rm = xml.match(rowRe);
  if (!rm) return xml; // không có hàng → bỏ qua (không tạo hàng mới để tránh sai schema)
  const target = colIndexFromRef(ref);
  const body = rm[2];
  const cellRe = /<c r="([A-Z]+\d+)"(?:[^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g;
  let insertAt = body.length; // mặc định cuối hàng
  let mm;
  while ((mm = cellRe.exec(body)) !== null) {
    if (colIndexFromRef(mm[1]) > target) { insertAt = mm.index; break; }
  }
  const newBody = body.slice(0, insertAt) + cellXml + body.slice(insertAt);
  return xml.slice(0, rm.index) + rm[1] + newBody + rm[3] + xml.slice(rm.index + rm[0].length);
}

/**
 * Ghi danh sách writes vào XML 1 sheet.
 * @param {string} xml     nội dung xl/worksheets/sheetN.xml
 * @param {Array}  writes  [{ row, col, value }] — value: number|string|null
 * @returns {string} XML đã chèn
 */
function injectCells(xml, writes) {
  for (const { row, col, value } of writes) {
    const ref = colLetter(col) + row;
    const cellRe = new RegExp(`<c r="${ref}"([^>]*?)(/>|>[\\s\\S]*?</c>)`);
    const m = xml.match(cellRe);
    if (m) {
      if (/<f[\s/>]/.test(m[0])) continue; // an toàn: đừng đè công thức
      const sMatch = m[1].match(/\bs="\d+"/);
      const sAttr = sMatch ? ' ' + sMatch[0] : '';
      xml = xml.slice(0, m.index) + buildCellXml(ref, sAttr, value) + xml.slice(m.index + m[0].length);
    } else {
      xml = insertCellIntoRow(xml, row, ref, buildCellXml(ref, '', value));
    }
  }
  return xml;
}

/**
 * Map tên sheet (đã giải mã entity) → đường dẫn part XML trong zip.
 * @param {JSZip} zip
 * @returns {Promise<Map<string,string>>}
 */
async function mapSheetNameToPart(zip) {
  const wbx = await zip.file('xl/workbook.xml').async('string');
  const relsFile = zip.file('xl/_rels/workbook.xml.rels');
  const rels = relsFile ? await relsFile.async('string') : '';
  const relMap = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = (m[0].match(/\bId="([^"]+)"/) || [])[1];
    const target = (m[0].match(/\bTarget="([^"]+)"/) || [])[1];
    if (id && target) relMap[id] = target;
  }
  const map = new Map();
  for (const m of wbx.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const name = (m[0].match(/\bname="([^"]*)"/) || [])[1];
    const rid = (m[0].match(/r:id="([^"]+)"/) || [])[1];
    if (name == null || !rid || !relMap[rid]) continue;
    let target = relMap[rid].replace(/^\//, '');
    if (!target.startsWith('xl/')) target = 'xl/' + target;
    map.set(decodeXmlEntities(name), target);
  }
  return map;
}

module.exports = {
  injectCells,
  mapSheetNameToPart,
  colLetter,
  buildCellXml,
  _internal: { xmlEscape, decodeXmlEntities, colIndexFromRef, insertCellIntoRow },
};
