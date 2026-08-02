import { fmtDate } from './utils';

// Tờ 2 — PHIẾU ĐĂNG KÝ TUYỂN DỤNG VÀ CAM KẾT THÔNG TIN CÁ NHÂN.
// Dựng lại đúng bản Word gốc: khung viền xanh quanh trang, tiêu đề đen in đậm,
// hai mục "I / II" chữ xanh, danh sách thông tin dạng bullet có dòng chấm điền tay,
// khối cam kết đánh số 1–6 và khối ký hai cột. Khổ A4 dọc, chữ Times 13pt.

const XANH = '#2E74B5';   // xanh Word (khung + tiêu đề mục)

const s = {
  // Khung viền xanh cách mép trang như bản gốc; padding trong khung = lề chữ
  khung: {
    position: 'absolute',
    inset: '8mm',
    border: `2.5pt solid ${XANH}`,
    padding: '9mm 10mm',
    boxSizing: 'border-box',
    fontFamily: "'Times New Roman', Times, serif",
    fontSize: '13pt',
    lineHeight: 1.3,
    color: '#000',
  },
  title: { margin: '0 0 4mm', textAlign: 'center', fontWeight: 700, fontSize: '14pt' },
  muc:   { margin: '2.5mm 0 1.5mm', fontWeight: 700, color: XANH },
  // Dòng thông tin: bullet ● + nhãn + dòng chấm điền nốt phần còn lại
  li:     { display: 'flex', alignItems: 'flex-end', margin: '0 0 1mm', paddingLeft: '9mm', position: 'relative' },
  cham:   { position: 'absolute', left: '3mm', bottom: '0.4mm', fontSize: '9pt', lineHeight: 1 },
  nhan:   { whiteSpace: 'nowrap' },
  fill:   { flex: 1, borderBottom: '1px dotted #000', margin: '0 0 1.2mm 2mm', minWidth: '20mm' },
  p:      { margin: '0 0 1.5mm', textAlign: 'justify' },
  sub:    { margin: '0 0 1mm', paddingLeft: '6mm', textAlign: 'justify', position: 'relative' },
  subCham:{ position: 'absolute', left: '1mm' },
  kyLuoi: { display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center', marginTop: '3mm' },
};

/** Dòng thông tin cá nhân: nhãn + giá trị (nếu có) rồi dòng chấm điền tay */
function Li({ nhan, value }) {
  return (
    <div style={s.li}>
      <span style={s.cham}>●</span>
      <span style={s.nhan}>
        {nhan}:{value ? <>&nbsp;<b>{value}</b></> : null}
      </span>
      <span style={s.fill} />
    </div>
  );
}

/** Gạch đầu dòng phụ (•) trong mục cam kết số 6 */
function Sub({ children }) {
  return (
    <div style={s.sub}>
      <span style={s.subCham}>•</span>
      {children}
    </div>
  );
}

export default function ToDangKy({ cn }) {
  return (
    <div className="hs-to">
      <div style={s.khung}>
        <div style={s.title}>PHIẾU ĐĂNG KÝ TUYỂN DỤNG VÀ CAM KẾT THÔNG TIN CÁ NHÂN</div>

        <div style={s.muc}>I. Thông tin cá nhân</div>
        <Li nhan="Họ tên" value={cn.ho_ten} />
        <Li nhan="Ngày sinh" value={fmtDate(cn.ngay_sinh)} />
        <Li nhan="Giới tính" value={cn.gioi_tinh} />
        <Li nhan="CCCD" value={cn.cccd} />
        <Li nhan="Ngày cấp" value={fmtDate(cn.ngay_cap_cccd)} />
        <Li nhan="Nơi cấp" value={cn.noi_cap_cccd} />
        <Li nhan="Hộ khẩu thường trú" value={cn.que_quan} />
        <Li nhan="Địa chỉ hiện tại" value={cn.dia_chi_hien_tai} />
        <Li nhan="Số điện thoại" value={cn.so_dien_thoai} />
        <Li nhan="Trình độ học vấn" />
        <Li nhan="Kinh nghiệm làm việc" />

        <div style={s.muc}>II. Cam kết của người lao động</div>

        <div style={s.p}>
          1. <b>Tôi cam kết sử dụng Căn cước công dân (CCCD) chính chủ, hợp pháp hoặc giấy tờ tùy thân
          hợp pháp khác thuộc quyền sở hữu của mình</b> khi đăng ký ứng tuyển và làm việc tại Công ty.
        </div>
        <div style={s.p}>
          2. Tôi <b>không sử dụng giấy tờ tùy thân giả mạo, bị sửa chữa hoặc tẩy xóa, hoặc giấy tờ mượn
          của bất kỳ cá nhân nào khác</b> để đăng ký ứng tuyển hoặc làm việc tại Công ty.
        </div>
        <div style={s.p}>
          3. Tôi <b>không cho bất kỳ người nào khác mượn Căn cước công dân hoặc giấy tờ tùy thân của
          mình</b> để đăng ký ứng tuyển hoặc làm việc tại Công ty dưới bất kỳ hình thức nào.
        </div>
        <div style={s.p}>
          4. Tôi cam kết rằng toàn bộ thông tin cá nhân, giấy tờ và hồ sơ đã cung cấp cho Công ty
          là <b>đầy đủ, trung thực và chính xác.</b>
        </div>
        <div style={s.p}>
          5. Tôi hiểu rằng việc sử dụng giấy tờ giả mạo, giấy tờ của người khác hoặc cho người khác
          mượn giấy tờ tùy thân của mình là hành vi vi phạm nội quy của Công ty và có thể vi phạm
          pháp luật Việt Nam.
        </div>
        <div style={s.p}>
          6. Nếu Công ty phát hiện tôi vi phạm bất kỳ nội dung cam kết nào nêu trên, tôi đồng ý:
        </div>
        <Sub>Chấp hành mọi hình thức xử lý kỷ luật theo Nội quy lao động và các chính sách của Công ty.</Sub>
        <Sub>Chịu trách nhiệm trước pháp luật về hành vi vi phạm của mình.</Sub>
        <Sub>Cho phép Công ty chuyển hồ sơ và tài liệu có liên quan đến cơ quan nhà nước có thẩm quyền
          để xem xét, xử lý theo quy định của pháp luật.</Sub>

        <div style={{ ...s.p, marginTop: '1.5mm' }}>
          Tôi đã đọc, hiểu đầy đủ toàn bộ nội dung của bản cam kết này và tự nguyện ký tên xác nhận.
        </div>

        {/* Khối ký hai cột */}
        <div style={{ ...s.kyLuoi, fontWeight: 700 }}>
          <div>Người lao động</div>
          <div>Đại diện Phòng Hành chính – Nhân sự</div>
        </div>
        <div style={s.kyLuoi}>
          <div>(Ký, ghi rõ họ tên)</div>
          <div>(Ký, ghi rõ họ tên)</div>
        </div>
      </div>
    </div>
  );
}
