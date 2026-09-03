/**
 * Trang IN phiếu bù chấm vân tay — ngoài Layout (BareRoute) để bản in sạch.
 * Dữ liệu phiếu lấy từ sessionStorage (do trang BuVanTay đẩy sang), mỗi trang A4
 * gồm 2 phiếu A5. Không tự upload — chỉ render dữ liệu đã chọn.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BU_PRINT_KEY } from './BuVanTay';
import './buVanTay.print.css';

// Logo phiếu — người dùng cung cấp sau. Đặt đường dẫn ảnh vào đây (VD import file
// hoặc URL) để hiện logo góc trái. Để trống → chỉ in tiêu đề chữ + tên công ty.
const LOGO_URL = '';

function PhieuBu({ rec, congTy }) {
  return (
    <div className="bu-form">
      {LOGO_URL ? (
        <div className="bu-logo"><img src={LOGO_URL} alt="logo" /></div>
      ) : null}

      <div className="bu-title"><h1>补卡申请单<br />XÁC NHẬN BÙ CHẤM VÂN TAY</h1></div>
      {congTy ? <div className="bu-company">{congTy}</div> : null}

      <div className="bu-section bu-line1">
        <span title={rec.dept || ''}>Bộ phận/BP: <b>{rec.dept || '.........'}</b></span>
        <span title={rec.card || ''}>卡号 Mã vân tay: <b>{rec.card || ''}</b></span>
        <span title={rec.name || ''}>姓名 Họ tên: <b>{rec.name || ''}</b></span>
      </div>

      <div className="bu-section">
        日期 Ngày: <b>{rec.date_str || '.........'}</b> &nbsp;&nbsp;
        工作时间 Khung giờ làm việc: Từ <b>07:30</b> đến <b>{rec.end_str || '.........'}</b>
      </div>
      <div className="bu-section">补卡时间 Thời gian bù vân tay: <b>{rec.bu_str || ''}</b></div>
      <div className="bu-section">事由 Lý do (ghi rõ): <b>Quên chấm vân tay</b></div>
      <div className="bu-section">
        补卡次数 Xác nhận lần thứ: <b>{rec.order ? `${rec.order}/${rec.total}` : ''}</b>
      </div>

      <div className="bu-note">
        Ghi chú: mỗi công nhân chỉ được phép xác nhận BÙ chấm vân tay tối đa 3 lần/tháng, nếu lần thứ 4 phải xác nhận chấm vân tay, sẽ trừ toàn bộ chuyên cần và ngày công từ lần thứ 4 trở đi.{'\n'}
        备注: 每个员工只许《补卡申请单》1个月3次, 如果第4次将去所有的全勤奖并第4次上班天的工资
      </div>

      <div className="bu-signatures">
        <div className="bu-signature">Giám đốc sản xuất<br />生产经理</div>
        <div className="bu-signature">Chủ quản sản xuất<br />生产主管</div>
        <div className="bu-signature">Tổ trưởng<br />组长</div>
        <div className="bu-signature">Người xác nhận<br />确认人</div>
      </div>

      <div className="bu-footer">KY-HR-04-2020 - Update 04/06/2020</div>
    </div>
  );
}

export default function BuVanTayIn() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(BU_PRINT_KEY);
      if (raw) setPayload(JSON.parse(raw));
    } catch { /* dữ liệu hỏng → coi như trống */ }
  }, []);

  useEffect(() => {
    document.body.classList.add('bu-van-tay-body');
    return () => document.body.classList.remove('bu-van-tay-body');
  }, []);

  const records = payload?.records ?? [];
  const congTy = payload?.cong_ty ?? '';

  // Gộp 2 phiếu / trang A4.
  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < records.length; i += 2) out.push(records.slice(i, i + 2));
    return out;
  }, [records]);

  return (
    <div className="bu-root">
      <div className="bu-toolbar no-print">
        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => navigate(-1)}>← Quay lại</button>
        <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => window.print()}
          disabled={records.length === 0}>
          🖨 In phiếu
        </button>
        <span className="bu-toolbar-note">
          {records.length > 0
            ? `${records.length} phiếu · ${pages.length} trang A4`
            : 'Không có dữ liệu phiếu.'}
        </span>
        <span className="bu-toolbar-note">Khi in chọn khổ A4, tỉ lệ 100%, lề (margins) = None.</span>
      </div>

      {records.length === 0 ? (
        <div className="bu-toolbar no-print" style={{ color: '#c00' }}>
          Chưa có dữ liệu phiếu. Quay lại trang Bù chấm vân tay để chọn dòng cần in.
        </div>
      ) : (
        pages.map((pair, pi) => (
          <div className="bu-sheet" key={pi}>
            {pair.map((rec, ri) => (
              <PhieuBu key={`${rec.card}-${rec.ngay_iso}-${ri}`} rec={rec} congTy={congTy} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
