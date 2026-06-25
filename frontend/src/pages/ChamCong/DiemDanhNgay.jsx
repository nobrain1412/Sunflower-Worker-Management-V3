/**
 * Điểm danh nhanh theo NGÀY — tối ưu cho buổi sáng.
 *
 * Quy trình: chọn giờ chuẩn + ca → "Tất cả có mặt" (điền 1 phát cho mọi người)
 * → chỉ sửa ngoại lệ (nghỉ / ca đêm / thêm OT) → bấm "Lưu tất cả" ở thanh dưới.
 * Không phải chờ nhập xong từng người mới qua người tiếp theo.
 */
import { useState } from 'react';
import BucketEditor from './BucketEditor';
import {
  presentCell, emptyCell, isEmptyCell, isNghi, detailText, cellColor, totalGio,
} from './chamCongShared';

export default function DiemDanhNgay({ rows, day, getCell, setCell, isDirtyCell, readOnly = false }) {
  const [chuanGio, setChuanGio] = useState(8);
  const [chuanCa, setChuanCa]   = useState('ngay'); // 'ngay' | 'dem'
  const [expandedId, setExpandedId] = useState(null);

  const present = rows.filter((r) => !isEmptyCell(getCell(r.phan_cong_id, day)) && !isNghi(getCell(r.phan_cong_id, day)));
  const nghi    = rows.filter((r) => isNghi(getCell(r.phan_cong_id, day)));

  function markPresent(pcId) {
    setCell(pcId, day, presentCell(chuanGio, chuanCa));
  }
  function markNghi(pcId) {
    setCell(pcId, day, { ...emptyCell(), ca_lam: 'nghi_phep' });
  }
  function fillAll() {
    // Chỉ điền cho người CHƯA chấm để không đè dữ liệu đã nhập tay
    rows.forEach((r) => {
      if (isEmptyCell(getCell(r.phan_cong_id, day))) {
        setCell(r.phan_cong_id, day, presentCell(chuanGio, chuanCa));
      }
    });
  }
  function clearAll() {
    if (!window.confirm('Xoá chấm công ngày này cho TẤT CẢ công nhân đang hiển thị?')) return;
    rows.forEach((r) => setCell(r.phan_cong_id, day, emptyCell()));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Thanh cấu hình ca chuẩn + thao tác nhanh (ẩn khi chỉ xem) */}
      {!readOnly && (
      <div style={s.configBar}>
        <div style={s.configItem}>
          <span style={s.configLabel}>Giờ chuẩn</span>
          <input type="number" min="0" max="24" step="0.5" value={chuanGio}
            onChange={(e) => setChuanGio(e.target.value === '' ? '' : Number(e.target.value))}
            onFocus={(e) => e.target.select()} style={s.gioInput} />
        </div>
        <div style={s.segment}>
          {[['ngay', 'Ca ngày'], ['dem', 'Ca đêm']].map(([v, l]) => (
            <button key={v} onClick={() => setChuanCa(v)}
              style={{ ...s.segBtn, ...(chuanCa === v ? s.segBtnActive : {}) }}>{l}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn-primary" style={s.bulkBtn} onClick={fillAll}>✓ Tất cả có mặt</button>
        <button className="btn-ghost" style={s.bulkBtn} onClick={clearAll}>Xoá hết</button>
      </div>
      )}

      <div style={s.stat}>
        Có mặt <b style={{ color: 'var(--green)' }}>{present.length}</b>
        {nghi.length > 0 && <> · Nghỉ <b style={{ color: 'var(--amber)' }}>{nghi.length}</b></>}
        {' '}/ {rows.length} công nhân
      </div>

      {/* Danh sách công nhân */}
      <div style={s.list}>
        {rows.length === 0 && <div style={s.empty}>Không có công nhân nào phù hợp.</div>}
        {rows.map((r) => {
          const pcId = r.phan_cong_id;
          const cell = getCell(pcId, day);
          const dirty = isDirtyCell(pcId, day);
          const col = cellColor(cell);
          const expanded = expandedId === pcId;
          const empty = isEmptyCell(cell);
          return (
            <div key={pcId} style={{ ...s.card, borderColor: dirty ? 'var(--amber)' : 'var(--border)' }}>
              <div style={s.cardTop}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={s.name}>{r.cong_nhan_ten}</div>
                  <div style={s.sub}>🏭 {r.ten_cong_ty || '—'}{r.bo_phan ? ` · 🔧 ${r.bo_phan}` : ''}</div>
                </div>
                <div style={{ ...s.statusChip, color: col.color, background: col.bg }}>
                  {detailText(cell)}
                </div>
              </div>
              <div style={s.btnRow}>
                {!readOnly && (
                  <>
                    <button onClick={() => markPresent(pcId)}
                      style={{ ...s.qBtn, ...(!empty && !isNghi(cell) ? s.qBtnGreen : {}) }}>
                      Có mặt {chuanGio || 0}h{chuanCa === 'dem' ? ' đêm' : ''}
                    </button>
                    <button onClick={() => markNghi(pcId)}
                      style={{ ...s.qBtn, ...(isNghi(cell) ? s.qBtnAmber : {}) }}>Nghỉ</button>
                  </>
                )}
                <button onClick={() => setExpandedId(expanded ? null : pcId)}
                  style={{ ...s.qBtn, ...(expanded ? s.qBtnActive : {}) }}>
                  {expanded ? 'Đóng' : (readOnly ? '⋯ Xem chi tiết' : '⋯ Chi tiết')}
                </button>
                {totalGio(cell) > 0 && (
                  <span style={s.totalTag}>{totalGio(cell)}h</span>
                )}
              </div>
              {expanded && (
                <div style={s.editorWrap}>
                  <BucketEditor compact readOnly={readOnly} value={cell} onChange={(c) => setCell(pcId, day, c)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const s = {
  configBar: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px',
  },
  configItem: { display: 'flex', alignItems: 'center', gap: 8 },
  configLabel: { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  gioInput: {
    width: 64, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6,
    color: 'var(--text1)', fontSize: 13, padding: '6px 8px', textAlign: 'center',
    fontFamily: "'JetBrains Mono', monospace", outline: 'none',
  },
  segment: { display: 'flex', background: 'var(--bg3)', borderRadius: 8, padding: 2, gap: 2 },
  segBtn: {
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
    color: 'var(--text2)', padding: '6px 12px', borderRadius: 6, fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  segBtnActive: { background: 'var(--accent)', color: '#fff' },
  bulkBtn: { fontSize: 12, padding: '8px 12px' },
  stat: { fontSize: 13, color: 'var(--text2)' },
  list: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 },
  empty: { padding: 40, textAlign: 'center', color: 'var(--text3)', gridColumn: '1 / -1' },
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 },
  cardTop: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  name: { fontSize: 14, fontWeight: 600, color: 'var(--text1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  sub: { fontSize: 11, color: 'var(--text3)', marginTop: 1 },
  statusChip: { fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' },
  btnRow: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  qBtn: {
    background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)',
    borderRadius: 7, padding: '7px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  qBtnGreen:  { background: 'rgba(34,201,134,0.15)', border: '1px solid var(--green)', color: 'var(--green)' },
  qBtnAmber:  { background: 'rgba(255,179,68,0.15)', border: '1px solid var(--amber)', color: 'var(--amber)' },
  qBtnActive: { background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text1)' },
  totalTag: { marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: 'var(--text1)', fontFamily: "'JetBrains Mono', monospace" },
  editorWrap: { paddingTop: 10, borderTop: '1px solid var(--border)' },
};
