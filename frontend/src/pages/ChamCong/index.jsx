import { useState } from 'react';

const THANG = 5; const NAM = 2026;
const SO_NGAY = 31;

const CN_LIST = [
  { id: 1, ho_ten: 'Nguyễn Văn An',  cong_ty: 'Công ty A' },
  { id: 2, ho_ten: 'Trần Thị Bình',  cong_ty: 'Công ty B' },
  { id: 3, ho_ten: 'Lê Văn Cường',   cong_ty: 'Công ty A' },
  { id: 4, ho_ten: 'Phạm Thị Dung',  cong_ty: 'Công ty C' },
  { id: 5, ho_ten: 'Hoàng Văn Em',   cong_ty: 'Công ty B' },
];

// Sinh dữ liệu chấm công ngẫu nhiên
function genData() {
  const data = {};
  CN_LIST.forEach((cn) => {
    data[cn.id] = {};
    for (let d = 1; d <= SO_NGAY; d++) {
      const dow = new Date(NAM, THANG - 1, d).getDay();
      if (dow === 0) { data[cn.id][d] = ''; continue; } // CN nghỉ
      const r = Math.random();
      data[cn.id][d] = r > 0.85 ? 'P' : r > 0.75 ? 'OT' : '1';
    }
  });
  return data;
}

const INIT_DATA = genData();

const DAY_TYPE = {
  '1':  { label: '1',   bg: 'rgba(79,124,255,0.15)',  color: 'var(--accent)',  title: 'Đủ công' },
  'OT': { label: 'OT',  bg: 'rgba(123,95,255,0.15)',  color: 'var(--accent2)', title: 'Tăng ca' },
  'P':  { label: 'P',   bg: 'rgba(255,179,68,0.15)',  color: 'var(--amber)',   title: 'Nghỉ phép' },
  '':   { label: '—',   bg: 'transparent',             color: 'var(--text3)',   title: 'Nghỉ CN' },
};

const DAYS = Array.from({ length: SO_NGAY }, (_, i) => i + 1);
const WEEKDAYS = DAYS.map((d) => {
  const dow = new Date(NAM, THANG - 1, d).getDay();
  return ['CN','T2','T3','T4','T5','T6','T7'][dow];
});

export default function ChamCong() {
  const [data, setData]   = useState(INIT_DATA);
  const [filter, setFilter] = useState('');

  function toggle(cnId, day) {
    setData((prev) => {
      const cur = prev[cnId][day];
      const next = cur === '1' ? 'OT' : cur === 'OT' ? 'P' : cur === 'P' ? '' : '1';
      return { ...prev, [cnId]: { ...prev[cnId], [day]: next } };
    });
  }

  const filtered = CN_LIST.filter((cn) =>
    !filter || cn.ho_ten.toLowerCase().includes(filter.toLowerCase()) || cn.cong_ty.includes(filter)
  );

  // Tính tổng
  function countType(cnId, type) {
    return Object.values(data[cnId] || {}).filter((v) => v === type).length;
  }

  return (
    <div style={s.root}>
      {/* Toolbar */}
      <div style={s.toolbar}>
        <div style={s.monthLabel}>
          Tháng <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text1)', fontWeight: 700 }}>{THANG}/{NAM}</span>
        </div>
        <input className="form-input" style={{ width: 200 }} placeholder="Lọc công nhân..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className="btn-primary" style={{ marginLeft: 'auto' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><polyline points="7 10 12 15 17 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="15" x2="12" y2="3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
          Xuất Excel
        </button>
      </div>

      {/* Legend */}
      <div style={s.legend}>
        {Object.entries(DAY_TYPE).filter(([k]) => k !== '').map(([k, v]) => (
          <div key={k} style={s.legendItem}>
            <span style={{ ...s.legendDot, background: v.bg, color: v.color, border: `1px solid ${v.color}40` }}>{v.label}</span>
            <span style={s.legendText}>{v.title}</span>
          </div>
        ))}
        <div style={s.legendItem}>
          <span style={{ ...s.legendDot, background: 'transparent', color: 'var(--text3)' }}>—</span>
          <span style={s.legendText}>Nghỉ CN / Không làm</span>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>Click ô để thay đổi trạng thái</span>
      </div>

      {/* Bảng chấm công */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{ ...s.th, ...s.stickyCol, minWidth: 160 }}>Công nhân</th>
              {DAYS.map((d) => (
                <th key={d} style={{ ...s.th, minWidth: 32, padding: '8px 0', textAlign: 'center', color: WEEKDAYS[d-1] === 'CN' ? 'var(--red)' : 'var(--text3)' }}>
                  <div>{d}</div>
                  <div style={{ fontSize: 9, marginTop: 1 }}>{WEEKDAYS[d-1]}</div>
                </th>
              ))}
              <th style={{ ...s.th, minWidth: 36, textAlign: 'center' }}>Công</th>
              <th style={{ ...s.th, minWidth: 36, textAlign: 'center' }}>OT</th>
              <th style={{ ...s.th, minWidth: 36, textAlign: 'center' }}>P</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((cn) => (
              <tr key={cn.id} style={s.tr}>
                <td style={{ ...s.td, ...s.stickyCol }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)' }}>{cn.ho_ten}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{cn.cong_ty}</div>
                </td>
                {DAYS.map((d) => {
                  const val = data[cn.id]?.[d] ?? '';
                  const dt = DAY_TYPE[val] ?? DAY_TYPE[''];
                  const isSun = WEEKDAYS[d-1] === 'CN';
                  return (
                    <td key={d} style={{ ...s.td, padding: '4px 2px', textAlign: 'center' }}>
                      <div
                        onClick={() => !isSun && toggle(cn.id, d)}
                        style={{
                          width: 28, height: 28, borderRadius: 6, margin: 'auto',
                          background: isSun ? 'transparent' : dt.bg,
                          color: isSun ? 'var(--border)' : dt.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700,
                          cursor: isSun ? 'default' : 'pointer',
                          border: `1px solid ${isSun ? 'transparent' : dt.color + '40'}`,
                          transition: 'all 0.1s',
                        }}
                        title={dt.title}
                      >
                        {isSun ? '' : dt.label}
                      </div>
                    </td>
                  );
                })}
                <td style={{ ...s.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{countType(cn.id, '1')}</td>
                <td style={{ ...s.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: 'var(--accent2)' }}>{countType(cn.id, 'OT')}</td>
                <td style={{ ...s.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>{countType(cn.id, 'P')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s = {
  root:      { display: 'flex', flexDirection: 'column', gap: 14 },
  toolbar:   { display: 'flex', alignItems: 'center', gap: 12 },
  monthLabel:{ fontSize: 13, color: 'var(--text2)' },
  legend:    { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  legendItem:{ display: 'flex', alignItems: 'center', gap: 6 },
  legendDot: { width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 },
  legendText:{ fontSize: 11, color: 'var(--text2)' },
  tableWrap: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, overflowX: 'auto' },
  table:     { borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' },
  th:        { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 8px', borderBottom: '1px solid var(--border)', textAlign: 'left', background: 'var(--bg1)', position: 'sticky', top: 0, zIndex: 2 },
  stickyCol: { position: 'sticky', left: 0, background: 'var(--bg1)', zIndex: 3, borderRight: '1px solid var(--border)', padding: '10px 16px' },
  tr:        { borderBottom: '1px solid var(--border)' },
  td:        { padding: '8px 8px', verticalAlign: 'middle' },
};
