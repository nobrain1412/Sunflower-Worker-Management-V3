/**
 * Trình nhập chấm công 1 ngày:
 *   - Các loại giờ (HC ngày / TC ngày / HC đêm / TC đêm) — chỉ hiện bucket của công ty đó.
 *   - 3 mốc giờ chấm: giờ đến / nghỉ trưa / giờ về (thường lấy từ import vân tay).
 *   - Nút nghỉ phép / nghỉ việc / xoá.
 *
 * Props:
 *   value, onChange        — cell hiện tại + callback
 *   columns                — mảng bucket key hiển thị (mặc định cả 4)
 *   readOnly               — chỉ xem (người tuyển): render text, ẩn nút
 *   compact                — bớt hint
 */
import { BUCKETS, TIME_FIELDS, emptyCell } from './chamCongShared';

export default function BucketEditor({ value, onChange, columns, readOnly = false, compact = false }) {
  const cell = value || emptyCell();
  const buckets = columns ? BUCKETS.filter((b) => columns.includes(b.key)) : BUCKETS;

  function setBucket(key, raw) {
    const num = raw === '' ? 0 : Number(raw);
    onChange({ ...emptyCell(), ...cell, ca_lam: null, [key]: Number.isFinite(num) && num >= 0 ? num : 0 });
  }

  function setTime(key, raw) {
    onChange({ ...emptyCell(), ...cell, [key]: raw });
  }

  function setNghi(loai) {
    // Toggle: bấm lại loại đang chọn → bỏ. Giữ lại mốc giờ chấm đã có.
    onChange(cell.ca_lam === loai
      ? { ...emptyCell(), gio_den: cell.gio_den, gio_nghi_trua: cell.gio_nghi_trua, gio_ve: cell.gio_ve }
      : { ...emptyCell(), gio_den: cell.gio_den, gio_nghi_trua: cell.gio_nghi_trua, gio_ve: cell.gio_ve, ca_lam: loai });
  }

  const isNghi = cell.ca_lam === 'nghi_phep' || cell.ca_lam === 'nghi_viec';

  return (
    <div style={s.wrap}>
      {/* Mốc giờ chấm */}
      <div style={s.section}>
        <div style={s.sectionLabel}>Giờ chấm</div>
        <div style={s.grid3}>
          {TIME_FIELDS.map((f) => (
            <div key={f.key} style={s.field}>
              <label style={{ ...s.label, color: f.color }}>{f.label}</label>
              {readOnly ? (
                <div style={s.readVal}>{cell[f.key] || '—'}</div>
              ) : (
                <input
                  type="time"
                  value={cell[f.key] || ''}
                  onChange={(e) => setTime(f.key, e.target.value)}
                  style={s.input}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Loại giờ */}
      <div style={s.section}>
        <div style={s.sectionLabel}>Số giờ công</div>
        <div style={s.grid}>
          {buckets.map((b) => (
            <div key={b.key} style={s.field}>
              <label style={{ ...s.label, color: b.color }}>{b.label}</label>
              {readOnly ? (
                <div style={s.readVal}>{isNghi ? '—' : (cell[b.key] || 0)}</div>
              ) : (
                <input
                  type="number" min="0" max="24" step="0.5"
                  value={isNghi ? '' : (cell[b.key] || '')}
                  disabled={isNghi}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setBucket(b.key, e.target.value)}
                  placeholder="0"
                  style={{ ...s.input, opacity: isNghi ? 0.4 : 1 }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {!readOnly && (
        <div style={s.actions}>
          <button type="button" onClick={() => setNghi('nghi_phep')}
            style={{ ...s.tag, ...(cell.ca_lam === 'nghi_phep' ? s.tagAmber : {}) }}>Nghỉ phép</button>
          <button type="button" onClick={() => setNghi('nghi_viec')}
            style={{ ...s.tag, ...(cell.ca_lam === 'nghi_viec' ? s.tagRed : {}) }}>Nghỉ việc</button>
          <button type="button" onClick={() => onChange(emptyCell())} style={s.tag}>Xoá</button>
        </div>
      )}
      {readOnly && isNghi && (
        <div style={s.hint}>{cell.ca_lam === 'nghi_phep' ? 'Nghỉ phép' : 'Nghỉ việc'}</div>
      )}
      {!compact && !readOnly && (
        <div style={s.hint}>Để trống = chưa chấm. Nghỉ phép/việc sẽ thông báo cho người tuyển.</div>
      )}
    </div>
  );
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  section: { display: 'flex', flexDirection: 'column', gap: 6 },
  sectionLabel: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
  field: { display: 'flex', flexDirection: 'column', gap: 3 },
  label: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: {
    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)',
    borderRadius: 6, color: 'var(--text1)', fontSize: 13, padding: '7px 9px',
    outline: 'none', fontFamily: "'JetBrains Mono', monospace", textAlign: 'center',
  },
  readVal: {
    width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--text1)', fontSize: 13, padding: '7px 9px',
    fontFamily: "'JetBrains Mono', monospace", textAlign: 'center',
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
