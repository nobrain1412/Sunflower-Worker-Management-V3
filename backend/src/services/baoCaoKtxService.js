/**
 * Workbook hóa đơn KTX theo tháng — mỗi khu KTX một sheet riêng.
 * Kỳ tính cố định từ ngày đầu tháng → ngày cuối tháng; tiền điện/nước/phòng
 * đã được ktxModel.findHoaDonKtxReport chia sẵn cho từng công nhân theo số ngày ở.
 */
const ExcelJS = require('exceljs');
const { dmy, dmyIso } = require('../utils/formatDate');

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FF' } };
const TOTAL_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F5FF' } };
// Phòng chưa nhập hoá đơn — tô hổ phách nhạt cho dễ soi
const MISSING_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3D6' } };

const GHI_CHU_THIEU_HOA_DON = 'Chưa nhập hoá đơn — tạm tính theo tiền phòng';

const COLUMNS = [
  { header: 'STT',           key: 'stt',          width: 6 },
  { header: 'Phòng',         key: 'phong',        width: 10 },
  { header: 'Tầng',          key: 'tang',         width: 7 },
  { header: 'Công nhân',     key: 'cong_nhan',    width: 24 },
  { header: 'CCCD',          key: 'cccd',         width: 16 },
  { header: 'Từ ngày',       key: 'tu_ngay',      width: 12 },
  { header: 'Đến ngày',      key: 'den_ngay',     width: 12 },
  { header: 'Số ngày',       key: 'so_ngay',      width: 9 },
  { header: 'Điện cũ',       key: 'dien_cu',      width: 10 },
  { header: 'Điện mới',      key: 'dien_moi',     width: 10 },
  { header: 'Đơn giá điện',  key: 'don_gia_dien', width: 13 },
  { header: 'Tiền điện',     key: 'tien_dien',    width: 13 },
  { header: 'Nước cũ',       key: 'nuoc_cu',      width: 10 },
  { header: 'Nước mới',      key: 'nuoc_moi',     width: 10 },
  { header: 'Đơn giá nước',  key: 'don_gia_nuoc', width: 13 },
  { header: 'Tiền nước',     key: 'tien_nuoc',    width: 13 },
  { header: 'Tiền phòng',    key: 'tien_phong',   width: 14 },
  { header: 'Tổng phải trả', key: 'tong',         width: 15 },
  { header: 'Ghi chú',       key: 'ghi_chu',      width: 34 },
];
const LAST_COL = 'S'; // 19 cột → A..S
const MONEY_KEYS = ['don_gia_dien', 'tien_dien', 'don_gia_nuoc', 'tien_nuoc', 'tien_phong', 'tong'];
const CHI_SO_KEYS = ['dien_cu', 'dien_moi', 'nuoc_cu', 'nuoc_moi'];

// Excel: tên sheet ≤ 31 ký tự, không chứa : \ / ? * [ ] và không được trùng nhau
function toSheetName(raw, used) {
  const cleaned = String(raw || '').replace(/[:\\/?*[\]]/g, ' ').trim();
  const base = (cleaned || 'KTX').slice(0, 31);
  let name = base;
  for (let i = 2; used.has(name); i += 1) {
    const suffix = ` (${i})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name);
  return name;
}

const soTien = (v) => Number(v || 0);

function addKtxSheet(wb, sheetName, ktxTen, rows, { thang, nam, startISO, endISO }) {
  const ws = wb.addWorksheet(sheetName);

  // Số phòng của khu này chưa có bản ghi hoa_don_ktx trong tháng
  const phongThieu = new Set(rows.filter((r) => !r.co_hoa_don).map((r) => r.ten_phong));

  ws.mergeCells(`A1:${LAST_COL}1`);
  ws.getCell('A1').value = `HÓA ĐƠN KTX — ${ktxTen} — THÁNG ${thang}/${nam}`;
  ws.getCell('A1').font = { bold: true, size: 15 };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  const canhBao = phongThieu.size > 0
    ? `  ·  ⚠ ${phongThieu.size} phòng chưa nhập hoá đơn`
    : '';
  ws.mergeCells(`A2:${LAST_COL}2`);
  ws.getCell('A2').value =
    `Kỳ tính: ${dmyIso(startISO)} → ${dmyIso(endISO)} (chốt cuối tháng)  ·  `
    + `Tiền phòng chia theo số ngày ở  ·  Xuất ngày ${dmy(new Date())}${canhBao}`;
  ws.getCell('A2').font = {
    italic: true, size: 11,
    color: { argb: phongThieu.size > 0 ? 'FFB26A00' : 'FF555555' },
  };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  // Chỉ gán key + width. Kèm `header` sẽ khiến ExcelJS ghi header vào hàng 1,
  // đè mất dòng tiêu đề đã merge ở trên — header được ghi tay ở hàng 3.
  ws.columns = COLUMNS.map(({ key, width }) => ({ key, width }));

  const headerRow = ws.getRow(3);
  COLUMNS.forEach((c, i) => { headerRow.getCell(i + 1).value = c.header; });
  headerRow.font = { bold: true };
  headerRow.fill = HEADER_FILL;
  headerRow.alignment = { vertical: 'middle', wrapText: true };
  ws.views = [{ state: 'frozen', ySplit: 3 }]; // ghim tiêu đề + header khi cuộn

  const colIndex = (key) => COLUMNS.findIndex((c) => c.key === key) + 1;
  ws.getColumn(colIndex('cccd')).numFmt = '@'; // giữ số 0 đầu, không đổi sang mũ
  MONEY_KEYS.forEach((k) => { ws.getColumn(colIndex(k)).numFmt = '#,##0'; });
  CHI_SO_KEYS.forEach((k) => { ws.getColumn(colIndex(k)).numFmt = '#,##0.##'; });

  const tong = { tien_dien: 0, tien_nuoc: 0, tien_phong: 0, tong: 0 };

  rows.forEach((r, i) => {
    const row = ws.addRow({
      stt:          i + 1,
      phong:        r.ten_phong ?? '',
      tang:         r.tang ?? '',
      cong_nhan:    r.cong_nhan_ten ?? '',
      cccd:         r.cccd ?? '',
      tu_ngay:      dmyIso(r.tu_ngay),
      den_ngay:     dmyIso(r.den_ngay),
      so_ngay:      r.so_ngay ?? 0,
      // null (phòng chưa có hoá đơn) → để trống, không hiện 0
      dien_cu:      r.dien_cu ?? null,
      dien_moi:     r.dien_moi ?? null,
      don_gia_dien: r.don_gia_dien ?? null,
      tien_dien:    soTien(r.tien_dien),
      nuoc_cu:      r.nuoc_cu ?? null,
      nuoc_moi:     r.nuoc_moi ?? null,
      don_gia_nuoc: r.don_gia_nuoc ?? null,
      tien_nuoc:    soTien(r.tien_nuoc),
      tien_phong:   soTien(r.tien_phong),
      tong:         soTien(r.tong),
      ghi_chu:      r.co_hoa_don ? '' : GHI_CHU_THIEU_HOA_DON,
    });
    if (!r.co_hoa_don) {
      row.fill = MISSING_FILL;
      row.getCell(colIndex('ghi_chu')).font = { italic: true, color: { argb: 'FFB26A00' } };
    }
    tong.tien_dien  += soTien(r.tien_dien);
    tong.tien_nuoc  += soTien(r.tien_nuoc);
    tong.tien_phong += soTien(r.tien_phong);
    tong.tong       += soTien(r.tong);
  });

  if (rows.length === 0) {
    const empty = ws.addRow({ cong_nhan: 'Không có công nhân ở KTX này trong kỳ' });
    empty.font = { italic: true, color: { argb: 'FF888888' } };
  }

  const totalRow = ws.addRow({ cong_nhan: 'TỔNG CỘNG', ...tong });
  totalRow.font = { bold: true };
  totalRow.fill = TOTAL_FILL;

  return ws;
}

/**
 * @param report { rows, startISO, endISO } từ ktxModel.findHoaDonKtxReport
 * @param opts   { thang, nam }
 */
async function buildHoaDonKtx(report, opts = {}) {
  const { rows = [], startISO, endISO } = report || {};
  const { thang, nam } = opts;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'WorkerOS';

  // Mỗi khu KTX → 1 sheet. Gom theo ktx_id để 2 khu trùng tên không dồn vào 1 sheet.
  // rows đã sort theo k.ten nên thứ tự sheet ổn định.
  const byKtx = new Map();
  for (const r of rows) {
    const key = r.ktx_id ?? r.ktx_ten ?? '?';
    if (!byKtx.has(key)) byKtx.set(key, { ten: r.ktx_ten || 'Không rõ KTX', rows: [] });
    byKtx.get(key).rows.push(r);
  }
  // Workbook rỗng làm Excel báo hỏng file → luôn giữ ít nhất 1 sheet
  if (byKtx.size === 0) byKtx.set('_', { ten: 'Không có dữ liệu', rows: [] });

  const used = new Set();
  for (const { ten, rows: ktxRows } of byKtx.values()) {
    addKtxSheet(wb, toSheetName(ten, used), ten, ktxRows, { thang, nam, startISO, endISO });
  }

  return wb.xlsx.writeBuffer();
}

module.exports = { buildHoaDonKtx };
