/**
 * Trang Chấm công — bảng tháng theo công nhân (theo phan_cong).
 *
 * - Admin: thấy tất cả CN, filter theo công ty + người tuyển
 * - Quản lý: scope tự động lọc theo công ty được phân
 * - Edit từng ô → bấm "Lưu thay đổi" mới commit (batch)
 * - Mỗi CN có thể có nhiều dòng nếu chuyển công ty (mỗi phan_cong 1 dòng)
 * - Cell có thể: số giờ (0-24), 'P' = nghỉ phép, 'V' = nghỉ việc, trống = bỏ chấm
 * - Chủ nhật cho phép chấm bình thường
 */
import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChamCongThang, useUpsertChamCong } from '../../hooks/useChamCong';
import { useCongTyList, useVenders } from '../../hooks/useCongNhan';
import { useAuth } from '../../context/AuthContext';

const MONTH_NAMES = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
const WEEKDAYS = ['CN','T2','T3','T4','T5','T6','T7'];

function daysInMonth(thang, nam) {
  return new Date(nam, thang, 0).getDate();
}
function ymd(thang, nam, day) {
  return `${nam}-${String(thang).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

// Convert string cell input → { so_gio, so_gio_ot, ca_lam }
function parseCell(raw) {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === '' || s === '—') return { so_gio: 0, so_gio_ot: 0, ca_lam: null };
  if (s === 'P')  return { so_gio: 0, so_gio_ot: 0, ca_lam: 'nghi_phep' };
  if (s === 'V')  return { so_gio: 0, so_gio_ot: 0, ca_lam: 'nghi_viec' };
  // "8" hoặc "8/2" (giờ thường / OT)
  const parts = s.split('/').map((x) => Number(x.replace(',', '.')));
  if (parts.length === 1 && Number.isFinite(parts[0])) {
    return { so_gio: parts[0], so_gio_ot: 0, ca_lam: 'lam' };
  }
  if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return { so_gio: parts[0], so_gio_ot: parts[1], ca_lam: 'lam' };
  }
  return null;
}

function formatCell(cc) {
  if (!cc) return '';
  if (cc.ca_lam === 'nghi_phep') return 'P';
  if (cc.ca_lam === 'nghi_viec') return 'V';
  const g = Number(cc.so_gio || 0);
  const ot = Number(cc.so_gio_ot || 0);
  if (g === 0 && ot === 0) return '';
  return ot > 0 ? `${g}/${ot}` : `${g}`;
}

function cellColor(cc) {
  if (!cc) return { color: 'var(--text3)', bg: 'transparent' };
  if (cc.ca_lam === 'nghi_phep') return { color: 'var(--amber)', bg: 'rgba(255,179,68,0.12)' };
  if (cc.ca_lam === 'nghi_viec') return { color: 'var(--red)',   bg: 'rgba(255,95,114,0.12)' };
  const ot = Number(cc.so_gio_ot || 0);
  if (ot > 0) return { color: 'var(--accent2)', bg: 'rgba(123,95,255,0.12)' };
  if (Number(cc.so_gio || 0) > 0) return { color: 'var(--accent)', bg: 'rgba(79,124,255,0.12)' };
  return { color: 'var(--text3)', bg: 'transparent' };
}

export default function ChamCong() {
  const { isAdmin, isQuanLy } = useAuth();
  const navigate = useNavigate();
  const canImport = isAdmin || isQuanLy;
  const now = new Date();
  const [thang, setThang] = useState(now.getMonth() + 1);
  const [nam, setNam]     = useState(now.getFullYear());
  const [congTyId, setCongTyId] = useState('');
  const [nguoiTuyenId, setNguoiTuyenId] = useState('');
  const [search, setSearch] = useState('');

  const params = { thang, nam };
  if (congTyId) params.cong_ty_id = congTyId;
  if (nguoiTuyenId) params.nguoi_tuyen_id = nguoiTuyenId;

  const { data: res, isLoading } = useChamCongThang(params);
  const rows = res?.data ?? [];

  const congTyArr = useCongTyList().data?.data ?? [];
  const venderArr = useVenders().data?.data ?? [];

  // edits[phanCongId][day] = raw string from input
  const [edits, setEdits] = useState({});
  const [savingId, setSavingId] = useState(null);
  const upsert = useUpsertChamCong();

  // Khi đổi tháng/filter → clear edits
  useEffect(() => { setEdits({}); }, [thang, nam, congTyId, nguoiTuyenId]);

  const days = daysInMonth(thang, nam);
  const dayList = Array.from({ length: days }, (_, i) => i + 1);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      (r.cong_nhan_ten || '').toLowerCase().includes(q)
      || (r.ten_cong_ty || '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  // Map: phan_cong_id → { day → cell }
  const ccMap = useMemo(() => {
    const out = {};
    for (const r of rows) {
      out[r.phan_cong_id] = {};
      for (const cc of (r.cham_cong || [])) {
        const day = Number((cc.ngay || '').slice(-2));
        out[r.phan_cong_id][day] = cc;
      }
    }
    return out;
  }, [rows]);

  function getCell(phanCongId, day) {
    const e = edits[phanCongId]?.[day];
    if (e !== undefined) return e;
    return formatCell(ccMap[phanCongId]?.[day]);
  }

  function setCell(phanCongId, day, raw) {
    setEdits((prev) => ({
      ...prev,
      [phanCongId]: { ...(prev[phanCongId] || {}), [day]: raw },
    }));
  }

  function isDirty(phanCongId) {
    return !!edits[phanCongId] && Object.keys(edits[phanCongId]).length > 0;
  }

  async function handleSave(row) {
    const phanCongId = row.phan_cong_id;
    const dirty = edits[phanCongId] || {};
    const entries = [];
    for (const [day, raw] of Object.entries(dirty)) {
      const parsed = parseCell(raw);
      if (parsed === null) {
        alert(`Ô ngày ${day} không hợp lệ: "${raw}". Dùng số giờ (vd "8" hoặc "8/2"), 'P' = nghỉ phép, 'V' = nghỉ việc, trống = xoá.`);
        return;
      }
      entries.push({
        ngay: ymd(thang, nam, Number(day)),
        ...parsed,
      });
    }
    if (entries.length === 0) return;

    if (!window.confirm(`Lưu ${entries.length} thay đổi cho ${row.cong_nhan_ten}?\n(Nếu có ngày nghỉ phép/nghỉ việc, người tuyển sẽ nhận thông báo.)`)) {
      return;
    }

    setSavingId(phanCongId);
    try {
      await upsert.mutateAsync({ phan_cong_id: phanCongId, entries });
      // Clear dirty cho dòng này
      setEdits((prev) => {
        const next = { ...prev };
        delete next[phanCongId];
        return next;
      });
    } catch (e) {
      alert(e?.response?.data?.error?.message ?? 'Lỗi lưu chấm công');
    } finally {
      setSavingId(null);
    }
  }

  function handleDiscard(phanCongId) {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[phanCongId];
      return next;
    });
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <div style={s.title}>Chấm công</div>
          <div style={s.subtitle}>
            Số: số giờ (vd 8 hoặc 8/2 = 8 thường + 2 OT). P = nghỉ phép. V = nghỉ việc. Trống = bỏ chấm.
          </div>
        </div>
        {canImport && (
          <button
            className="btn-primary"
            onClick={() => navigate('/cham-cong/import-excel')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            📊 Import vân tay
          </button>
        )}
      </div>

      <div style={s.toolbar}>
        <select className="form-input" style={s.select} value={thang} onChange={(e) => setThang(Number(e.target.value))}>
          {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="form-input" style={s.select} value={nam} onChange={(e) => setNam(Number(e.target.value))}>
          {[nam - 1, nam, nam + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="form-input" style={s.select} value={congTyId} onChange={(e) => setCongTyId(e.target.value)}>
          <option value="">— Mọi công ty —</option>
          {congTyArr.map((c) => <option key={c.id} value={c.id}>{c.ten_cong_ty}</option>)}
        </select>
        {isAdmin && (
          <select className="form-input" style={s.select} value={nguoiTuyenId} onChange={(e) => setNguoiTuyenId(e.target.value)}>
            <option value="">— Mọi người tuyển —</option>
            {venderArr.map((v) => <option key={v.id} value={v.id}>{v.ho_ten}</option>)}
          </select>
        )}
        <input className="form-input" style={{ ...s.select, minWidth: 200 }} placeholder="Tìm tên CN / công ty" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div style={s.card}>
        {isLoading ? (
          <div style={s.empty}>Đang tải...</div>
        ) : filtered.length === 0 ? (
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
                  <th style={{ ...s.th, minWidth: 140 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const dirty = isDirty(r.phan_cong_id);
                  let tongGio = 0;
                  for (const d of dayList) {
                    const raw = getCell(r.phan_cong_id, d);
                    const p = parseCell(raw);
                    if (p) tongGio += (p.so_gio || 0) + (p.so_gio_ot || 0);
                  }
                  return (
                    <tr key={r.phan_cong_id} style={{ ...s.tr, background: dirty ? 'rgba(255,179,68,0.05)' : 'transparent' }}>
                      <td style={{ ...s.tdSticky }}>
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
                        const raw = getCell(r.phan_cong_id, d);
                        const isEdited = edits[r.phan_cong_id]?.[d] !== undefined;
                        const cc = parseCell(raw);
                        const styles = cellColor(cc);
                        return (
                          <td key={d} style={s.tdDay}>
                            <input
                              value={raw}
                              onChange={(e) => setCell(r.phan_cong_id, d, e.target.value)}
                              style={{
                                width: 38, height: 28, textAlign: 'center',
                                background: styles.bg,
                                color: styles.color,
                                border: `1px solid ${isEdited ? 'var(--amber)' : 'var(--border)'}`,
                                borderRadius: 4, fontSize: 12,
                                fontFamily: "'JetBrains Mono', monospace",
                                outline: 'none',
                              }}
                              placeholder="—"
                              title={isEdited ? 'Chưa lưu' : ''}
                            />
                          </td>
                        );
                      })}
                      <td style={{ ...s.td, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text1)' }}>
                        {tongGio.toFixed(1)}h
                      </td>
                      <td style={s.td}>
                        {dirty && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn-primary"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              disabled={savingId === r.phan_cong_id}
                              onClick={() => handleSave(r)}
                            >
                              {savingId === r.phan_cong_id ? 'Đang lưu...' : '💾 Lưu'}
                            </button>
                            <button
                              className="btn-ghost"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              onClick={() => handleDiscard(r.phan_cong_id)}
                            >
                              Bỏ
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 14 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 16, fontWeight: 700, color: 'var(--text1)' },
  subtitle: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  select: { padding: '6px 10px', fontSize: 12 },
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 },
  table: { borderCollapse: 'separate', borderSpacing: 0 },
  th: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase',
    letterSpacing: '0.06em', textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg1)' },
  thSticky: { position: 'sticky', left: 0, zIndex: 1 },
  thDay: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', padding: '4px 2px',
    borderBottom: '1px solid var(--border)', textAlign: 'center', width: 42, background: 'var(--bg1)' },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '4px 8px', borderBottom: '1px solid var(--border)', fontSize: 12 },
  tdSticky: { position: 'sticky', left: 0, background: 'var(--bg1)', padding: '6px 10px',
    borderBottom: '1px solid var(--border)', minWidth: 180, zIndex: 1 },
  tdDay: { padding: '3px 2px', borderBottom: '1px solid var(--border)', textAlign: 'center' },
  cnName: { fontSize: 13, color: 'var(--text1)', fontWeight: 600 },
  cnSub: { fontSize: 11, color: 'var(--text3)' },
  empty: { padding: 60, textAlign: 'center', color: 'var(--text3)' },
};
