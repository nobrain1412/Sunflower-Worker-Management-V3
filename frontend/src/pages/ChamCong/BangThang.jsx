/**
 * Bảng tháng — lưới nhập trực tiếp.
 * CHIA THEO CÔNG TY: mỗi công ty 1 khối bảng riêng.
 *
 * Mỗi công nhân có 2 DÒNG: "HC" (giờ hành chính) và "TC" (tăng ca).
 * Bấm thẳng vào ô rồi gõ số từ bàn phím — KHÔNG còn popup chọn giờ.
 * Dòng HC nhận thêm 'P' (nghỉ phép) / 'V' (nghỉ việc).
 * Tạm thời KHÔNG phân biệt ca ngày / ca đêm — mọi giờ gộp vào 1 bucket.
 */
import { useMemo, useState, useEffect, useRef, Fragment } from 'react';
import { WEEKDAYS, totalGio, isNghi } from './chamCongShared';

function fmtNum(n) {
  const x = Number(n || 0);
  if (!x) return '';
  return Number.isInteger(x) ? String(x) : String(x).replace(/\.0$/, '');
}

// Gộp ca ngày + ca đêm (không phân biệt) để hiển thị 1 con số.
const hcHours = (c) => Number(c?.gio_hc_ngay || 0) + Number(c?.gio_hc_dem || 0);
const tcHours = (c) => Number(c?.gio_tc_ngay || 0) + Number(c?.gio_tc_dem || 0);

// Chuẩn hoá cell về day-only khi ghi (ca đêm = 0).
function normalize(cell, { hc, tc, ca_lam }) {
  return {
    ...cell,
    gio_hc_ngay: hc, gio_hc_dem: 0,
    gio_tc_ngay: tc, gio_tc_dem: 0,
    ca_lam,
  };
}

// Dòng HC: cho phép 'P'/'V' hoặc số giờ.
function parseHc(raw, cell) {
  const v = String(raw).trim();
  if (/^p$/i.test(v)) return normalize(cell, { hc: 0, tc: 0, ca_lam: 'nghi_phep' });
  if (/^v$/i.test(v)) return normalize(cell, { hc: 0, tc: 0, ca_lam: 'nghi_viec' });
  const n = v === '' ? 0 : Number(v);
  const hc = Number.isFinite(n) && n >= 0 ? n : hcHours(cell);
  return normalize(cell, { hc, tc: tcHours(cell), ca_lam: null });
}

// Dòng TC: chỉ nhận số.
function parseTc(raw, cell) {
  const v = String(raw).trim();
  const n = v === '' ? 0 : Number(v);
  const tc = Number.isFinite(n) && n >= 0 ? n : tcHours(cell);
  return normalize(cell, { hc: hcHours(cell), tc, ca_lam: cell?.ca_lam || null });
}

function hcDisplay(cell) {
  if (cell?.ca_lam === 'nghi_phep') return 'P';
  if (cell?.ca_lam === 'nghi_viec') return 'V';
  return fmtNum(hcHours(cell));
}
const tcDisplay = (cell) => fmtNum(tcHours(cell));

// Ô nhập giờ: giữ text cục bộ khi đang gõ (cho phép gõ "1.5"), đồng bộ lại khi mất focus.
function HourInput({ display, disabled, dirty, placeholder, isHc, onCommit }) {
  const [text, setText] = useState(display);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(display); }, [display]);

  return (
    <input
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      inputMode={isHc ? 'text' : 'decimal'}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setText(display); }}
      onChange={(e) => { setText(e.target.value); onCommit(e.target.value); }}
      style={{
        width: 42, height: 22, textAlign: 'center',
        background: disabled ? 'transparent' : 'var(--bg3)',
        color: 'var(--text1)',
        border: `1px solid ${dirty ? 'var(--amber)' : 'var(--border)'}`,
        borderRadius: 4, fontSize: 11, fontWeight: 600,
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
        <b>HC</b> = giờ hành chính · <b>TC</b> = tăng ca · gõ <b>P</b> = nghỉ phép, <b>V</b> = nghỉ việc (ở dòng HC)
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
                  {dayList.map((d) => {
                    const dow = new Date(nam, thang - 1, d).getDay();
                    return (
                      <th key={d} style={{ ...s.thDay, color: dow === 0 ? 'var(--red)' : 'var(--text3)' }}>
                        <div style={{ fontSize: 9 }}>{WEEKDAYS[dow]}</div>
                        <div>{d}</div>
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
                  for (const d of dayList) tong += totalGio(getCell(pcId, d));
                  return (
                    <Fragment key={pcId}>
                      {/* Dòng HC */}
                      <tr>
                        <td rowSpan={2} style={{ ...s.tdName, ...s.stickyName }}>
                          <div style={s.cnName}>{r.cong_nhan_ten}</div>
                          {r.bo_phan && <div style={s.cnSub}>🔧 {r.bo_phan}</div>}
                          {(r.ngay_ket_thuc || r.ngay_nghi_viec) && (
                            <div style={{ fontSize: 10, color: 'var(--red)' }}>
                              {r.ngay_ket_thuc ? `Kết thúc: ${r.ngay_ket_thuc.slice(0, 10)}` : ''}
                              {r.ngay_nghi_viec ? ` · Nghỉ việc: ${r.ngay_nghi_viec.slice(0, 10)}` : ''}
                            </div>
                          )}
                        </td>
                        <td style={{ ...s.tdLabel, ...s.stickyLabel, color: 'var(--accent)' }}>HC</td>
                        {dayList.map((d) => {
                          const cell = getCell(pcId, d);
                          return (
                            <td key={d} style={s.tdDay}>
                              <HourInput
                                isHc display={hcDisplay(cell)} placeholder="HC"
                                disabled={readOnly} dirty={isDirtyCell(pcId, d)}
                                onCommit={(raw) => setCell(pcId, d, parseHc(raw, cell))}
                              />
                            </td>
                          );
                        })}
                        <td rowSpan={2} style={{ ...s.td, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text1)', textAlign: 'center' }}>
                          {tong.toFixed(1)}h
                        </td>
                      </tr>
                      {/* Dòng TC */}
                      <tr>
                        <td style={{ ...s.tdLabel, ...s.stickyLabel, color: 'var(--accent2)', borderBottom: '1px solid var(--border2)' }}>TC</td>
                        {dayList.map((d) => {
                          const cell = getCell(pcId, d);
                          return (
                            <td key={d} style={{ ...s.tdDay, borderBottom: '1px solid var(--border2)' }}>
                              <HourInput
                                display={tcDisplay(cell)} placeholder="TC"
                                disabled={readOnly || isNghi(cell)} dirty={isDirtyCell(pcId, d)}
                                onCommit={(raw) => setCell(pcId, d, parseTc(raw, cell))}
                              />
                            </td>
                          );
                        })}
                      </tr>
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
const LABEL_W = 34;

const s = {
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 },
  empty: { padding: 60, textAlign: 'center', color: 'var(--text3)' },
  legend: { fontSize: 11, color: 'var(--text2)' },
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
