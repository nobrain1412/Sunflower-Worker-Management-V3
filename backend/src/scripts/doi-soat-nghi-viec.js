/**
 * Đối soát công nhân đã nghỉ việc — chỉ dựa trên HỌ TÊN (khi Excel thiếu CCCD).
 *
 * Ý tưởng: Excel công ty = danh sách người ĐANG làm (nguồn sự thật).
 *   → CN đang active trong DB mà tên KHÔNG có trong Excel  ⇒ nghi đã nghỉ.
 *
 * Vì chỉ có tên nên KHÔNG tự động cập nhật DB ở chế độ mặc định. Script xuất ra
 * 1 file Excel 3 nhóm để người dùng DUYỆT TAY, rồi mới chạy lại với --apply.
 *
 * Khử "lệch" tên tiếng Việt bằng: chuẩn hoá Unicode NFC + gộp dấu cách + viết
 * thường; kèm 1 lượt so "bỏ dấu" để bắt các trường hợp sai/thiếu dấu.
 *
 * Dùng:
 *   node src/scripts/doi-soat-nghi-viec.js --excel <file.xlsx> [--sheet <tên>]
 *        [--col <tiêu đề cột tên|A>] [--out <ket-qua.xlsx>]
 *
 *   # Sau khi đã DUYỆT file kết quả, đánh dấu nghỉ việc theo danh sách id đã xác nhận:
 *   node src/scripts/doi-soat-nghi-viec.js --apply <ids.txt> [--ngay 2026-08-25]
 *
 *   (ids.txt: mỗi dòng 1 id công nhân — có thể lấy từ cột id của sheet "Nghi da nghi")
 */
require('dotenv').config();

const path = require('path');
const ExcelJS = require('exceljs');
const db = require('../utils/db');

// ─── Chuẩn hoá tên ────────────────────────────────────────
// NFC: đồng nhất ký tự dựng sẵn vs tổ hợp dấu (nguồn "lệch" số 1 của tiếng Việt).
function chuanHoaTen(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Bản bỏ dấu — để dò lượt 2 khi tên bị sai/thiếu dấu.
function boDau(s) {
  return chuanHoaTen(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

// ─── Đọc tham số dòng lệnh ────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) args[a.slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i];
  }
  return args;
}

// ─── Đọc danh sách tên từ Excel ───────────────────────────
async function docTenTuExcel(file, sheetName, col) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = sheetName ? wb.getWorksheet(sheetName) : wb.worksheets[0];
  if (!ws) throw new Error(`Không tìm thấy sheet "${sheetName ?? '(đầu tiên)'}" trong ${file}`);

  // Xác định cột chứa tên: ưu tiên --col (chữ cái cột hoặc tiêu đề), sau đó tự dò
  // theo tiêu đề chứa "ho ten"/"ten"/"name", cuối cùng mặc định cột đầu (A).
  let colIndex = null;
  const header = ws.getRow(1);
  if (col) {
    if (/^[A-Za-z]+$/.test(col)) {
      colIndex = ws.getColumn(col.toUpperCase()).number;
    } else {
      const want = boDau(col);
      header.eachCell((cell, c) => { if (colIndex == null && boDau(cell.text) === want) colIndex = c; });
      if (colIndex == null) throw new Error(`Không thấy cột tiêu đề "${col}"`);
    }
  } else {
    header.eachCell((cell, c) => {
      const h = boDau(cell.text);
      if (colIndex == null && (h.includes('ho ten') || h === 'ten' || h.includes('name'))) colIndex = c;
    });
    if (colIndex == null) colIndex = 1;
  }

  const names = [];
  ws.eachRow((row, r) => {
    if (r === 1) return; // bỏ hàng tiêu đề
    const raw = row.getCell(colIndex).text;
    const key = chuanHoaTen(raw);
    if (key) names.push({ raw: String(raw).trim(), key, strip: boDau(raw) });
  });
  return { names, colIndex, sheet: ws.name };
}

// ─── Lấy CN đang active trong DB (chưa nghỉ, chưa xoá) ─────
async function layCongNhanActive() {
  const { rows } = await db.query(
    `SELECT cn.id, cn.ho_ten, cn.cccd, cn.so_dien_thoai,
            cn.ngay_vao_lam, cn.trang_thai, ct.ten_cong_ty
       FROM cong_nhan cn
       LEFT JOIN cong_ty ct ON ct.id = cn.cong_ty_id
      WHERE cn.deleted_at IS NULL
        AND cn.trang_thai <> 'nghi_viec'
      ORDER BY ct.ten_cong_ty NULLS LAST, cn.ho_ten`,
  );
  return rows.map((r) => ({ ...r, key: chuanHoaTen(r.ho_ten), strip: boDau(r.ho_ten) }));
}

// ─── Phân nhóm ────────────────────────────────────────────
function phanNhom(dbList, excel) {
  const excelKey = new Set(excel.names.map((n) => n.key));
  const excelStrip = new Set(excel.names.map((n) => n.strip));

  // Đếm số CN active trùng tên trong DB (để đánh dấu "cần kiểm tra")
  const dbKeyCount = new Map();
  dbList.forEach((r) => dbKeyCount.set(r.key, (dbKeyCount.get(r.key) ?? 0) + 1));

  const nghiDaNghi = [];   // active trong DB, tên không có trong Excel
  const conLam = [];       // khớp chắc
  const canKiemTra = [];   // trùng tên trong DB, hoặc chỉ khớp khi bỏ dấu

  for (const r of dbList) {
    const trungTen = dbKeyCount.get(r.key) > 1;
    if (excelKey.has(r.key)) {
      (trungTen ? canKiemTra : conLam).push({ ...r, ly_do: trungTen ? 'Trùng tên trong DB — cần xác định đúng người' : 'Khớp tên' });
    } else if (excelStrip.has(r.strip)) {
      canKiemTra.push({ ...r, ly_do: 'Chỉ khớp khi bỏ dấu — kiểm tra lại chính tả' });
    } else {
      nghiDaNghi.push({ ...r, ly_do: 'Không có tên trong Excel' });
    }
  }

  // Tên trong Excel nhưng không map được CN active nào → DB thiếu hồ sơ / đã nghỉ trước đó
  const dbKeySet = new Set(dbList.map((r) => r.key));
  const dbStripSet = new Set(dbList.map((r) => r.strip));
  const excelThieu = excel.names.filter((n) => !dbKeySet.has(n.key) && !dbStripSet.has(n.strip));

  return { nghiDaNghi, conLam, canKiemTra, excelThieu };
}

// ─── Xuất file kết quả ────────────────────────────────────
async function xuatKetQua(outFile, groups) {
  const wb = new ExcelJS.Workbook();
  const cnCols = [
    { header: 'id', key: 'id', width: 8 },
    { header: 'Họ tên', key: 'ho_ten', width: 26 },
    { header: 'Công ty', key: 'ten_cong_ty', width: 22 },
    { header: 'CCCD', key: 'cccd', width: 16 },
    { header: 'SĐT', key: 'so_dien_thoai', width: 14 },
    { header: 'Ngày vào làm', key: 'ngay_vao_lam', width: 14 },
    { header: 'Trạng thái', key: 'trang_thai', width: 12 },
    { header: 'Lý do', key: 'ly_do', width: 40 },
  ];
  const addSheet = (name, cols, rows) => {
    const ws = wb.addWorksheet(name);
    ws.columns = cols;
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
  };

  addSheet('Nghi da nghi', cnCols, groups.nghiDaNghi);
  addSheet('Can kiem tra', cnCols, groups.canKiemTra);
  addSheet('Con lam', cnCols, groups.conLam);
  addSheet('Excel khong thay trong DB', [
    { header: 'Tên trong Excel', key: 'raw', width: 30 },
  ], groups.excelThieu.map((n) => ({ raw: n.raw })));

  const tong = wb.addWorksheet('Tong hop');
  tong.columns = [{ header: 'Nhóm', key: 'k', width: 32 }, { header: 'Số lượng', key: 'v', width: 12 }];
  tong.getRow(1).font = { bold: true };
  [
    ['Nghi đã nghỉ (cần duyệt để đánh nghỉ)', groups.nghiDaNghi.length],
    ['Cần kiểm tra (trùng tên / khớp bỏ dấu)', groups.canKiemTra.length],
    ['Còn làm (khớp chắc)', groups.conLam.length],
    ['Excel không thấy trong DB', groups.excelThieu.length],
  ].forEach(([k, v]) => tong.addRow({ k, v }));

  await wb.xlsx.writeFile(outFile);
}

// ─── Chế độ --apply: đánh nghỉ việc theo danh sách id đã xác nhận ──
async function apply(idsFile, ngay) {
  const fs = require('fs');
  const ids = fs.readFileSync(idsFile, 'utf8')
    .split(/\r?\n/)
    .map((l) => parseInt(l.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) throw new Error(`Không đọc được id hợp lệ nào trong ${idsFile}`);

  const model = require('../models/congNhanModel');
  const updated = await model.nghiViecHangLoat(ids, ngay || null);
  console.log(`✔ Đã đánh dấu nghỉ việc ${updated.length}/${ids.length} công nhân` +
    (ngay ? ` (ngày nghỉ ${ngay})` : ' (ngày nghỉ = hôm nay)') + '.');
  const boQua = ids.filter((id) => !updated.includes(id));
  if (boQua.length) console.log(`  Bỏ qua ${boQua.length} id (đã nghỉ/đã xoá/không tồn tại): ${boQua.join(', ')}`);
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.apply) {
    await apply(args.apply, args.ngay);
    return;
  }

  if (!args.excel) {
    console.error('Thiếu --excel <file.xlsx>. Xem hướng dẫn ở đầu file script.');
    process.exit(1);
  }

  const excel = await docTenTuExcel(args.excel, args.sheet, args.col);
  console.log(`Đọc ${excel.names.length} tên từ sheet "${excel.sheet}" (cột ${excel.colIndex}).`);

  const dbList = await layCongNhanActive();
  console.log(`DB có ${dbList.length} công nhân đang active (chưa nghỉ).`);

  const groups = phanNhom(dbList, excel);
  const outFile = args.out
    ? path.resolve(args.out)
    : path.resolve(process.cwd(), `doi-soat-nghi-viec_${Date.now()}.xlsx`);
  await xuatKetQua(outFile, groups);

  console.log('\n── Kết quả ──');
  console.log(`  Nghi đã nghỉ:        ${groups.nghiDaNghi.length}`);
  console.log(`  Cần kiểm tra:        ${groups.canKiemTra.length}`);
  console.log(`  Còn làm (khớp):      ${groups.conLam.length}`);
  console.log(`  Excel không thấy DB: ${groups.excelThieu.length}`);
  console.log(`\n→ Đã ghi: ${outFile}`);
  console.log('  DUYỆT sheet "Nghi da nghi", giữ lại id chắc chắn đã nghỉ vào 1 file .txt,');
  console.log('  rồi chạy: node src/scripts/doi-soat-nghi-viec.js --apply ids.txt [--ngay YYYY-MM-DD]');
}

main()
  .then(() => db.end())
  .catch((err) => { console.error('Lỗi:', err.message); db.end().finally(() => process.exit(1)); });
