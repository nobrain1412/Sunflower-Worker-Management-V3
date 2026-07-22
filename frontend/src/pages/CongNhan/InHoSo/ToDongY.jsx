// Tờ 3 — PHIẾU ĐỒNG Ý CỦA NGƯỜI ĐẠI DIỆN THEO PHÁP LUẬT.
// Chỉ in cho công nhân chưa đủ 18 tuổi tại thời điểm tuyển dụng.
// Số đo lấy từ bản PDF do Word xuất (lề 25.4mm, chữ 12pt Times):
//   - đầu trang là bảng 2 ô không viền: 57.5mm (tên công ty) + 111.5mm (quốc hiệu)
//   - "MÃ VT:" nằm trong khung viền, thụt 130.5mm từ lề trái, rộng 38.4mm
//   - thân bài dòng cách dòng 5.6mm, giữa hai đoạn thêm 3.5mm
//   - khối ký nằm ở khoảng 112mm tính từ lề trái
// Thông tin người đại diện chưa lưu trong hệ thống nên giữ nguyên dòng chấm.

const s = {
  page: {
    // Bản gốc là khổ Letter (bề rộng chữ 165.1mm). Giữ lề trái 25.4mm như gốc và
    // thu lề phải để bề rộng chữ trên A4 vẫn là 165.1mm — nhờ vậy các dòng chấm
    // ngắt dòng đúng chỗ như file Word.
    padding: '25.4mm 19.5mm 25.4mm 25.4mm',
    fontFamily: "'Times New Roman', Times, serif",
    fontSize: '12pt',
    lineHeight: 1.32,
    color: '#000',
  },
  dau:    { display: 'grid', gridTemplateColumns: '57.5mm 111.5mm', lineHeight: 1.13 },
  dauO:   { textAlign: 'center', fontWeight: 700 },
  tieuDe: { textAlign: 'center', fontWeight: 700, margin: '0 0 3.5mm' },
  p:      { margin: '0 0 3.5mm' },
  maVt:   { width: '38.4mm', marginLeft: '130.5mm', border: '0.5pt solid #000', padding: '0 1.9mm', fontWeight: 700 },
};

export default function ToDongY({ cn, ngayIn }) {
  const d = ngayIn ?? new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');

  return (
    <div className="hs-to" style={s.page}>
      <div style={s.dau}>
        <div style={s.dauO}>CÔNG TY TNHH DIAMONDS GOLD GROUP</div>
        <div style={s.dauO}>
          CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM
          <div style={{ textDecoration: 'underline' }}>Độc lập – Tự do – Hạnh phúc</div>
        </div>
      </div>

      <div style={{ height: '15.3mm' }} />

      <div style={s.tieuDe}>PHIẾU ĐỒNG Ý CỦA NGƯỜI ĐẠI DIỆN THEO PHÁP LUẬT</div>
      <div style={{ ...s.tieuDe, marginBottom: '3.9mm' }}>CỦA NGƯỜI CHƯA ĐỦ 18 TUỔI LÀM VIỆC</div>

      <div style={s.maVt}>MÃ VT:</div>

      <div style={s.p}>Họ và tên:  ………………………………………………………………………………………..</div>
      <div style={s.p}>Mối quan hệ với người chưa đủ 18 tuổi: …………………………………………………………</div>
      <div style={s.p}>Nơi đăng ký hộ khẩu thường trú: …………………………………………………………………</div>
      <div style={s.p}>Địa chỉ hiện tại:……………………………………………………………………………………</div>
      <div style={s.p}>Số CMND/CCCD: ……………………………. Cấp ngày: …………….tại ……………………..</div>

      <div style={s.p}>
        Đồng ý cho: <span className="hs-fill">{cn.ho_ten}</span>
        ………………………………………………( ghi rõ họ và tên của người chưa đủ 18 tuổi làm việc)
        ký hợp đồng lao động thời vụ với Công ty TNHH Diamonds Gold Group.
      </div>

      <div style={s.p}>Địa chỉ làm việc tại: Công ty TNHH JY Plasteel Vina</div>
      <div style={s.p}>Tôi cam kết thông tin được ghi ở trên hoàn toàn chính xác.</div>

      <div style={{ ...s.p, textAlign: 'right', fontStyle: 'italic' }}>
        Bắc Ninh, ngày <span className="hs-fill">{dd}</span> tháng <span className="hs-fill">{mm}</span>
        {' '}năm {d.getFullYear()}
      </div>

      {/* Khối ký nằm lệch phải như bản gốc */}
      <div style={{ ...s.p, paddingLeft: '112.6mm', whiteSpace: 'nowrap', fontWeight: 700 }}>
        Người đại diện theo pháp luật
      </div>
      <div style={{ ...s.p, paddingLeft: '110.5mm', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
        (Ký và ghi rõ họ tên)
      </div>
    </div>
  );
}
