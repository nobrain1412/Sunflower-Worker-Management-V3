const REPORTS = [
  { id: 'cham-cong',  icon: '📅', title: 'Bảng chấm công tháng', desc: 'Ngày công, OT, nghỉ phép theo từng công nhân', format: '.xlsx', color: 'var(--accent)' },
  { id: 'bang-luong', icon: '💰', title: 'Bảng lương tổng hợp',  desc: 'Lương thực nhận, khấu trừ, tạm ứng',          format: '.xlsx', color: 'var(--green)'  },
  { id: 'thu-chi',    icon: '📊', title: 'Thu/Chi theo kỳ',      desc: 'Tổng hợp giao dịch thu chi theo tháng',        format: '.xlsx', color: 'var(--teal)'  },
  { id: 'ds-cn',      icon: '👥', title: 'Danh sách công nhân',  desc: 'Hồ sơ đầy đủ toàn bộ công nhân',              format: '.xlsx', color: 'var(--accent2)'},
  { id: 'hoa-don-ktx',icon: '🏠', title: 'Hóa đơn KTX',         desc: 'Hóa đơn điện nước, tiền phòng hàng tháng',    format: '.pdf',  color: 'var(--amber)'  },
];

const THANG_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` }));

import { useState } from 'react';

export default function BaoCao() {
  const [thang, setThang] = useState(5);
  const [nam,   setNam]   = useState(2026);
  const [loading, setLoading] = useState(null);

  function handleExport(id) {
    setLoading(id);
    setTimeout(() => setLoading(null), 2000);
  }

  return (
    <div style={s.root}>
      {/* Bộ lọc kỳ */}
      <div style={s.filterCard}>
        <div style={s.filterTitle}>Chọn kỳ báo cáo</div>
        <div style={s.filterRow}>
          <div style={s.filterField}>
            <label className="form-label">Tháng</label>
            <select className="form-input" style={{ width: 160 }} value={thang} onChange={(e) => setThang(+e.target.value)}>
              {THANG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={s.filterField}>
            <label className="form-label">Năm</label>
            <select className="form-input" style={{ width: 120 }} value={nam} onChange={(e) => setNam(+e.target.value)}>
              {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', padding: '8px 0' }}>
              Kỳ: Tháng <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)' }}>{thang}/{nam}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Danh sách báo cáo */}
      <div style={s.reportGrid}>
        {REPORTS.map((r) => (
          <div key={r.id} style={s.reportCard}>
            <div style={{ ...s.reportIcon, background: r.color + '1a', color: r.color }}>{r.icon}</div>
            <div style={s.reportInfo}>
              <div style={s.reportTitle}>{r.title}</div>
              <div style={s.reportDesc}>{r.desc}</div>
              <div style={s.reportMeta}>
                <span style={{ ...s.formatBadge, background: r.color + '15', color: r.color }}>{r.format}</span>
                <span style={s.periodBadge}>T{thang}/{nam}</span>
              </div>
            </div>
            <button
              className="btn-primary"
              style={{ flexShrink: 0, padding: '8px 14px', fontSize: 12 }}
              onClick={() => handleExport(r.id)}
              disabled={loading === r.id}
            >
              {loading === r.id ? (
                <><span style={s.spinner} />Đang xuất...</>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><polyline points="7 10 12 15 17 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="15" x2="12" y2="3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
                  Xuất {r.format}
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Hướng dẫn */}
      <div style={s.helpCard}>
        <div style={s.helpTitle}>💡 Hướng dẫn xuất báo cáo</div>
        <ul style={s.helpList}>
          <li>Chọn tháng và năm cần xuất báo cáo ở bộ lọc phía trên</li>
          <li>File Excel (.xlsx) được tạo bằng ExcelJS, file PDF bằng PDFKit</li>
          <li>Tên file theo chuẩn: <code style={s.code}>[loai-bao-cao]_T[thang]-[nam]_[timestamp].xlsx</code></li>
          <li>Báo cáo tự động lọc dữ liệu theo tháng/năm đã chọn</li>
        </ul>
      </div>
    </div>
  );
}

const s = {
  root:        { display: 'flex', flexDirection: 'column', gap: 16 },
  filterCard:  { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' },
  filterTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text1)', marginBottom: 14 },
  filterRow:   { display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' },
  filterField: { display: 'flex', flexDirection: 'column', gap: 6 },
  reportGrid:  { display: 'flex', flexDirection: 'column', gap: 10 },
  reportCard:  { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 },
  reportIcon:  { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  reportInfo:  { flex: 1, minWidth: 0 },
  reportTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text1)' },
  reportDesc:  { fontSize: 12, color: 'var(--text2)', marginTop: 3 },
  reportMeta:  { display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' },
  formatBadge: { fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, fontFamily: "'JetBrains Mono', monospace" },
  periodBadge: { fontSize: 10, color: 'var(--text3)', background: 'var(--bg3)', padding: '3px 8px', borderRadius: 6 },
  spinner:     { width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite', display: 'inline-block', marginRight: 6 },
  helpCard:    { background: 'rgba(79,124,255,0.06)', border: '1px solid rgba(79,124,255,0.15)', borderRadius: 14, padding: '16px 20px' },
  helpTitle:   { fontSize: 13, fontWeight: 700, color: 'var(--text1)', marginBottom: 10 },
  helpList:    { paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 },
  code:        { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4, color: 'var(--accent)' },
};
