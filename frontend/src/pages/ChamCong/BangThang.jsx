/**
 * Bảng tháng — lưới nhập trực tiếp.
 * CHIA THEO CÔNG TY: mỗi công ty 1 khối bảng riêng.
 *
 * Mỗi công nhân có 4 DÒNG theo BUCKETS: HCN / TCN / HCD / TCD.
 * Bấm thẳng vào ô rồi gõ số. Dòng đầu (HCN) nhận thêm 'P' (nghỉ phép) / 'V' (nghỉ việc).
 * Màu chữ số mỗi dòng lấy từ bucketColor() — cách đều trên dải hue, thêm bucket vẫn phân biệt.
 */
import { useMemo, useState, useEffect, useRef, Fragment } from 'react';
import { WEEKDAYS, BUCKETS, hourColor, totalGio, isNghi } from './chamCongShared';

const PV_COLOR = { P: 'var(--teal)', V: 'var(--red)' };

function fmtNum(n) {
  const x = Number(n || 0);
  if (!x) return '';
  return Number.isInteger(x) ? String(x) : String(x).replace(/\.0$/, '');
}

// Ghi vào 1 bucket, giữ nguyên các bucket khác. Dòng đầu cho P/V (zero mọi giờ).
function parseBucket(raw, cell, key, allowPV) {
  const v = String(raw).trim();
  const base = cell || {};
  if (allowPV && /^p$/i.test(v)) return { ...base, gio_hc_ngay: 0, gio_tc_ngay: 0, gio_hc_dem: 0, gio_tc_dem: 0, ca_lam: 'nghi_phep' };
  if (allowPV && /^v$/i.test(v)) return { ...base, gio_hc_ngay: 0, gio_tc_ngay: 0, gio_hc_dem: 0, gio_tc_dem: 0, ca_lam: 'nghi_viec' };
  const n = v === '' ? 0 : Number(v);
  const val = Number.isFinite(n) && n >= 0 ? n : Number(base[key] || 0);
  return { ...base, [key]: val, ca_lam: null };
}

function bucketDisplay(cell, key, isFirst) {
  if (cell?.ca_lam === 'nghi_phep') return isFirst ? 'P' : '';
  if (cell?.ca_lam === 'nghi_viec') return isFirst ? 'V' : '';
  return fmtNum(Number(cell?.[key] || 0));
}

// Ô nhập giờ: giữ text cục bộ khi đang gõ, đồng bộ lại khi mất focus.
// Không dùng placeholder chữ — ô trống để trống hẳn.
function HourInput({ display, disabled, dirty, color, allowText, onCommit }) {
  const [text, setText] = useState(display);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(display); }, [display]);

  return (
    <input
      value={text}
      disabled={disabled}
      inputMode={allowText ? 'text' : 'decimal'}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setText(display); }}
      onChange={(e) => { setText(e.target.value); onCommit(e.target.value); }}
      style={{
        width: 42, height: 22, textAlign: 'center',
        background: disabled ? 'transparent' : 'var(--bg3)',
        color: color || 'var(--text1)',
        border: `1px solid ${dirty ? 'var(--amber)' : 'var(--border)'}`,
        borderRadius: 4, fontSize: 11, fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace", padding: 0,
      }}
    />
  );
}

export default function BangThang({ rows, dayList, thang, nam, getCell, setCell, isDirtyCell, readOnly = false }) {
  // Gom dòng theo công ty, giữ thứ tự xuất hiện.
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.cong_ty_id ?? 'none';
      if (!map.has(key)) {
        map.set(key, { cong_ty_id: r.cong_ty_id, ten_cong_ty: r.ten_cong_ty, rows: [] });
      }
      map.get(key).rows.push(r);
    }
    return [...map.values()];
  }, [rows]);

  if (rows.length === 0) {
    return <div style={s.card}><div style={s.empty}>Không có công nhân nào phù hợp.</div></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={s.legend}>
        {BUCKETS.map((b) => (
          <span key={b.key} style={{ marginRight: 14 }}>
            <b style={{ color: b.color }}>{b.short}</b> = {b.full.toLowerCase()}
          </span>
        ))}
        · gõ <b style={{ color: PV_COLOR.P }}>P</b> = nghỉ phép,
        {' '}<b style={{ color: PV_COLOR.V }}>V</b> = nghỉ việc (ở dòng {BUCKETS[0].short})
        <div style={{ color: 'var(--text3)', marginTop: 2 }}>8h (đủ công) để màu trắng; ngày lệch giờ (4h/6h/10h…) tô màu nổi bật để dễ soi.</div>
      </div>
      {groups.map((g) => (
        <div key={g.cong_ty_id ?? 'none'} style={s.card}>
          <div style={s.groupHeader}>
            <span style={s.groupTitle}>🏭 {g.ten_cong_ty || 'Chưa gán công ty'}</span>
            <span style={s.groupCount}>{g.rows.length} công nhân</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={{ ...s.th, ...s.stickyName }}>Công nhân</th>
                  <th style={{ ...s.th, ...s.stickyLabel }}></th>
                  {dayList.map((day, idx) => {
                    const boundary = idx === 0 || day.d === 1; // đầu kỳ hoặc sang tháng mới
                    return (
                      <th key={day.iso} style={{ ...s.thDay, color: day.dow === 0 ? 'var(--red)' : 'var(--text3)' }}>
                        <div style={{ fontSize: 9 }}>{WEEKDAYS[day.dow]}</div>
                        <div>{day.d}</div>
                        <div style={{ fontSize: 8, color: 'var(--text3)', height: 10 }}>{boundary ? `Th${day.m}` : ''}</div>
                      </th>
                    );
                  })}
                  <th style={{ ...s.th, minWidth: 60 }}>Tổng</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => {
                  const pcId = r.phan_cong_id;
                  let tong = 0;
                  for (const day of dayList) tong += totalGio(getCell(pcId, day.iso));
                  return (
                    <Fragment key={pcId}>
                      {BUCKETS.map((b, bi) => {
                        const isFirst = bi === 0;
                        const isLast = bi === BUCKETS.length - 1;
                        const rowBorder = isLast ? '1px solid var(--border2)' : undefined;
                        return (
                          <tr key={b.key}>
                            {isFirst && (
                              <td rowSpan={BUCKETS.length} style={{ ...s.tdName, ...s.stickyName }}>
                                <div style={s.cnName}>{r.cong_nhan_ten}</div>
                                {r.bo_phan && <div style={s.cnSub}>🔧 {r.bo_phan}</div>}
                                {(r.ngay_ket_thuc || r.ngay_nghi_viec) && (
                                  <div style={{ fontSize: 10, color: 'var(--red)' }}>
                                    {r.ngay_ket_thuc ? `Kết thúc: ${r.ngay_ket_thuc.slice(0, 10)}` : ''}
                                    {r.ngay_nghi_viec ? ` · Nghỉ việc: ${r.ngay_nghi_viec.slice(0, 10)}` : ''}
                                  </div>
                                )}
                              </td>
                            )}
                            <td style={{ ...s.tdLabel, ...s.stickyLabel, color: b.color, borderBottom: rowBorder }}>
                              {b.short}
                            </td>
                            {dayList.map((day) => {
                              const cell = getCell(pcId, day.iso);
                              const disp = bucketDisplay(cell, b.key, isFirst);
                              // Màu số THEO GIÁ TRỊ giờ (ngày 4h khác ngày 8h); P/V dùng màu riêng.
                              const color = PV_COLOR[disp] || hourColor(Number(cell?.[b.key] || 0), b.night) || 'var(--text3)';
                              const disabled = readOnly || (!isFirst && isNghi(cell));
                              return (
                                <td key={day.iso} style={{ ...s.tdDay, borderBottom: rowBorder }}>
                                  <HourInput
                                    display={disp} color={color} allowText={isFirst}
                                    disabled={disabled} dirty={isDirtyCell(pcId, day.iso)}
                                    onCommit={(raw) => setCell(pcId, day.iso, parseBucket(raw, cell, b.key, isFirst))}
                                  />
                                </td>
                              );
                            })}
                            {isFirst && (
                              <td rowSpan={BUCKETS.length} style={{ ...s.td, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text1)', textAlign: 'center' }}>
                                {tong.toFixed(1)}h
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

const NAME_W = 150;
const LABEL_W = 40;

const s = {
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 },
  empty: { padding: 60, textAlign: 'center', color: 'var(--text3)' },
  legend: { fontSize: 11, color: 'var(--text2)', lineHeight: 1.8 },
  groupHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  groupTitle: { fontSize: 14, fontWeight: 700, color: 'var(--text1)' },
  groupCount: { fontSize: 11, color: 'var(--text3)' },
  table: { borderCollapse: 'separate', borderSpacing: 0 },
  th: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase',
    letterSpacing: '0.06em', textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg1)' },
  thDay: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', padding: '4px 2px',
    borderBottom: '1px solid var(--border)', textAlign: 'center', width: 48, background: 'var(--bg1)' },
  stickyName: { position: 'sticky', left: 0, width: NAME_W, minWidth: NAME_W, maxWidth: NAME_W, boxSizing: 'border-box', zIndex: 2, background: 'var(--bg1)' },
  stickyLabel: { position: 'sticky', left: NAME_W, width: LABEL_W, minWidth: LABEL_W, maxWidth: LABEL_W, boxSizing: 'border-box', zIndex: 2, background: 'var(--bg1)' },
  tdName: { padding: '6px 10px', borderBottom: '1px solid var(--border2)', verticalAlign: 'top' },
  tdLabel: { padding: '3px 6px', fontSize: 10, fontWeight: 700, textAlign: 'center' },
  td: { padding: '4px 8px', borderBottom: '1px solid var(--border)', fontSize: 12 },
  tdDay: { padding: '3px 2px', textAlign: 'center' },
  cnName: { fontSize: 13, color: 'var(--text1)', fontWeight: 600 },
  cnSub: { fontSize: 11, color: 'var(--text3)' },
};
