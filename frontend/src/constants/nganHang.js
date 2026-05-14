// Danh sách ngân hàng Việt Nam — mã VietQR + scheme deep link
export const NGAN_HANG_LIST = [
  { ma: 'mbbank',      ten: 'MB Bank',        scheme: 'mbbank://'      },
  { ma: 'vietcombank', ten: 'Vietcombank',     scheme: 'vietcombank://' },
  { ma: 'techcombank', ten: 'Techcombank',     scheme: 'techcombank://' },
  { ma: 'bidv',        ten: 'BIDV',            scheme: 'bidv://'        },
  { ma: 'agribank',    ten: 'Agribank',        scheme: 'agribank://'    },
  { ma: 'vietinbank',  ten: 'VietinBank',      scheme: 'vietinbank://'  },
  { ma: 'vpbank',      ten: 'VPBank',          scheme: 'vpbank://'      },
  { ma: 'tpbank',      ten: 'TPBank',          scheme: 'tpbank://'      },
  { ma: 'sacombank',   ten: 'Sacombank',       scheme: 'sacombank://'   },
  { ma: 'acb',         ten: 'ACB',             scheme: 'acb://'         },
  { ma: 'hdbank',      ten: 'HDBank',          scheme: 'hdbank://'      },
  { ma: 'ocb',         ten: 'OCB',             scheme: 'ocb://'         },
  { ma: 'vib',         ten: 'VIB',             scheme: 'vib://'         },
  { ma: 'shb',         ten: 'SHB',             scheme: 'shb://'         },
  { ma: 'seabank',     ten: 'SeABank',         scheme: 'seabank://'     },
  { ma: 'msb',         ten: 'MSB',             scheme: 'msb://'         },
  { ma: 'lpbank',      ten: 'LPBank',          scheme: 'lpbank://'      },
  { ma: 'abbank',      ten: 'ABBank',          scheme: 'abbank://'      },
  { ma: 'cake',        ten: 'Cake (VPBank)',    scheme: 'cake.vn://'     },
  { ma: 'eximbank',    ten: 'Eximbank',        scheme: 'eximbank://'    },
];

// Tìm thông tin ngân hàng theo mã
export function findNganHang(ma) {
  if (!ma) return null;
  return NGAN_HANG_LIST.find((b) => b.ma.toLowerCase() === ma.toLowerCase()) ?? { ma, ten: ma, scheme: '' };
}

// Chuyển text có dấu → ASCII cho VietQR addInfo (max 25 ký tự)
export function toVietQRText(str, maxLen = 25) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'D'))
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .substring(0, maxLen);
}

// Build URL ảnh QR từ img.vietqr.io
export function buildQRUrl({ nganHang, soTK, tenChuTK, soTien, noiDung }) {
  const bank    = nganHang?.toLowerCase() ?? '';
  const account = soTK ?? '';
  if (!bank || !account) return '';

  let url = `https://img.vietqr.io/image/${bank}-${account}-compact2.png`;
  const params = new URLSearchParams();
  if (soTien > 0) params.set('amount', soTien);
  if (noiDung)    params.set('addInfo', toVietQRText(noiDung));
  if (tenChuTK)   params.set('accountName', toVietQRText(tenChuTK, 50));
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}
