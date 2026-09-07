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

// Dịch mọi tham chiếu DÒNG trong 1 công thức đi `delta` dòng.
// Bắt token dạng cột+dòng ("AH5", "$D$5") — số đứng SAU chữ cái cột mới bị dịch,
// nên hằng số ("*8") hay số trong chuỗi ("D/2") không bị đụng.
function shiftFormulaRows(formulaBody, delta) {
  return formulaBody.replace(/(\$?[A-Z]{1,3}\$?)(\d+)/g, (_, col, n) => `${col}${Number(n) + delta}`);
}

// Clone XML 1 dòng nguồn sang dòng mới: đổi số dòng ở thuộc tính <row r> và mọi
// cell ref <c r="..">, đồng thời dịch tham chiếu dòng trong công thức theo delta.
function cloneRowXml(rowXml, srcRow, delta) {
  const newRow = srcRow + delta;
  let out = rowXml.replace(new RegExp(`(<row\\b[^>]*\\br=")${srcRow}(")`), `$1${newRow}$2`);
  // Cell ref: chỉ token có CHỮ CÁI cột đứng trước số (không đụng <row r="..">).
  out = out.replace(/(<c\b[^>]*\br="[A-Z]+)(\d+)"/g, (_, p, n) => `${p}${Number(n) + delta}"`);
  out = out.replace(/(<f\b[^>]*>)([\s\S]*?)(<\/f>)/g, (_, o, body, c) => o + shiftFormulaRows(body, delta) + c);
  return out;
}

// Xoá giá trị mọi ô KHÔNG phải công thức trong 1 dòng (giữ nguyên style s="..").
// Dùng để dòng clone chỉ còn khung + công thức tổng; mã/tên/giờ sẽ ghi lại sau.
function blankNonFormulaCells(rowXml) {
  return rowXml.replace(/<c\b[^>]*\br="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, (m, ref) => {
    if (/<f[\s/>]/.test(m)) return m; // giữ công thức (cột tổng)
    const sMatch = m.match(/\bs="\d+"/);
    return `<c r="${ref}"${sMatch ? ' ' + sMatch[0] : ''}/>`;
  });
}

// Số dòng lớn nhất đang có trong sheetData.
function maxRowOf(xml) {
  let max = 0;
  for (const m of xml.matchAll(/<row\b[^>]*\br="(\d+)"/g)) max = Math.max(max, Number(m[1]));
  return max;
}

// Trích XML nguyên vẹn của 1 dòng theo số dòng (hỗ trợ cả dòng rỗng self-closing).
function extractRowXml(xml, row) {
  const full = xml.match(new RegExp(`<row\\b[^>]*\\br="${row}"[^>]*>[\\s\\S]*?</row>`));
  if (full) return full[0];
  const self = xml.match(new RegExp(`<row\\b[^>]*\\br="${row}"[^>]*/>`));
  return self ? self[0] : `<row r="${row}"/>`;
}

// Nới <dimension ref="A1:AHnn"/> để phủ tới dòng mới (nếu file có khai báo).
function bumpDimension(xml, maxRow) {
  return xml.replace(/(<dimension\b[^>]*\bref="[A-Z]+\d+:[A-Z]+)(\d+)("[^>]*\/>)/,
    (m, p, n, s) => (Number(n) >= maxRow ? m : `${p}${maxRow}${s}`));
}

// Các range gộp ô (merge) NẰM GỌN trong cụm mẫu [firstRow, lastRow] — vd MVT/họ tên
// gộp dọc cả cụm. Trả [{ c1, r1, c2, r2 }] để nhân bản cho cụm mới.
function blockMergeRanges(xml, firstRow, lastRow) {
  const mc = xml.match(/<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/);
  if (!mc) return [];
  const out = [];
  for (const m of mc[1].matchAll(/<mergeCell\b[^>]*\bref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g)) {
    const r1 = Number(m[2]);
    const r2 = Number(m[4]);
    if (r1 >= firstRow && r2 <= lastRow) out.push({ c1: m[1], r1, c2: m[3], r2 });
  }
  return out;
}

// Chèn thêm các <mergeCell> đã dịch dòng vào khối <mergeCells> sẵn có + cập nhật count.
// Nếu file không có <mergeCells> (cụm mẫu vốn không gộp ô) → giữ nguyên.
function addMergeCells(xml, newRefs) {
  if (newRefs.length === 0 || !/<mergeCells\b/.test(xml)) return xml;
  const added = newRefs.map((r) => `<mergeCell ref="${r}"/>`).join('');
  xml = xml.replace(/(<mergeCells\b[^>]*\bcount=")(\d+)(")/,
    (m, p, n, s) => `${p}${Number(n) + newRefs.length}${s}`);
  return xml.replace('</mergeCells>', `${added}</mergeCells>`);
}

/**
 * Chèn thêm các "cụm dòng" công nhân MỚI vào CUỐI sheet (append).
 * Mỗi cụm được clone từ cụm mẫu (dòng firstRow..firstRow+rowsPerWorker-1) để thừa
 * hưởng style + công thức cột tổng, rồi ghi đè mã/tên/giờ theo `overrides`.
 * Chèn ở cuối nên KHÔNG phải đánh lại số dòng của phần cũ.
 *
 * @param {string} xml       XML của sheet (đã đổ số cho người có sẵn)
 * @param {{firstRow:number, rowsPerWorker:number}} layout
 * @param {Array<Array<Object>>} blocks  mỗi block = mảng dài rowsPerWorker,
 *        phần tử off = { [colIndex]: value } (value: number|string|null)
 * @returns {string} XML đã chèn
 */
function appendWorkerBlocks(xml, layout, blocks) {
  const { firstRow, rowsPerWorker } = layout;
  const sdClose = xml.lastIndexOf('</sheetData>');
  if (sdClose < 0 || !blocks || blocks.length === 0) return xml;

  // Lấy XML mẫu của từng dòng trong cụm + các range gộp ô của cụm (chỉ 1 lần).
  const srcRows = [];
  for (let off = 0; off < rowsPerWorker; off++) srcRows.push(extractRowXml(xml, firstRow + off));
  const srcMerges = blockMergeRanges(xml, firstRow, firstRow + rowsPerWorker - 1);

  let cursor = maxRowOf(xml);
  let addition = '';
  const newMergeRefs = [];
  for (const block of blocks) {
    const delta = (cursor + 1) - firstRow; // dòng đầu cụm mới = cursor+1
    for (let off = 0; off < rowsPerWorker; off++) {
      const srcRow = firstRow + off;
      const newRow = srcRow + delta;
      let rowXml = blankNonFormulaCells(cloneRowXml(srcRows[off], srcRow, delta));
      const overrides = block[off] || {};
      const writes = Object.entries(overrides)
        .map(([col, value]) => ({ row: newRow, col: Number(col), value }));
      rowXml = injectCells(rowXml, writes);
      addition += rowXml;
    }
    // Nhân bản gộp ô (MVT/họ tên… gộp dọc cả cụm) cho cụm mới.
    for (const s of srcMerges) newMergeRefs.push(`${s.c1}${s.r1 + delta}:${s.c2}${s.r2 + delta}`);
    cursor += rowsPerWorker;
  }

  let out = xml.slice(0, sdClose) + addition + xml.slice(sdClose);
  out = addMergeCells(out, newMergeRefs);
  return bumpDimension(out, cursor);
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
  appendWorkerBlocks,
  mapSheetNameToPart,
  colLetter,
  buildCellXml,
  _internal: {
    xmlEscape, decodeXmlEntities, colIndexFromRef, insertCellIntoRow,
    cloneRowXml, blankNonFormulaCells, shiftFormulaRows, maxRowOf, bumpDimension,
    blockMergeRanges, addMergeCells,
  },
};
