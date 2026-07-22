import { fmtDate, mediaUrl } from './utils';
import logoDream from './logo-dream.png';

// Tờ 1 — THÔNG TIN ỨNG VIÊN (biểu mẫu F-HC-02 của JY Plasteel Vina).
// Dựng lại đúng lưới 16 cột × 37 dòng của file .xls gốc: chiều rộng cột, chiều
// cao dòng, ô gộp, nền xám #F2F2F2 và cỡ chữ đều quy đổi từ file gốc.
// Excel in ở zoom 70% nên mọi cỡ chữ gốc (pt) đều nhân IN_TL.

// Bảng gốc rộng 748.5pt × cao 1130.4pt. Thu cả hai chiều cùng một hệ số 0.687
// để giữ nguyên tỉ lệ như khi Excel in (bản gốc in ở zoom 70%):
// rộng 181.4mm, cao 274mm — vừa khổ A4 dọc.
const IN_TL = 0.687;
const pt = (n) => `${(n * IN_TL).toFixed(2)}pt`;
const LE_NGANG = (210 - 181.4) / 2;   // canh giữa trang như bản in

// Chiều rộng 16 cột (mm) — tổng 181.4mm
const COLS = [16.91, 18.17, 11.99, 0, 10.54, 14.34, 4.73, 13.45,
              4.73, 16.72, 7.27, 21.08, 13.28, 8.72, 8.0, 11.44];

// Chiều cao 37 dòng (mm) — tổng 274mm, chừa dự phòng so với vùng in 279mm
const H = {
  r1: 12.0, r2: 5.09, r3: 7.47, r8: 4.9, r9: 8.92, r10: 7.08, r13: 6.74,
  r14: 8.0, r20: 6.54, r23: 7.81, r25: 10.19, r26: 7.27, r32: 4.72,
  r33: 6.91, r34: 6.74, r35: 5.28, r36: 3.63, r37: 13.46,
};

const XAM = '#F2F2F2';
const BD = '0.5pt solid #000';
const o    = { border: BD, padding: '0.3mm 0.8mm', verticalAlign: 'middle', textAlign: 'center', overflow: 'hidden', lineHeight: 1.05 };
const oXam = { ...o, background: XAM };
const val  = { ...o, fontSize: pt(11), fontWeight: 700 };
const tran = { border: 'none', padding: 0 };

/**
 * Nhãn nhiều dòng Việt / Anh / Trung như bản gốc.
 * Mỗi phần tử `lines` là một dòng; ký tự "|" tách đoạn thường với đoạn in nghiêng.
 * Dòng đầu luôn 11pt, các dòng sau dùng `sz` (mặc định 10pt như file gốc).
 */
function N({ lines, sz = 10, dam }) {
  return lines.map((line, i) => {
    const [thuong, nghieng] = String(line).split('|');
    return (
      <div key={i} style={{ fontSize: pt(i === 0 ? 11 : sz), fontWeight: dam ? 700 : undefined }}>
        {thuong}
        {nghieng ? <span style={{ fontStyle: 'italic' }}>{nghieng}</span> : null}
      </div>
    );
  });
}

/** Ô nhãn (nền trắng hoặc xám tuỳ bản gốc) */
function L({ lines, sz, dam, span = 1, rows = 1, xam, style }) {
  return (
    <td colSpan={span} rowSpan={rows} style={{ ...(xam ? oXam : o), ...style }}>
      <N lines={lines} sz={sz} dam={dam} />
    </td>
  );
}
/** Ô giá trị — điền tự động hoặc bỏ trống cho người dùng viết tay */
function V({ children, span = 1, rows = 1, style }) {
  return <td colSpan={span} rowSpan={rows} style={{ ...val, ...style }}>{children}</td>;
}
/** Dòng dữ liệu trống trong các bảng con */
function RowTrong({ h, spans, xamDau }) {
  return (
    <tr style={{ height: `${h}mm` }}>
      {spans.map((sp, i) => (
        <td key={i} colSpan={sp} style={i === 0 && xamDau ? oXam : o} />
      ))}
    </tr>
  );
}

// Ba ô tick + dòng chú thích nhỏ — giữ nguyên số dấu cách của ô E23/M23 gốc
function MucDo() {
  return (
    <div style={{ textAlign: 'left', whiteSpace: 'pre' }}>
      <div style={{ fontSize: pt(11) }}>{' □Tốt         □ Khá       □  Trung Bình'}</div>
      <div style={{ fontSize: pt(8) }}>
        Exellent/<span style={{ fontStyle: 'italic' }}>{'最好    Good/好     Normal/一般'}</span>
      </div>
    </div>
  );
}

export default function ToUngVien({ cn, ngayIn }) {
  const anh = mediaUrl(cn.anh_chan_dung);
  const d = ngayIn ?? new Date();
  const ngayKy = `Hà Nam, ngày ${String(d.getDate()).padStart(2, '0')} `
    + `tháng ${String(d.getMonth() + 1).padStart(2, '0')} năm ${d.getFullYear()}`;

  return (
    <div className="hs-to" style={{ padding: `10mm ${LE_NGANG}mm 8mm`, fontFamily: "'Times New Roman', Times, serif" }}>
      {/* Logo + mã biểu mẫu nằm đè lên dòng 1–2 như trong file gốc */}
      <img src={logoDream} alt="" style={{ position: 'absolute', left: `${LE_NGANG}mm`, top: '10mm', width: '29.1mm' }} />
      <div style={{ position: 'absolute', right: `${LE_NGANG + 1}mm`, top: '10.5mm', color: '#FF0000', fontWeight: 700, fontSize: pt(11) }}>
        F-HC-02
      </div>

      <table style={{ width: '181.4mm', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>{COLS.map((w, i) => <col key={i} style={{ width: `${w}mm` }} />)}</colgroup>
        <tbody>
          {/* Tiêu đề — gạch chân như bản gốc */}
          <tr style={{ height: `${H.r1}mm` }}>
            <td colSpan={16} style={{ ...tran, textAlign: 'center', fontWeight: 700, lineHeight: 1.15 }}>
              <div style={{ fontSize: pt(16), textDecoration: 'underline' }}>THÔNG TIN ỨNG VIÊN</div>
              <div style={{ fontSize: pt(14), textDecoration: 'underline' }}>
                RESUME / <span style={{ fontStyle: 'italic' }}>职员信息</span>
              </div>
            </td>
          </tr>
          <tr style={{ height: `${H.r2}mm` }}>
            <td colSpan={16} style={{ ...tran, textAlign: 'left', fontWeight: 700, fontSize: pt(11) }}>
              JY PLASTEEL VINA CO., LTD
            </td>
          </tr>

          {/* Ảnh + thông tin cá nhân (dòng 3–7) */}
          <tr style={{ height: `${H.r3}mm` }}>
            <td colSpan={3} rowSpan={5} style={{ ...o, padding: '1mm' }}>
              {anh
                ? <img src={anh} alt="" style={{ width: '100%', height: '34mm', objectFit: 'contain' }} />
                : <N lines={['Ảnh', '|Photo']} sz={11} />}
            </td>
            <L span={3} xam lines={['Họ tên/', '|Name / 姓名']} />
            <V span={5}>{cn.ho_ten}</V>
            <L xam lines={['Giới tính/', 'Sexual / |性格']} />
            <V span={4}>{cn.gioi_tinh}</V>
          </tr>
          <tr style={{ height: `${H.r3}mm` }}>
            <L span={3} xam lines={['Ngày sinh/', '|Birthday / 生日']} />
            <V span={5}>{fmtDate(cn.ngay_sinh)}</V>
            <L xam lines={['CMND/', 'ID / |身份证']} />
            <V span={4}>{cn.cccd}</V>
          </tr>
          {/* Quê quán không còn lưu trong hệ thống → để trống viết tay */}
          <tr style={{ height: `${H.r3}mm` }}>
            <L span={3} xam lines={['Quê quán/', 'Hometown /|老家']} />
            <V span={10} />
          </tr>
          <tr style={{ height: `${H.r3}mm` }}>
            <L span={3} xam lines={['Địa chỉ/', 'Address/ |地址']} />
            <V span={10} style={{ fontSize: pt(9) }}>{cn.dia_chi_hien_tai}</V>
          </tr>
          <tr style={{ height: `${H.r3}mm` }}>
            <L span={3} xam lines={['Điện thoại/', 'Phone/ |电话']} />
            <V span={10}>{cn.so_dien_thoai}</V>
          </tr>
          <tr style={{ height: `${H.r8}mm` }}><td colSpan={16} style={tran} /></tr>

          {/* Trường học — cả dòng tiêu đề nền xám */}
          <tr style={{ height: `${H.r9}mm` }}>
            <L rows={4} xam lines={['Trường học', 'School /|学校']} />
            <L span={3} xam lines={['Từ/', 'From/| 从']} />
            <L span={3} xam lines={['Đến/', 'To/ |到']} />
            <L span={5} xam lines={['Trường/', 'School / 学校']} />
            <L span={4} xam lines={['Khoa/', 'Major/ |学科']} />
          </tr>
          {[0, 1, 2].map((i) => <RowTrong key={i} h={H.r10} spans={[3, 3, 5, 4]} />)}

          {/* Kinh nghiệm */}
          <tr style={{ height: `${H.r13}mm` }}>
            <L rows={7} xam lines={['Kinh nghiệm', 'Experience/', '景念']} />
            <L span={3} xam lines={['Từ/', 'From/ 从']} />
            <L span={3} xam lines={['Đến/', 'To/ 到']} />
            <L span={4} xam lines={['Tên công ty/', 'Company name/ |公司名称']} />
            <L span={2} xam lines={['Phòng ban/', 'Dept/ |部门']} />
            <L span={3} xam lines={['Vị trí/', 'Position/ |位置']} />
          </tr>
          {[0, 1, 2, 3, 4, 5].map((i) => <RowTrong key={i} h={H.r14} spans={[3, 3, 4, 2, 3]} />)}

          {/* Chứng chỉ + sức khoẻ + tôn giáo/dân tộc/sở thích */}
          <tr style={{ height: `${H.r20}mm` }}>
            <L rows={3} xam lines={['Chứng chỉ', 'Certification/', '|证明']} />
            <L span={3} lines={['Thời gian/', 'Time /时间']} />
            <L span={3} lines={['Tên chứng chỉ/', 'Certification/|证明名']} />
            <L rows={3} lines={['Sức khỏe', 'Health/', '|身体']} />
            <L span={2} lines={['Chiều cao/', 'Height /高']} />
            <td style={o} />
            <td style={{ ...o, fontSize: pt(11), textAlign: 'right' }}>㎝</td>
            <L sz={8} lines={['Tôn giáo', 'Religion/|宗教']} />
            <td colSpan={3} style={o} />
          </tr>
          <tr style={{ height: `${H.r20}mm` }}>
            <td colSpan={3} style={o} />
            <td colSpan={3} style={o} />
            <L span={2} rows={2} lines={['Cân nặng/', 'Weight/ |重']} />
            <td colSpan={2} rowSpan={2} style={{ ...o, fontSize: pt(11), textAlign: 'right' }}>㎏</td>
            <L sz={8} lines={['Dân tộc', 'Nation/|民租']} />
            <td colSpan={3} style={o} />
          </tr>
          <tr style={{ height: `${H.r20}mm` }}>
            <td colSpan={3} style={o} />
            <td colSpan={3} style={o} />
            <L sz={8} lines={['Sở thích', 'Hobby/|爱好']} />
            <td colSpan={3} style={o} />
          </tr>

          {/* Ngoại ngữ / tin học */}
          <tr style={{ height: `${H.r23}mm` }}>
            <L rows={2} xam lines={['Ngoại ngữ', 'Foreign language/', '|外语']} sz={11} />
            <td colSpan={3} style={o} />
            <td colSpan={4} style={o}><MucDo /></td>
            <td colSpan={2} rowSpan={2} style={oXam}>
              <N lines={['Trình độ tin học', 'Office skill', '|电脑化程度']} />
            </td>
            <td colSpan={2} style={o} />
            <td colSpan={4} style={o}><MucDo /></td>
          </tr>
          <tr style={{ height: `${H.r23}mm` }}>
            <td colSpan={3} style={o} />
            <td colSpan={4} style={o}><MucDo /></td>
            <td colSpan={2} style={o} />
            <td colSpan={4} style={o}><MucDo /></td>
          </tr>

          {/* Gia đình — cả dòng tiêu đề nền xám */}
          <tr style={{ height: `${H.r25}mm` }}>
            <L rows={7} xam lines={['Gia đình', 'Family', '|家庭']} />
            <L xam lines={['Quan hệ', 'Relationship', '|关系']} />
            <L span={2} xam lines={['Tuổi', 'Age', '|岁']} />
            <L span={4} xam lines={['Họ & Tên/', 'Name /姓名']} />
            <L span={5} xam lines={['Nghề nghiệp/', 'Job/ |工作']} />
            <L span={3} xam lines={['Trình độ học vấn', 'Education /|水评']} />
          </tr>
          {[0, 1, 2, 3, 4, 5].map((i) => <RowTrong key={i} h={H.r26} spans={[1, 2, 4, 5, 3]} />)}

          {/* Cam kết + ngày ký (không có vạch dọc giữa hai vế) */}
          <tr style={{ height: `${H.r32}mm` }}>
            <td colSpan={10} style={{ ...o, textAlign: 'left', borderRight: 'none', fontSize: pt(11) }}>
              Tôi cam kết những thông tin trên là hoàn toàn chính xác
            </td>
            <td colSpan={6} style={{ ...o, borderLeft: 'none', fontSize: pt(11), fontWeight: 700, fontStyle: 'italic' }}>
              {ngayKy}
            </td>
          </tr>
          <tr style={{ height: `${H.r33}mm` }}>
            <td colSpan={2} style={{ ...o, textAlign: 'left', fontSize: pt(11), fontWeight: 700 }}>Mức lương mong muốn</td>
            <td colSpan={5} style={o} />
            <td colSpan={9} style={{ ...o, fontSize: pt(11) }}>
              Thông qua liên hệ xác nhận với người tham chiếu, kết quả tham chiếu thông tin mà ứng viên
              cung cấp bên trên là: Chính xác □&nbsp; Không chính xác □
            </td>
          </tr>
          <tr style={{ height: `${H.r34}mm` }}>
            <td colSpan={2} style={{ ...o, textAlign: 'left', fontSize: pt(11), fontWeight: 700 }}>Ngày có thể làm việc:</td>
            <td colSpan={5} style={val}>{fmtDate(cn.ngay_vao_lam)}</td>
            <td colSpan={9} style={{ ...o, fontSize: pt(11) }}>
              Người xác nhận thông tin ký tên:……….. Bộ phận:………..
            </td>
          </tr>

          {/* Khối ký tên — chữ nằm sát mép trên ô */}
          <tr style={{ height: `${H.r35}mm` }}>
            <L span={2} rows={3} dam lines={['Người lao động', 'Employee / 老动人']} style={{ verticalAlign: 'top' }} />
            <L span={5} rows={3} dam lines={['Trưởng BP sản xuất', 'Prod chief /|生产 长部门']} style={{ verticalAlign: 'top' }} />
            <td colSpan={6} style={{ ...o, verticalAlign: 'top', fontWeight: 700, fontSize: pt(11) }}>
              Bộ phận Nhân sự/ <span style={{ fontSize: pt(10) }}>HR /</span>
              <span style={{ fontSize: pt(10), fontStyle: 'italic' }}>人事部</span>
            </td>
            <L span={3} rows={3} dam lines={['Giám đốc/', 'Director/|经理']} style={{ verticalAlign: 'top' }} />
          </tr>
          <tr style={{ height: `${H.r36}mm` }}>
            <L span={3} rows={2} dam lines={['Ngày vào/', 'Date in / |进厂时间']} style={{ verticalAlign: 'top' }} />
            <L span={3} rows={2} dam lines={['Trưởng phòng/', 'Manager/ |部长']} style={{ verticalAlign: 'top' }} />
          </tr>
          <tr style={{ height: `${H.r37}mm` }} />
        </tbody>
      </table>
    </div>
  );
}
