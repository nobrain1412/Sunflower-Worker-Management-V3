import { tachNgay, tinhTuoi, mocTuyenDung } from './utils';

// Tờ 2 — PHIẾU KIỂM TRA ĐỘ TUỔI LAO ĐỘNG THỜI VỤ.
// Số đo lấy từ chính bản PDF do Word xuất ra (lề 25.4mm, chữ 14pt Times):
//   - dòng cách dòng 5.7mm, khoảng cách giữa hai đoạn thêm 4.9mm
//   - 5 dòng thông tin là list bullet: dấu • ở 6.35mm, chữ ở 12.7mm, bullet 10pt
//   - ô tick ☐ ở mép lề, chữ bắt đầu ở 6.2mm
//   - khối ký là bảng 2 cột, cột phải bắt đầu ở 127.8mm tính từ lề trái

const s = {
  page: {
    // Bản gốc khổ Letter: lề trái 25.4mm, bề rộng chữ 165.1mm. Thu lề phải để
    // trên A4 các dòng vẫn ngắt đúng chỗ như file Word.
    padding: '25.4mm 19.5mm 25.4mm 25.4mm',
    fontFamily: "'Times New Roman', Times, serif",
    fontSize: '14pt',
    lineHeight: 1.15,
    color: '#000',
  },
  p:      { margin: '0 0 4.9mm' },
  title:  { margin: '0 0 4.9mm', textAlign: 'center', fontWeight: 700 },
  muc:    { margin: '0 0 4.9mm', fontWeight: 700 },
  ds:     { margin: '0 0 4.9mm' },                       // cụm bullet
  li:     { margin: 0, paddingLeft: '12.7mm', position: 'relative' },
  cham:   { position: 'absolute', left: '6.35mm', fontSize: '14pt', lineHeight: 1 },
  oTick:  { display: 'inline-block', width: '6.2mm' },
  // Dòng có ☐ cao hơn dòng thường ~0.6mm vì ô tick dùng font khác — giữ đúng bản gốc
  tick:   { margin: '0 0 4.9mm', lineHeight: 1.27 },
  kyLuoi: { display: 'grid', gridTemplateColumns: '127.8mm auto', whiteSpace: 'nowrap' },
};

/** Ô tick — ☑ khi hệ thống đã xác nhận, ☐ khi để trống cho người kiểm tra */
function Tick({ on, children }) {
  return (
    <div style={s.tick}>
      <span className="hs-box" style={s.oTick}>{on ? '☑' : '☐'}</span>{children}
    </div>
  );
}

/** Ngày dạng ......../......../........ của bản gốc, điền số vào chỗ chấm */
function Ngay({ value }) {
  const { ngay, thang, nam } = tachNgay(value, '........');
  const oo = (v) => (v.startsWith('.') ? v : <span className="hs-fill">{v}</span>);
  return <>{oo(ngay)}/{oo(thang)}/{oo(nam)}</>;
}

/** Dòng thông tin dạng bullet, giữ nguyên phần chấm chấm của bản gốc */
function Li({ children }) {
  return (
    <div style={s.li}>
      <span style={s.cham}>•</span>
      {children}
    </div>
  );
}

export default function ToDoTuoi({ cn, ngayIn }) {
  const tuoi = tinhTuoi(cn.ngay_sinh, mocTuyenDung(cn));
  const dien = (v, cham) => (v
    ? <> <span className="hs-fill">{v}</span> {cham}</>
    : ` ${cham}`);

  return (
    <div className="hs-to" style={s.page}>
      <div style={s.title}>PHIẾU KIỂM TRA ĐỘ TUỔI LAO ĐỘNG THỜI VỤ</div>

      <div style={s.muc}>1. Thông tin người lao động</div>
      <div style={s.ds}>
        <Li>Họ và tên:{dien(cn.ho_ten, '......................................')}</Li>
        <Li>Ngày sinh: <Ngay value={cn.ngay_sinh} /></Li>
        <Li>Số CCCD/CMND:{dien(cn.cccd, '................................')}</Li>
        <Li>Bộ phận/Vị trí:{dien(cn.bo_phan, '..............................')}</Li>
        <Li>Ngày nhận việc: <Ngay value={cn.ngay_vao_lam} /></Li>
      </div>

      <div style={s.muc}>2. Kiểm tra hồ sơ</div>
      <Tick on>Đã đối chiếu bản gốc CCCD/CMND hoặc Giấy khai sinh.</Tick>
      <Tick on>Thông tin ngày sinh trên giấy tờ hợp lệ.</Tick>

      <div style={s.muc}>3. Kết quả xác minh</div>
      <div style={s.p}>
        Tuổi tại thời điểm tuyển dụng: <span className="hs-fill">{tuoi ?? '............'}</span> tuổi.
      </div>
      <Tick on>Đủ tuổi lao động theo quy định.</Tick>
      <Tick>Không đủ tuổi lao động theo quy định.</Tick>

      <div style={s.muc}>4. Xác nhận</div>
      <div style={s.muc}>4.1 Cam kết của người lao động</div>
      <div style={{ ...s.p, marginBottom: '9.1mm' }}>
        Tôi cam kết các thông tin và giấy tờ cung cấp là đúng sự thật. Tôi chịu trách nhiệm nếu có
        bất kỳ thông tin sai lệch nào.
      </div>

      {/* Khối ký — bản gốc là bảng 2 cột, cột phải ở 127.8mm tính từ lề */}
      <div style={{ ...s.kyLuoi, fontWeight: 700, marginBottom: '4.9mm' }}>
        <div>Người lao động</div>
        <div>Người kiểm tra</div>
      </div>
      <div style={{ ...s.kyLuoi, marginBottom: '6mm' }}>
        <div>Ký, ghi rõ họ tên</div>
        <div>Ký, ghi rõ họ tên</div>
      </div>

      <div style={s.p}>Ngày: <Ngay value={ngayIn ?? new Date()} /></div>
    </div>
  );
}
