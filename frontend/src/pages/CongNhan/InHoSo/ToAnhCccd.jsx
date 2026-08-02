import { mediaUrl } from './utils';

// Tờ 4 — Ảnh CCCD hai mặt trên A4 dọc.
// Phóng to 50% so với khổ thẻ thật (85.6 × 54 mm) cho dễ đọc khi in.
const THE = { width: '128.4mm', height: '81mm' };

const s = {
  page: {
    padding: '20mm 10mm',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '30mm',
    fontFamily: "'Times New Roman', Times, serif",
  },
  ten: {
    position: 'absolute', top: '12mm', left: 0, right: 0,
    textAlign: 'center', fontSize: '11pt',
  },
  the:    { ...THE, border: '0.2mm solid #999', objectFit: 'cover', display: 'block' },
  trong:  {
    ...THE, border: '0.3mm dashed #999', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: '10pt', color: '#666',
  },
};

function Mat({ src, nhan }) {
  if (!src) return <div style={s.trong}>Chưa có ảnh CCCD {nhan}</div>;
  return <img src={src} alt={`CCCD ${nhan}`} style={s.the} />;
}

export default function ToAnhCccd({ cn }) {
  return (
    <div className="hs-to" style={s.page}>
      <div style={s.ten}>
        <b>{cn.ho_ten}</b>
        {cn.cccd ? <span> — CCCD: {cn.cccd}</span> : null}
      </div>
      <Mat src={mediaUrl(cn.anh_cccd_truoc)} nhan="mặt trước" />
      <Mat src={mediaUrl(cn.anh_cccd_sau)}   nhan="mặt sau" />
    </div>
  );
}
