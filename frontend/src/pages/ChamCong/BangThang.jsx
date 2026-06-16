/**
 * Bảng tháng — lưới tổng quan + chỉnh sửa đầy đủ.
 * Ô hiển thị tóm tắt (8, 8+2, Đ8, P, V...) và đổi màu theo loại giờ;
 * bấm vào ô → mở popup nhập 4 loại giờ (BucketEditor).
 */
import { useState } from 'react';
import BucketEditor from './BucketEditor';
import {
  WEEKDAYS, summarize, detailText, cellColor, totalGio,
} from './chamCongShared';

export default function BangThang({ rows, dayList, thang, nam, getCell, setCell, isDirtyCell }) {
  const [editing, setEditing] = useState(null); // { pcId, day, ten }

  return (
    <div style={s.card}>
      {rows.length === 0 ? (
        <div style={s.empty}>Không có công nhân nào phù hợp.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, ...s.thSticky, minWidth: 160 }}>Công nhân / Công ty</th>
                {dayList.map((d) => {
                  const dow = new Date(nam, thang - 1, d).getDay();
                  return (
                    <th key={d} style={{ ...s.thDay, color: dow === 0 ? 'var(--red)' : 'var(--text3)' }}>
                      <div style={{ fontSize: 9 }}>{WEEKDAYS[dow]}</div>
                      <div>{d}</div>
                    </th>
                  );
                })}
                <th style={{ ...s.th, minWidth: 70 }}>Tổng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pcId = r.phan_cong_id;
                let tong = 0;
                for (const d of dayList) tong += totalGio(getCell(pcId, d));
                return (
                  <tr key={pcId} style={s.tr}>
                    <td style={s.tdSticky}>
                      <div style={s.cnName}>{r.cong_nhan_ten}</div>
                      <div style={s.cnSub}>🏭 {r.ten_cong_ty || '—'}</div>
                      {(r.ngay_ket_thuc || r.ngay_nghi_viec) && (
                        <div style={{ fontSize: 10, color: 'var(--red)' }}>
                          {r.ngay_ket_thuc ? `Kết thúc: ${r.ngay_ket_thuc.slice(0, 10)}` : ''}
                          {r.ngay_nghi_viec ? ` · Nghỉ việc: ${r.ngay_nghi_viec.slice(0, 10)}` : ''}
                        </div>
                      )}
                    </td>
                    {dayList.map((d) => {
                      const cell = getCell(pcId, d);
                      const col = cellColor(cell);
                      const dirty = isDirtyCell(pcId, d);
                      return (
                        <td key={d} style={s.tdDay}>
                          <button
                            onClick={() => setEditing({ pcId, day: d, ten: r.cong_nhan_ten })}
                            title={`${r.cong_nhan_ten} · ${d}/${thang}: ${detailText(cell)}`}
                            style={{
                              width: 46, height: 30, textAlign: 'center', cursor: 'pointer',
                              background: col.bg, color: col.color,
                              border: `1px solid ${dirty ? 'var(--amber)' : 'var(--border)'}`,
                              borderRadius: 5, fontSize: 11, fontWeight: 600,
                              fontFamily: "'JetBrains Mono', monospace",
                            }}>
                            {summarize(cell) || '·'}
                          </button>
                        </td>
                      );
                    })}
                    <td style={{ ...s.td, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text1)' }}>
                      {tong.toFixed(1)}h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div style={m.overlay} onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div style={m.modal}>
            <div style={m.title}>
              {editing.ten}
              <span style={{ color: 'var(--text3)', fontWeight: 400 }}> · ngày {editing.day}/{thang}/{nam}</span>
            </div>
            <BucketEditor
              value={getCell(editing.pcId, editing.day)}
              onChange={(c) => setCell(editing.pcId, editing.day, c)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn-primary" onClick={() => setEditing(null)}>Xong</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 },
  empty: { padding: 60, textAlign: 'center', color: 'var(--text3)' },
  table: { borderCollapse: 'separate', borderSpacing: 0 },
  th: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase',
    letterSpacing: '0.06em', textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg1)' },
  thSticky: { position: 'sticky', left: 0, zIndex: 1 },
  thDay: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', padding: '4px 2px',
    borderBottom: '1px solid var(--border)', textAlign: 'center', width: 48, background: 'var(--bg1)' },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '4px 8px', borderBottom: '1px solid var(--border)', fontSize: 12 },
  tdSticky: { position: 'sticky', left: 0, background: 'var(--bg1)', padding: '6px 10px',
    borderBottom: '1px solid var(--border)', minWidth: 180, zIndex: 1 },
  tdDay: { padding: '3px 2px', borderBottom: '1px solid var(--border)', textAlign: 'center' },
  cnName: { fontSize: 13, color: 'var(--text1)', fontWeight: 600 },
  cnSub: { fontSize: 11, color: 'var(--text3)' },
};

const m = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 },
  modal: { background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: 16, padding: '22px 24px', width: '100%', maxWidth: 380 },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--text1)', marginBottom: 16 },
};
