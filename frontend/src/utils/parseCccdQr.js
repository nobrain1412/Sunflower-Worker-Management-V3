// Parse chuỗi QR ở mặt trước CCCD gắn chip (chuẩn C06 Bộ Công an).
// Định dạng 7 trường, ngăn cách bởi dấu "|":
//   CCCD | CMND_cũ | Họ tên | NgàySinh(DDMMYYYY) | Giới tính | Nơi thường trú | NgàyCấp(DDMMYYYY)
// QR KHÔNG chứa: quê quán → để trống cho người dùng tự nhập.
// Nơi cấp KHÔNG có trong QR nhưng mọi CCCD gắn chip đều do cùng một nơi cấp → điền cố định.

// Nơi cấp cố định cho CCCD gắn chip (đơn vị duy nhất cấp loại thẻ có QR)
const NOI_CAP_CCCD = 'Cục Cảnh sát quản lý hành chính về trật tự xã hội';

// DDMMYYYY (8 số liền) → dd/mm/yyyy để khớp input form
function compactDateToSlash(s) {
  const d = String(s ?? '').replace(/\D/g, '');
  if (d.length !== 8) return '';
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/**
 * @param {string} raw chuỗi thô đọc từ QR
 * @returns {null | { cccd, ho_ten, ngay_sinh, gioi_tinh, dia_chi, ngay_cap, noi_cap }}
 *          null nếu không đúng định dạng QR CCCD
 */
export function parseCccdQr(raw) {
  if (!raw) return null;
  // Một số reader chèn khoảng trắng/xuống dòng — chuẩn hoá trước khi tách
  const parts = String(raw).trim().split('|');
  if (parts.length < 6) return null;

  const [cccd, , hoTen, ngaySinh, gioiTinh, diaChi, ngayCap] = parts;

  const cccdClean = String(cccd ?? '').replace(/\D/g, '');
  if (!/^\d{12}$/.test(cccdClean)) return null; // bắt buộc CCCD 12 số

  const gt = String(gioiTinh ?? '').trim();
  return {
    cccd:      cccdClean,
    ho_ten:    String(hoTen ?? '').trim(),
    ngay_sinh: compactDateToSlash(ngaySinh),
    gioi_tinh: ['Nam', 'Nữ', 'Khác'].includes(gt) ? gt : '',
    dia_chi:   String(diaChi ?? '').trim(),
    ngay_cap:  compactDateToSlash(ngayCap),
    noi_cap:   NOI_CAP_CCCD,
  };
}
