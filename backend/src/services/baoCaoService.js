/**
 * Sinh file Excel cho các báo cáo. Hiện có: Danh sách công nhân.
 * Hóa đơn KTX nằm ở services/baoCaoKtxService.js
 */
const ExcelJS = require('exceljs');
const { dmy } = require('../utils/formatDate');

const TRANG_THAI_LABEL = {
  dang_lam:  'Đang làm',
  moi_vao:   'Mới vào',
  nghi_phep: 'Nghỉ phép',
  nghi_viec: 'Nghỉ việc',
  doi_viec:  'Đợi việc',
  cho_duyet: 'Chờ duyệt',
};
const LOAI_CN_LABEL = { chinh_thuc: 'Chính thức', thoi_vu: 'Thời vụ' };

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
  // Chỉ gán key + width. Kèm `header` sẽ khiến ExcelJS ghi header vào hàng 1,
  // đè mất dòng tiêu đề đã merge ở trên — header được ghi tay ở hàng 3.
  ws.columns = columns.map(({ key, width }) => ({ key, width }));

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

module.exports = { buildDanhSachCongNhan };
