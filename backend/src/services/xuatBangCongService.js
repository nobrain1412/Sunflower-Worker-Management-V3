/**
 * Xuất bảng công theo KHUÔN của công ty.
 *
 * Ý tưởng: KHÔNG dựng lại bảng — người dùng upload chính file mẫu của công ty
 * (đã có sẵn tên + mã vân tay, đúng thứ tự, đúng kỳ công), hệ thống chỉ "đổ" số
 * giờ vào đúng dòng của từng người rồi trả lại file y nguyên bố cục + công thức.
 *
 * Nguyên tắc bất di bất dịch:
 *   - Match theo cong_nhan.ma_van_tay ↔ cột "Mã VT"/"Mã NV" trong file.
 *   - Chỉ ghi vào dòng của người CÓ trong hệ thống VÀ có dữ liệu công.
 *   - Người không khớp / không có công → GIỮ NGUYÊN, không xoá dòng nào.
 *   - Chỉ ghi vào các ô NGÀY; cột tổng để nguyên công thức (Excel tự tính lại).
 *   - Không đụng tới sheet không nhận diện được là bảng chấm công (bảng phí, sheet rác…).
 *
 * Hai dạng khuôn (tự nhận diện theo số dòng/1 công nhân):
 *   - 4 dòng: HCN / TCN / HCD / TCD → đổ thẳng số giờ.
 *   - 2 dòng: dòng 1 = điểm danh (quy đổi D/N), dòng 2 = tổng giờ tăng ca (TCN+TCD).
 *
 * Dữ liệu công (data) dạng: Map<ma_van_tay, Map<'YYYY-MM-DD', bucket>>
 *   bucket = { gio_hc_ngay, gio_tc_ngay, gio_hc_dem, gio_tc_dem }
 */
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { injectCells, mapSheetNameToPart } = require('./xlsxTemplateInject');

// Chuẩn hoá header: bỏ dấu, đ→d, lowercase, gộp khoảng trắng.
function norm(v) {
  if (v == null) return '';
  return String(v)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Lấy text hiển thị của 1 ô (hỗ trợ richText, formula.result…).
function cellText(cell) {
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString();
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (v.text != null) return String(v.text);
    if (v.result != null) return String(v.result);
    return '';
  }
  return String(v);
}

// Parse chuỗi ngày dạng text → Date (UTC) hoặc null. Hỗ trợ yyyy-mm-dd và dd/mm/yyyy (hoặc -).
function parseDateText(s) {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/); // dd/mm/yyyy
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return null;
}

// Ô có phải NGÀY không: Date thật, công thức DATE(...) (dùng .result), hoặc TEXT ngày.
function asDate(cell) {
  const v = cell.value;
  if (v instanceof Date) return v;
  if (v && typeof v === 'object') {
    if (v.result != null) {
      const r = v.result;
      if (r instanceof Date) return r;
      if (typeof r === 'string') { const d = parseDateText(r) || (/^\d{4}-\d{2}-\d{2}/.test(r) ? new Date(r) : null); if (d && !Number.isNaN(d.getTime())) return d; }
    }
    if (v.text != null) return parseDateText(String(v.text));
    if (Array.isArray(v.richText)) return parseDateText(v.richText.map((x) => x.text).join(''));
    return null;
  }
  if (typeof v === 'string') return parseDateText(v);
  return null;
}

// Ngày lưu ở UTC-midnight → format theo phần UTC để không lệch múi giờ.
function dateKey(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MA_HEADERS = ['ma vt', 'ma nv', 'ma the', 'ma van tay', 'ma the cham cong'];
const NAME_HEADERS = ['ho ten', 'ho va ten', 'ho ten nv', 'ho ten nhan vien'];

// Nhãn nhận diện vai trò dòng trong khuôn 4 dòng.
const ROLE_LABELS = {
  gio_hc_ngay: ['hcn', 'hanh chinh ngay', 'hc ngay', 'ngay 100', 'ban ngay 100'],
  gio_tc_ngay: ['tcn', 'tang ca ngay', 'tc ngay', 'ot ngay', 'tang ca 150'],
  gio_hc_dem: ['hcd', 'hanh chinh dem', 'hc dem', 'ban dem', 'ban dem 130'],
  gio_tc_dem: ['tcd', 'tang ca dem', 'tc dem', 'ot dem', 'tang ca dem 160'],
};

/**
 * Dò bố cục 1 sheet. Trả về null nếu không phải bảng chấm công.
 * { dateRow, dateCols:[{col,key}], maCol, nameCol, firstRow, rowsPerWorker, roleByOffset }
 */
function detectSheetLayout(ws) {
  // 1) Hàng ngày = hàng đầu tiên có >=10 ô là ngày.
  let dateRow = null;
  let dateCols = [];
  const scanMax = Math.min(ws.rowCount, 20);
  for (let r = 1; r <= scanMax; r++) {
    const cols = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      const d = asDate(ws.getCell(r, c));
      if (d) cols.push({ col: c, key: dateKey(d) });
    }
    if (cols.length >= 10) { dateRow = r; dateCols = cols; break; }
  }
  if (!dateRow) return null;

  // 2) Cột mã / tên: quét vài hàng quanh hàng ngày.
  let maCol = null;
  let nameCol = null;
  for (let r = Math.max(1, dateRow - 3); r <= dateRow + 1; r++) {
    for (let c = 1; c <= 8; c++) {
      const k = norm(cellText(ws.getCell(r, c)));
      if (!maCol && MA_HEADERS.includes(k)) maCol = c;
      if (!nameCol && NAME_HEADERS.includes(k)) nameCol = c;
    }
  }
  if (!maCol) return null;
  if (!nameCol) nameCol = maCol + 1;

  // 3) Hàng công nhân đầu tiên + số dòng/1 người (khoảng cách 2 anchor liên tiếp).
  //    Bỏ qua các dòng header lặp lại (maCol/nameCol chứa đúng nhãn tiêu đề).
  const isWorkerRow = (r) => {
    const maTxt = cellText(ws.getCell(r, maCol)).trim();
    if (!maTxt || MA_HEADERS.includes(norm(maTxt))) return false;
    const nameTxt = cellText(ws.getCell(r, nameCol)).trim();
    if (!nameTxt || NAME_HEADERS.includes(norm(nameTxt))) return false;
    return true;
  };
  const anchors = [];
  for (let r = dateRow + 1; r <= ws.rowCount && anchors.length < 3; r++) {
    if (isWorkerRow(r)) anchors.push(r);
  }
  if (anchors.length < 1) return null;
  const firstRow = anchors[0];
  const rowsPerWorker = anchors.length >= 2 ? anchors[1] - anchors[0] : 2;

  // 4) Khuôn 4 dòng: cố gắng map vai trò từng offset qua nhãn; nếu không có → thứ tự chuẩn.
  let roleByOffset = null;
  if (rowsPerWorker >= 4) {
    roleByOffset = ['gio_hc_ngay', 'gio_tc_ngay', 'gio_hc_dem', 'gio_tc_dem'];
    for (let off = 0; off < rowsPerWorker; off++) {
      const r = firstRow + off;
      let labelTxt = '';
      for (let c = 1; c <= Math.max(nameCol, maCol) + 2; c++) labelTxt += ' ' + norm(cellText(ws.getCell(r, c)));
      for (const [role, keys] of Object.entries(ROLE_LABELS)) {
        if (keys.some((k) => labelTxt.includes(k))) { roleByOffset[off] = role; break; }
      }
    }
  }

  return { dateRow, dateCols, maCol, nameCol, firstRow, rowsPerWorker, roleByOffset };
}

// Quy đổi số giờ hành chính → ký hiệu D/N (+ mẫu số nếu là công lẻ).
// Khớp công thức sẵn có trong file: COUNTIF "D" + "D/2"/2 + "D/4"/4 + "D/8"/8.
function kyHieu(prefix, gio) {
  if (gio >= 8) return prefix;              // đủ công
  if (gio === 4) return `${prefix}/2`;      // 1/2 công
  if (gio === 2) return `${prefix}/4`;      // 1/4 công
  if (gio === 1) return `${prefix}/8`;      // 1/8 công
  return Math.round(gio * 100) / 100;       // giờ lẻ khác → ghi số (hiếm)
}

// Quy đổi 1 ngày sang ký hiệu điểm danh cho khuôn 2 dòng.
function markHanhChinh(b) {
  const hcNgay = Number(b.gio_hc_ngay) || 0;
  const hcDem = Number(b.gio_hc_dem) || 0;
  if (hcNgay > 0) return kyHieu('D', hcNgay);
  if (hcDem > 0) return kyHieu('N', hcDem);
  return null;
}

function num(x) {
  const n = Number(x) || 0;
  return n ? Math.round(n * 100) / 100 : null;
}

// Ô có phải công thức không (để không đè lên công thức tổng lỡ nằm trong vùng ngày).
function isFormulaCell(cell) {
  return !!(cell.formula || (cell.value && typeof cell.value === 'object' && cell.value.formula));
}

/**
 * Tính danh sách ô cần ghi cho 1 sheet — KHÔNG mutate workbook.
 * Trả về { writes: [{ row, col, value }], matched }.
 *   value: number | string | null  (null = để trống)
 * Ô đang chứa công thức sẽ bị bỏ qua (giữ nguyên).
 */
function sheetWrites(ws, layout, dataByMa) {
  const { dateCols, maCol, firstRow, rowsPerWorker, roleByOffset } = layout;
  const writes = [];
  let matched = 0;
  const push = (r, c, value) => {
    if (isFormulaCell(ws.getCell(r, c))) return;
    writes.push({ row: r, col: c, value });
  };
  for (let r = firstRow; r <= ws.rowCount; r += rowsPerWorker) {
    const ma = cellText(ws.getCell(r, maCol)).trim();
    if (!ma) continue;
    const byDate = dataByMa.get(ma);
    if (!byDate) continue; // không có trong hệ thống / không có công → giữ nguyên
    matched += 1;

    for (const { col, key } of dateCols) {
      const b = byDate.get(key) || {};
      if (rowsPerWorker >= 4 && roleByOffset) {
        // Khuôn 4 dòng: mỗi offset 1 loại giờ.
        for (let off = 0; off < rowsPerWorker; off++) {
          const role = roleByOffset[off];
          if (!role) continue;
          push(r + off, col, num(b[role]));
        }
      } else {
        // Khuôn 2 dòng: dòng 0 = điểm danh (D/N), dòng 1 = tổng giờ tăng ca.
        push(r, col, markHanhChinh(b));
        const ot = (Number(b.gio_tc_ngay) || 0) + (Number(b.gio_tc_dem) || 0);
        push(r + 1, col, num(ot));
      }
    }
  }
  return { writes, matched };
}

/**
 * Đổ dữ liệu 1 sheet vào workbook ExcelJS (mutate). Giữ lại cho test/preview.
 * Luồng xuất thật KHÔNG dùng hàm này (xem xuatBangCong — chèn thẳng vào XML).
 */
function pourSheet(ws, layout, dataByMa) {
  const { writes, matched } = sheetWrites(ws, layout, dataByMa);
  for (const { row, col, value } of writes) {
    ws.getCell(row, col).value = value === null ? null : value;
  }
  return { matched };
}

/**
 * Phân tích khuôn: lấy kỳ công (min→max) + danh sách mã vân tay có trong file.
 * Dùng để controller query đúng khoảng ngày + đúng người trước khi đổ.
 * @returns {Promise<{dateMin, dateMax, maList:string[], sheets:Array}>}
 */
async function phanTichKhuon(templateBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);
  const maInfo = new Map(); // ma → { ma, ten, sheet } (lần xuất hiện đầu tiên)
  const sheets = [];
  const kyTally = new Map(); // 'tu→den' → số sheet, để chọn kỳ công chuẩn
  for (const ws of wb.worksheets) {
    const layout = detectSheetLayout(ws);
    if (!layout) { sheets.push({ ten: ws.name, nhanDien: false }); continue; }
    const tu = layout.dateCols[0].key;
    const den = layout.dateCols[layout.dateCols.length - 1].key;
    const kyCong = `${tu} → ${den}`;
    kyTally.set(kyCong, (kyTally.get(kyCong) || 0) + 1);
    let soNguoi = 0;
    for (let r = layout.firstRow; r <= ws.rowCount; r += layout.rowsPerWorker) {
      const ma = cellText(ws.getCell(r, layout.maCol)).trim();
      if (ma && !MA_HEADERS.includes(norm(ma))) {
        if (!maInfo.has(ma)) {
          maInfo.set(ma, { ma, ten: cellText(ws.getCell(r, layout.nameCol)).trim() || null, sheet: ws.name });
        }
        soNguoi += 1;
      }
    }
    sheets.push({
      ten: ws.name,
      nhanDien: true,
      dang: layout.rowsPerWorker >= 4 ? '4-dong' : '2-dong',
      soNgay: layout.dateCols.length,
      tu, den, kyCong,
      soNguoi,
    });
  }

  // Kỳ công chuẩn = kỳ xuất hiện ở nhiều sheet nhất. Sheet lệch → cảnh báo (thường do
  // gõ sai ô tháng/năm trong file); vẫn đổ theo ngày thật của sheet đó (không tự sửa).
  let kyChuan = null;
  let max = 0;
  for (const [k, n] of kyTally) if (n > max) { max = n; kyChuan = k; }
  for (const s of sheets) if (s.nhanDien) s.lechKy = s.kyCong !== kyChuan;
  const [tuChuan, denChuan] = kyChuan ? kyChuan.split(' → ') : [null, null];

  return {
    dateMin: tuChuan,
    dateMax: denChuan,
    kyChuan: tuChuan ? { tu: tuChuan, den: denChuan } : null,
    maList: [...maInfo.keys()],
    nguoiTrongFile: [...maInfo.values()],
    sheets,
  };
}

// Dựng Map<ma_van_tay, Map<'YYYY-MM-DD', bucket>> từ các dòng DB.
function buildDataMap(rows) {
  const m = new Map();
  for (const r of rows) {
    if (!r.ma_van_tay) continue;
    let bm = m.get(r.ma_van_tay);
    if (!bm) { bm = new Map(); m.set(r.ma_van_tay, bm); }
    bm.set(r.ngay, {
      gio_hc_ngay: r.gio_hc_ngay,
      gio_tc_ngay: r.gio_tc_ngay,
      gio_hc_dem: r.gio_hc_dem,
      gio_tc_dem: r.gio_tc_dem,
    });
  }
  return m;
}

/**
 * Đổ dữ liệu công vào khuôn Excel của công ty.
 * @param {Buffer} templateBuffer  file .xlsx mẫu do người dùng upload
 * @param {Map} dataByMa           Map<ma_van_tay, Map<'YYYY-MM-DD', bucket>>
 * @returns {{ buffer: Buffer, sheets: Array }}
 */
async function xuatBangCong(templateBuffer, dataByMa) {
  // 1) Đọc khuôn bằng ExcelJS CHỈ để dò layout + tính danh sách ô cần ghi.
  //    (load để đọc thì an toàn; chỉ writeBuffer mới gây hỏng file.)
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);

  const sheets = [];
  const writesByName = new Map(); // tên sheet → [{ row, col, value }]
  for (const ws of wb.worksheets) {
    const layout = detectSheetLayout(ws);
    if (!layout) { sheets.push({ ten: ws.name, nhanDien: false }); continue; }
    const { writes, matched } = sheetWrites(ws, layout, dataByMa);
    if (writes.length) writesByName.set(ws.name, writes);
    sheets.push({
      ten: ws.name,
      nhanDien: true,
      dang: layout.rowsPerWorker >= 4 ? '4-dong' : '2-dong',
      soNgay: layout.dateCols.length,
      kyCong: `${layout.dateCols[0].key} → ${layout.dateCols[layout.dateCols.length - 1].key}`,
      matched,
    });
  }

  // 2) Mở file gốc như zip và chèn số vào XML của từng sheet — giữ nguyên byte
  //    mọi phần khác. KHÔNG dùng ExcelJS.writeBuffer() (tránh bug serialize styles).
  const zip = await JSZip.loadAsync(templateBuffer);
  const nameToPart = await mapSheetNameToPart(zip);
  for (const [name, writes] of writesByName) {
    const part = nameToPart.get(name);
    if (!part || !zip.file(part)) continue;
    const xml = await zip.file(part).async('string');
    zip.file(part, injectCells(xml, writes));
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return { buffer, sheets };
}

module.exports = {
  xuatBangCong,
  phanTichKhuon,
  buildDataMap,
  detectSheetLayout,
  pourSheet,
  sheetWrites,
  _internal: { norm, asDate, dateKey, markHanhChinh },
};
