/**
 * Sinh file Excel ẢNH CCCD — nhúng ảnh mặt trước & mặt sau của từng công nhân.
 * Ảnh lưu trên Cloudinary (URL), nên phải tải về buffer trước khi nhúng.
 */
const ExcelJS = require('exceljs');
const { dmy } = require('../utils/formatDate');
const logger = require('../utils/logger');

// Kích thước ảnh trong ô (px) + chiều cao dòng tương ứng.
const IMG_W = 190;
const IMG_H = 120;
const ROW_H_PT = Math.round(IMG_H * 0.75) + 8; // px → point (~0.75) + đệm

// ExcelJS chỉ nhận extension jpeg | png | gif. Suy ra từ Content-Type/URL.
function guessExtension(contentType, url) {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('gif')) return 'gif';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpeg';
  if (/\.png(\?|$)/i.test(url)) return 'png';
  if (/\.gif(\?|$)/i.test(url)) return 'gif';
  return 'jpeg';
}

// Tải 1 ảnh về buffer. Lỗi/timeout → trả null để bỏ qua, không làm hỏng cả file.
async function fetchImage(url) {
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuf),
      extension: guessExtension(res.headers.get('content-type'), url),
    };
  } catch (err) {
    logger.warn(`[bao-cao/anh-cccd] Không tải được ảnh: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param rows các bản ghi từ congNhanModel.findCccdImagesForExport
 * @param opts { tenCongTy, thang, nam }
 */
async function buildAnhCccd(rows, opts = {}) {
  const { tenCongTy = null, thang = null, nam = null } = opts;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'WorkerOS';
  const ws = wb.addWorksheet('Ảnh CCCD');

  // Cột: STT | Họ tên | CCCD | Công ty | Ngày vào | Mặt trước | Mặt sau
  ws.columns = [
    { key: 'stt',         width: 6 },
    { key: 'ho_ten',      width: 26 },
    { key: 'cccd',        width: 16 },
    { key: 'ten_cong_ty', width: 24 },
    { key: 'ngay_vao',    width: 13 },
    { key: 'anh_truoc',   width: 30 },
    { key: 'anh_sau',     width: 30 },
  ];
  ws.getColumn('cccd').numFmt = '@'; // giữ số 0 đầu

  // Tiêu đề + mô tả bộ lọc
  const phamVi = tenCongTy ? `Công ty: ${tenCongTy}` : 'Tất cả công ty';
  const ky = thang && nam ? `Tháng vào làm: ${thang}/${nam}` : 'Tất cả các tháng';
  ws.mergeCells('A1:G1');
  ws.getCell('A1').value = 'ẢNH CCCD CÔNG NHÂN';
  ws.getCell('A1').font = { bold: true, size: 15 };
  ws.getCell('A1').alignment = { horizontal: 'center' };
  ws.mergeCells('A2:G2');
  ws.getCell('A2').value = `${phamVi}  ·  ${ky}  ·  Xuất ngày ${dmy(new Date())}  ·  Tổng: ${rows.length} CN`;
  ws.getCell('A2').font = { italic: true, size: 11, color: { argb: 'FF555555' } };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  // Header cột ở hàng 3
  const headers = ['STT', 'Họ và tên', 'CCCD', 'Công ty', 'Ngày vào', 'Ảnh CCCD mặt trước', 'Ảnh CCCD mặt sau'];
  const headerRow = ws.getRow(3);
  headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  ws.views = [{ state: 'frozen', ySplit: 3 }];

  // Tải toàn bộ ảnh song song (mỗi CN 2 mặt). Lỗi ảnh nào → null, ô để trống.
  const images = await Promise.all(
    rows.map(async (r) => ({
      truoc: await fetchImage(r.anh_cccd_truoc),
      sau:   await fetchImage(r.anh_cccd_sau),
    })),
  );

  const COL_TRUOC = 5; // 0-based: cột thứ 6
  const COL_SAU   = 6; // 0-based: cột thứ 7

  rows.forEach((r, i) => {
    const excelRow = ws.getRow(4 + i); // hàng dữ liệu bắt đầu ở 4
    excelRow.getCell(1).value = i + 1;
    excelRow.getCell(2).value = r.ho_ten ?? '';
    excelRow.getCell(3).value = r.cccd ?? '';
    excelRow.getCell(4).value = r.ten_cong_ty ?? '';
    excelRow.getCell(5).value = dmy(r.ngay_vao_lam);
    excelRow.height = ROW_H_PT;
    excelRow.alignment = { vertical: 'middle', wrapText: true };

    const rowZero = 3 + i; // 0-based index của hàng dữ liệu
    const { truoc, sau } = images[i];
    if (truoc) {
      const id = wb.addImage(truoc);
      ws.addImage(id, { tl: { col: COL_TRUOC + 0.1, row: rowZero + 0.1 }, ext: { width: IMG_W, height: IMG_H } });
    } else if (r.anh_cccd_truoc) {
      excelRow.getCell(6).value = '(không tải được ảnh)';
    }
    if (sau) {
      const id = wb.addImage(sau);
      ws.addImage(id, { tl: { col: COL_SAU + 0.1, row: rowZero + 0.1 }, ext: { width: IMG_W, height: IMG_H } });
    } else if (r.anh_cccd_sau) {
      excelRow.getCell(7).value = '(không tải được ảnh)';
    }
  });

  return wb.xlsx.writeBuffer();
}

module.exports = { buildAnhCccd };
