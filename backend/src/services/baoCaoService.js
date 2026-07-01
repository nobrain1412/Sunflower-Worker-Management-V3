/**
 * Sinh file Excel cho các báo cáo. Hiện có: Danh sách công nhân.
 */
const ExcelJS = require('exceljs');

const TRANG_THAI_LABEL = {
  dang_lam:  'Đang làm',
  moi_vao:   'Mới vào',
  nghi_phep: 'Nghỉ phép',
  nghi_viec: 'Nghỉ việc',
  doi_viec:  'Đợi việc',
  cho_duyet: 'Chờ duyệt',
};
const LOAI_CN_LABEL = { chinh_thuc: 'Chính thức', thoi_vu: 'Thời vụ' };

// Date (ISO / Date) → dd/mm/yyyy để hiển thị trong file
function dmy(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

/**
 * Dựng workbook danh sách công nhân.
 * @param rows  các bản ghi từ congNhanModel.findForExport
 * @param opts  { tenCongTy, chuaNghi, loaiCongNhan } — phục vụ dòng tiêu đề mô tả bộ lọc
 */
async function buildDanhSachCongNhan(rows, opts = {}) {
  const { tenCongTy = null, chuaNghi = false, loaiCongNhan = null } = opts;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'WorkerOS';
  const ws = wb.addWorksheet('Danh sách công nhân');

  // ── Dòng tiêu đề + mô tả bộ lọc ──────────────────────────────
  const phamVi = tenCongTy ? `Công ty: ${tenCongTy}` : 'Tất cả công ty';
  const locNghi = chuaNghi ? 'Chỉ CN chưa nghỉ việc' : 'Gồm cả CN đã nghỉ việc';
  const locLoai = LOAI_CN_LABEL[loaiCongNhan] ?? 'Chính thức + Thời vụ';

  ws.mergeCells('A1:R1');
  ws.getCell('A1').value = 'DANH SÁCH CÔNG NHÂN';
  ws.getCell('A1').font = { bold: true, size: 15 };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.mergeCells('A2:R2');
  ws.getCell('A2').value = `${phamVi}  ·  ${locLoai}  ·  ${locNghi}  ·  Xuất ngày ${dmy(new Date())}  ·  Tổng: ${rows.length} CN`;
  ws.getCell('A2').font = { italic: true, size: 11, color: { argb: 'FF555555' } };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  // ── Header cột ───────────────────────────────────────────────
  const columns = [
    { header: 'STT',          key: 'stt',           width: 6 },
    { header: 'Họ và tên',    key: 'ho_ten',        width: 26 },
    { header: 'CCCD',         key: 'cccd',          width: 16 },
    { header: 'Ngày sinh',    key: 'ngay_sinh',     width: 13 },
    { header: 'Giới tính',    key: 'gioi_tinh',     width: 10 },
    { header: 'SĐT',          key: 'so_dien_thoai', width: 14 },
    { header: 'Địa chỉ',      key: 'dia_chi',       width: 34 },
    { header: 'Công ty',      key: 'ten_cong_ty',   width: 24 },
    { header: 'Loại CN',      key: 'loai_cn',       width: 12 },
    { header: 'Trạng thái',   key: 'trang_thai',    width: 12 },
    { header: 'Ngày vào',     key: 'ngay_vao',      width: 13 },
    { header: 'Ngày nghỉ',    key: 'ngay_nghi',     width: 13 },
    { header: 'Mã vân tay',   key: 'ma_van_tay',    width: 12 },
    { header: 'Bộ phận',      key: 'bo_phan',       width: 16 },
    { header: 'Người tuyển',  key: 'nguoi_tuyen',   width: 18 },
    { header: 'Ngân hàng',    key: 'ngan_hang',     width: 16 },
    { header: 'Số tài khoản', key: 'so_tai_khoan',  width: 18 },
    { header: 'Chủ tài khoản',key: 'ten_chu_tk',    width: 24 },
  ];
  ws.columns = columns;

  const headerRow = ws.getRow(3);
  columns.forEach((c, i) => { headerRow.getCell(i + 1).value = c.header; });
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FF' } };
  headerRow.alignment = { vertical: 'middle', wrapText: true };
  ws.views = [{ state: 'frozen', ySplit: 3 }]; // ghim tiêu đề + header khi cuộn

  // Ép CCCD + SĐT + số TK về Text để Excel không cắt số 0 đầu / không đổi sang mũ
  ['cccd', 'so_dien_thoai', 'so_tai_khoan'].forEach((key) => {
    const idx = columns.findIndex((c) => c.key === key) + 1;
    ws.getColumn(idx).numFmt = '@';
  });

  // ── Dữ liệu ──────────────────────────────────────────────────
  rows.forEach((r, i) => {
    ws.addRow({
      stt:           i + 1,
      ho_ten:        r.ho_ten ?? '',
      cccd:          r.cccd ?? '',
      ngay_sinh:     dmy(r.ngay_sinh),
      gioi_tinh:     r.gioi_tinh ?? '',
      so_dien_thoai: r.so_dien_thoai ?? '',
      dia_chi:       r.dia_chi_hien_tai ?? '',
      ten_cong_ty:   r.ten_cong_ty ?? '',
      loai_cn:       LOAI_CN_LABEL[r.loai_cong_nhan] ?? '',
      trang_thai:    TRANG_THAI_LABEL[r.trang_thai] ?? r.trang_thai ?? '',
      ngay_vao:      dmy(r.ngay_vao_lam),
      ngay_nghi:     dmy(r.ngay_nghi_viec),
      ma_van_tay:    r.ma_van_tay ?? '',
      bo_phan:       r.bo_phan ?? '',
      nguoi_tuyen:   r.nguoi_tuyen_ho_ten ?? '',
      ngan_hang:     r.ngan_hang ?? '',
      so_tai_khoan:  r.so_tai_khoan ?? '',
      ten_chu_tk:    r.ten_chu_tk ?? '',
    });
  });

  return wb.xlsx.writeBuffer();
}

// ISO yyyy-mm-dd → dd/mm/yyyy
function dmyIso(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso ?? '');
}

/**
 * Workbook hóa đơn KTX theo tháng — kỳ tính từ ngày đầu tháng → cuối tháng.
 * @param report { rows, startISO, endISO } từ ktxModel.findHoaDonKtxReport
 * @param opts   { thang, nam }
 */
async function buildHoaDonKtx(report, opts = {}) {
  const { rows = [], startISO, endISO } = report || {};
  const { thang, nam } = opts;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'WorkerOS';
  const ws = wb.addWorksheet(`Hóa đơn KTX T${thang}-${nam}`);

  ws.mergeCells('A1:M1');
  ws.getCell('A1').value = `HÓA ĐƠN KTX THÁNG ${thang}/${nam}`;
  ws.getCell('A1').font = { bold: true, size: 15 };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.mergeCells('A2:M2');
  ws.getCell('A2').value =
    `Kỳ tính: ${dmyIso(startISO)} → ${dmyIso(endISO)} (chốt cuối tháng)  ·  `
    + `Tiền phòng chia theo số ngày ở  ·  Xuất ngày ${dmy(new Date())}`;
  ws.getCell('A2').font = { italic: true, size: 11, color: { argb: 'FF555555' } };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  const columns = [
    { header: 'STT',        key: 'stt',        width: 6 },
    { header: 'KTX',        key: 'ktx',        width: 18 },
    { header: 'Phòng',      key: 'phong',      width: 10 },
    { header: 'Tầng',       key: 'tang',       width: 7 },
    { header: 'Công nhân',  key: 'cong_nhan',  width: 24 },
    { header: 'CCCD',       key: 'cccd',       width: 16 },
    { header: 'Từ ngày',    key: 'tu_ngay',    width: 12 },
    { header: 'Đến ngày',   key: 'den_ngay',   width: 12 },
    { header: 'Số ngày',    key: 'so_ngay',    width: 9 },
    { header: 'Tiền điện',  key: 'tien_dien',  width: 13 },
    { header: 'Tiền nước',  key: 'tien_nuoc',  width: 13 },
    { header: 'Tiền phòng', key: 'tien_phong', width: 14 },
    { header: 'Tổng phải trả', key: 'tong',    width: 15 },
  ];
  ws.columns = columns;

  const headerRow = ws.getRow(3);
  columns.forEach((c, i) => { headerRow.getCell(i + 1).value = c.header; });
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FF' } };
  headerRow.alignment = { vertical: 'middle', wrapText: true };
  ws.views = [{ state: 'frozen', ySplit: 3 }];

  ['cccd'].forEach((key) => {
    const idx = columns.findIndex((c) => c.key === key) + 1;
    ws.getColumn(idx).numFmt = '@';
  });
  // Định dạng tiền có phân cách nghìn
  ['tien_dien', 'tien_nuoc', 'tien_phong', 'tong'].forEach((key) => {
    const idx = columns.findIndex((c) => c.key === key) + 1;
    ws.getColumn(idx).numFmt = '#,##0';
  });

  let tDien = 0, tNuoc = 0, tPhong = 0, tTong = 0;
  rows.forEach((r, i) => {
    ws.addRow({
      stt:        i + 1,
      ktx:        r.ktx_ten ?? '',
      phong:      r.ten_phong ?? '',
      tang:       r.tang ?? '',
      cong_nhan:  r.cong_nhan_ten ?? '',
      cccd:       r.cccd ?? '',
      tu_ngay:    dmyIso(r.tu_ngay),
      den_ngay:   dmyIso(r.den_ngay),
      so_ngay:    r.so_ngay ?? 0,
      tien_dien:  Number(r.tien_dien || 0),
      tien_nuoc:  Number(r.tien_nuoc || 0),
      tien_phong: Number(r.tien_phong || 0),
      tong:       Number(r.tong || 0),
    });
    tDien += Number(r.tien_dien || 0);
    tNuoc += Number(r.tien_nuoc || 0);
    tPhong += Number(r.tien_phong || 0);
    tTong += Number(r.tong || 0);
  });

  // Dòng tổng cộng
  const totalRow = ws.addRow({
    cong_nhan: 'TỔNG CỘNG', tien_dien: tDien, tien_nuoc: tNuoc, tien_phong: tPhong, tong: tTong,
  });
  totalRow.font = { bold: true };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F5FF' } };

  return wb.xlsx.writeBuffer();
}

module.exports = { buildDanhSachCongNhan, buildHoaDonKtx };
