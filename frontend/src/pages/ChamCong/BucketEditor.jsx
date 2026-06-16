/**
 * Trình nhập 4 loại giờ (HC ngày / TC ngày / HC đêm / TC đêm) + nút nghỉ phép/việc/xoá.
 * Dùng chung cho: ô lưới Bảng tháng (popup) và dòng mở rộng ở Điểm danh nhanh.
 */
import { BUCKETS, emptyCell } from './chamCongShared';

export default function BucketEditor({ value, onChange, compact = false }) {
  const cell = value || emptyCell();

  function setBucket(key, raw) {
    const num = raw === '' ? 0 : Number(raw);
    onChange({ ...emptyCell(), ...cell, ca_lam: null, [key]: Number.isFinite(num) && num >= 0 ? num : 0 });
  }

  function setNghi(loai) {
    // Toggle: bấm lại loại đang chọn → bỏ
    onChange(cell.ca_lam === loai ? emptyCell() : { ...emptyCell(), ca_lam: loai });
  }

  const isNghi = cell.ca_lam === 'nghi_phep' || cell.ca_lam === 'nghi_viec';

  return (
    <div style={s.wrap}>
      <div style={s.grid}>
        {BUCKETS.map((b) => (
          <div key={b.key} style={s.field}>
            <label style={{ ...s.label, color: b.color }}>{b.label}</label>
            <input
              type="number" min="0" max="24" step="0.5"
              value={isNghi ? '' : (cell[b.key] || '')}
              disabled={isNghi}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setBucket(b.key, e.target.value)}
              placeholder="0"
              style={{ ...s.input, opacity: isNghi ? 0.4 : 1 }}
            />
          </div>
        ))}
      </div>
      <div style={s.actions}>
        <button type="button" onClick={() => setNghi('nghi_phep')}
          style={{ ...s.tag, ...(cell.ca_lam === 'nghi_phep' ? s.tagAmber : {}) }}>Nghỉ phép</button>
        <button type="button" onClick={() => setNghi('nghi_viec')}
          style={{ ...s.tag, ...(cell.ca_lam === 'nghi_viec' ? s.tagRed : {}) }}>Nghỉ việc</button>
        <button type="button" onClick={() => onChange(emptyCell())} style={s.tag}>Xoá</button>
      </div>
      {!compact && (
        <div style={s.hint}>Để trống = chưa chấm. Nghỉ phép/việc sẽ thông báo cho người tuyển.</div>
      )}
    </div>
  );
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 10 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  field: { display: 'flex', flexDirection: 'column', gap: 3 },
  label: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: {
    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)',
    borderRadius: 6, color: 'var(--text1)', fontSize: 13, padding: '7px 9px',
    outline: 'none', fontFamily: "'JetBrains Mono', monospace", textAlign: 'center',
  },
  actions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tag: {
    background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)',
    borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  tagAmber: { background: 'rgba(255,179,68,0.15)', border: '1px solid var(--amber)', color: 'var(--amber)' },
  tagRed:   { background: 'rgba(255,95,114,0.15)', border: '1px solid var(--red)', color: 'var(--red)' },
  hint: { fontSize: 11, color: 'var(--text3)' },
};
