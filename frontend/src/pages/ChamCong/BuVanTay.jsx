/**
 * Bù chấm vân tay — sinh phiếu "补卡申请单 / XÁC NHẬN BÙ CHẤM VÂN TAY" từ bảng
 * vân tay đã upload (không cần upload lại Excel).
 *
 * 2 luồng dùng chung 1 màn:
 *   - Cả kỳ:     chọn công ty + tháng → tự quét mọi dòng thiếu chấm.
 *   - 1 công nhân: nhập thêm mã vân tay → chỉ dòng của người đó.
 *
 * Dòng "cần bù" do backend tự phát hiện (ô chấm trống). Người dùng tick chọn lại
 * rồi bấm In — dữ liệu phiếu được đẩy qua sessionStorage sang trang in (khổ A5).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuVanTay } from '../../hooks/useBangVanTay';
import { useCongTyList } from '../../hooks/useCongNhan';
import { MONTH_NAMES } from './chamCongShared';

export const BU_PRINT_KEY = 'bu-van-tay-print';

// Khoá duy nhất cho 1 dòng (mã thẻ + ngày) để tick chọn.
const rowKey = (r) => `${r.card}__${r.ngay_iso}`;

export default function BuVanTay() {
  const navigate = useNavigate();

  const now = new Date();
  const [thang, setThang] = useState(now.getMonth() + 1);
  const [nam, setNam] = useState(now.getFullYear());
  const [congTyId, setCongTyId] = useState('');
  const [maInput, setMaInput] = useState('');
  const [ma, setMa] = useState('');          // mã đã áp dụng (lọc 1 công nhân)
  const [selected, setSelected] = useState({}); // rowKey -> true

  const congTyArr = useCongTyList().data?.data ?? [];

  const { data: res, isFetching, isError, error } = useBuVanTay({
    congTyId: congTyId || undefined, thang, nam, ma: ma || undefined,
  });
  const records = res?.data?.records ?? [];
  const congTy = res?.data?.cong_ty ?? '';
  const thieuCot = res?.data?.thieu_cot;

  // Mặc định tick chọn tất cả dòng cần bù mỗi khi có kết quả mới.
  useEffect(() => {
    const next = {};
    for (const r of records) next[rowKey(r)] = true;
    setSelected(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res]);

  const selectedRecords = useMemo(
    () => records.filter((r) => selected[rowKey(r)]),
    [records, selected],
  );
  const allChecked = records.length > 0 && selectedRecords.length === records.length;

  function toggle(r) {
    setSelected((p) => ({ ...p, [rowKey(r)]: !p[rowKey(r)] }));
  }
  function toggleAll() {
    if (allChecked) { setSelected({}); return; }
    const next = {};
    for (const r of records) next[rowKey(r)] = true;
    setSelected(next);
  }

  function handleIn() {
    if (selectedRecords.length === 0) return;
    const payload = {
      cong_ty: congTy,
      ky: { thang, nam },
      records: selectedRecords,
      created_at: Date.now(),
    };
    sessionStorage.setItem(BU_PRINT_KEY, JSON.stringify(payload));
    navigate('/cham-cong/bu-van-tay/in');
  }

  const chuaChonCty = !congTyId; // backend luôn cần công ty → mọi vai trò đều phải chọn

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <div style={s.title}>Bù chấm vân tay</div>
          <div style={s.subtitle}>
            Tự phát hiện ngày thiếu chấm từ bảng vân tay đã upload. Tick chọn rồi in phiếu (khổ A5).
          </div>
        </div>
        <button className="btn-ghost" onClick={() => navigate('/cham-cong')}>← Chấm công</button>
      </div>

      {/* Bộ lọc */}
      <div style={s.toolbar}>
        <select className="form-input" style={s.select} value={thang} onChange={(e) => setThang(Number(e.target.value))}>
          {MONTH_NAMES.map((mo, i) => <option key={i} value={i + 1}>{mo}</option>)}
        </select>
        <select className="form-input" style={s.select} value={nam} onChange={(e) => setNam(Number(e.target.value))}>
          {[nam - 1, nam, nam + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="form-input" style={s.select} value={congTyId} onChange={(e) => setCongTyId(e.target.value)}>
          <option value="">— Chọn công ty —</option>
          {congTyArr.map((c) => <option key={c.id} value={c.id}>{c.ten_cong_ty}</option>)}
        </select>
        <form
          style={{ display: 'flex', gap: 6 }}
          onSubmit={(e) => { e.preventDefault(); setMa(maInput.trim()); }}
        >
          <input
            className="form-input" style={{ ...s.select, minWidth: 190 }}
            placeholder="Lọc theo mã vân tay (tuỳ chọn)"
            value={maInput} onChange={(e) => setMaInput(e.target.value)}
          />
          {maInput.trim() !== ma && (
            <button type="submit" className="btn-ghost" style={{ fontSize: 12 }}>Áp dụng</button>
          )}
          {ma && (
            <button type="button" className="btn-ghost" style={{ fontSize: 12 }}
              onClick={() => { setMa(''); setMaInput(''); }}>Xoá lọc mã</button>
          )}
        </form>
      </div>

      {/* Nội dung */}
      {chuaChonCty ? (
        <div style={s.card}><div style={s.empty}>Chọn một công ty ở trên để bắt đầu.</div></div>
      ) : isFetching ? (
        <div style={s.card}><div style={s.empty}>Đang tải…</div></div>
      ) : isError ? (
        <div style={s.card}><div style={{ ...s.empty, color: 'var(--red)' }}>
          {error?.message || 'Có lỗi khi tải dữ liệu'}
        </div></div>
      ) : thieuCot ? (
        <div style={s.card}><div style={{ ...s.empty, color: 'var(--amber)' }}>
          Không nhận diện được cột giờ chấm (上班/下班…) trong bảng vân tay kỳ này.
          Không thể tự phát hiện ngày thiếu chấm.
        </div></div>
      ) : records.length === 0 ? (
        <div style={s.card}><div style={s.empty}>
          Không có ngày nào thiếu chấm{ma ? ` cho mã “${ma}”` : ''} trong kỳ này. 🎉
        </div></div>
      ) : (
        <>
          <div style={s.resultMeta}>
            {congTy && <b style={{ color: 'var(--text1)' }}>{congTy}</b>} · Tìm thấy{' '}
            <b style={{ color: 'var(--text1)' }}>{records.length}</b> ngày thiếu chấm · đã chọn{' '}
            <b style={{ color: 'var(--accent)' }}>{selectedRecords.length}</b>
          </div>
          <div style={s.card}>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, width: 34 }}>
                      <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                    </th>
                    <th style={s.th}>Mã thẻ</th>
                    <th style={s.th}>Họ tên</th>
                    <th style={s.th}>Bộ phận</th>
                    <th style={s.th}>Ngày</th>
                    <th style={s.th}>Giờ vào</th>
                    <th style={s.th}>Giờ ra</th>
                    <th style={s.th}>Giờ bù đề xuất</th>
                    <th style={s.th}>Lần thứ</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => {
                    const k = rowKey(r);
                    return (
                      <tr key={k} style={i % 2 ? s.trAlt : undefined}>
                        <td style={s.td}>
                          <input type="checkbox" checked={!!selected[k]} onChange={() => toggle(r)} />
                        </td>
                        <td style={{ ...s.td, ...s.mono }}>{r.card}</td>
                        <td style={s.td}>{r.name || ''}</td>
                        <td style={s.td}>{r.dept || ''}</td>
                        <td style={{ ...s.td, ...s.mono }}>{r.date_str}</td>
                        <td style={{ ...s.td, ...s.mono }}>{r.start_str || '—'}</td>
                        <td style={{ ...s.td, ...s.mono }}>{r.end_str || '—'}</td>
                        <td style={{ ...s.td, ...s.mono, color: 'var(--amber)' }}>{r.bu_str}</td>
                        <td style={{ ...s.td, ...s.mono }}>{r.order}/{r.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Thanh in cố định */}
      {selectedRecords.length > 0 && (
        <div style={s.printBar}>
          <span style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 600 }}>
            {selectedRecords.length} phiếu đã chọn
          </span>
          <div style={{ flex: 1 }} />
          <button className="btn-primary" onClick={handleIn}>🖨 In phiếu bù</button>
        </div>
      )}
    </div>
  );
}

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 14 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 16, fontWeight: 700, color: 'var(--text1)' },
  subtitle: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  select: { padding: '6px 10px', fontSize: 12 },
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 },
  empty: { padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 },
  resultMeta: { fontSize: 12, color: 'var(--text2)' },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 12, whiteSpace: 'nowrap' },
  th: {
    position: 'sticky', top: 0, background: 'var(--bg2)', color: 'var(--text2)',
    fontWeight: 600, textAlign: 'left', padding: '8px 10px',
    borderBottom: '1px solid var(--border2)', fontSize: 11,
  },
  td: { padding: '7px 10px', color: 'var(--text1)', borderBottom: '1px solid var(--border)' },
  mono: { fontFamily: "'JetBrains Mono', monospace" },
  trAlt: { background: 'var(--bg2)' },
  printBar: {
    position: 'sticky', bottom: 12, zIndex: 50,
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12,
    padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  },
};
