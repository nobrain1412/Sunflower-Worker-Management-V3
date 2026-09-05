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
import { useBuVanTay, useKiemTraTangCa } from '../../hooks/useBangVanTay';
import { useCongTyList } from '../../hooks/useCongNhan';
import { MONTH_NAMES } from './chamCongShared';

const LOAI_NGAY_LABEL = { thuong: 'Thường', cn: 'Chủ nhật', le: 'Ngày lễ' };

export const BU_PRINT_KEY = 'bu-van-tay-print';

// Khoá duy nhất cho 1 dòng (mã thẻ + ngày) để tick chọn.
const rowKey = (r) => `${r.card}__${r.ngay_iso}`;

// So sánh 2 ô: số theo trị, chuỗi theo bảng chữ cái tiếng Việt (có nhận diện số trong chuỗi).
function cmpVal(a, b) {
  if (a == null) a = '';
  if (b == null) b = '';
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'vi', { numeric: true });
}

// Sắp xếp bản sao mảng theo { key, dir }; không có key → giữ nguyên thứ tự gốc.
function sortRows(rows, sort) {
  if (!sort?.key) return rows;
  return [...rows].sort((x, y) => {
    const r = cmpVal(x[sort.key], y[sort.key]);
    return sort.dir === 'desc' ? -r : r;
  });
}

// Header có thể bấm để sắp xếp; hiển thị mũi tên trạng thái.
function SortTh({ label, col, sort, onSort, style }) {
  const active = sort.key === col;
  const arrow = !active ? '⇅' : sort.dir === 'asc' ? '▲' : '▼';
  return (
    <th style={{ ...s.th, cursor: 'pointer', userSelect: 'none', ...style }} onClick={() => onSort(col)}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        <span style={{ fontSize: 9, color: active ? 'var(--accent)' : 'var(--text3)' }}>{arrow}</span>
      </span>
    </th>
  );
}

export default function BuVanTay() {
  const navigate = useNavigate();

  const now = new Date();
  const [mode, setMode] = useState('bu');    // 'bu' = bù chấm · 'tang_ca' = kiểm tra tăng ca
  const [thang, setThang] = useState(now.getMonth() + 1);
  const [nam, setNam] = useState(now.getFullYear());
  const [congTyId, setCongTyId] = useState('');
  const [maInput, setMaInput] = useState('');
  const [ma, setMa] = useState('');          // mã đã áp dụng (lọc 1 công nhân)
  const [selected, setSelected] = useState({}); // rowKey -> true
  const [buSort, setBuSort] = useState({ key: null, dir: 'asc' });    // sắp xếp bảng bù chấm
  const [tcSort, setTcSort] = useState({ key: null, dir: 'asc' });    // sắp xếp bảng tăng ca

  // Bấm 1 cột: lần đầu tăng dần, bấm lại đảo chiều.
  const makeSortHandler = (setSort) => (col) =>
    setSort((p) => (p.key === col ? { key: col, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key: col, dir: 'asc' }));
  const onBuSort = makeSortHandler(setBuSort);
  const onTcSort = makeSortHandler(setTcSort);

  const congTyArr = useCongTyList().data?.data ?? [];
  const kyOk = congTyId ? { congTyId, thang, nam, ma: ma || undefined } : {};

  const { data: res, isFetching, isError, error } = useBuVanTay(
    mode === 'bu' ? kyOk : {},
  );
  const tc = useKiemTraTangCa(mode === 'tang_ca' ? kyOk : {});

  const records = res?.data?.records ?? [];
  const congTy = res?.data?.cong_ty ?? '';
  const thieuCot = res?.data?.thieu_cot;
  const soCnCoMa = res?.data?.so_cn_co_ma;

  const tcRows = tc.data?.data?.records ?? [];
  const tcCongTy = tc.data?.data?.cong_ty ?? '';
  const tcCoCot = tc.data?.data?.co_cot;
  const tcSoCnCoMa = tc.data?.data?.so_cn_co_ma;

  const recordsSorted = useMemo(() => sortRows(records, buSort), [records, buSort]);
  const tcRowsSorted = useMemo(() => sortRows(tcRows, tcSort), [tcRows, tcSort]);

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
            {mode === 'bu'
              ? 'Tự phát hiện ngày thiếu chấm (chỉ CN có mã trong danh sách công ty), tick chọn rồi in phiếu (A5).'
              : 'Lọc người có tăng ca nhưng thiếu/không đủ đề xuất tăng ca. Chủ nhật & ngày lễ tính cả ngày.'}
          </div>
        </div>
        <button className="btn-ghost" onClick={() => navigate('/cham-cong')}>← Chấm công</button>
      </div>

      {/* Chọn chế độ */}
      <div style={s.segment}>
        <button style={{ ...s.segBtn, ...(mode === 'bu' ? s.segOn : {}) }} onClick={() => setMode('bu')}>
          🖨 Bù chấm vân tay
        </button>
        <button style={{ ...s.segBtn, ...(mode === 'tang_ca' ? s.segOn : {}) }} onClick={() => setMode('tang_ca')}>
          ⏱ Kiểm tra tăng ca
        </button>
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

      {/* Nội dung — chế độ Kiểm tra tăng ca */}
      {mode === 'tang_ca' ? (
        chuaChonCty ? (
          <div style={s.card}><div style={s.empty}>Chọn một công ty ở trên để bắt đầu.</div></div>
        ) : tc.isFetching ? (
          <div style={s.card}><div style={s.empty}>Đang tải…</div></div>
        ) : tc.isError ? (
          <div style={s.card}><div style={{ ...s.empty, color: 'var(--red)' }}>
            {tc.error?.message || 'Có lỗi khi tải dữ liệu'}
          </div></div>
        ) : !tcCoCot ? (
          <div style={s.card}><div style={{ ...s.empty, color: 'var(--amber)' }}>
            Bảng vân tay kỳ này thiếu cột “Lịch sử chấm vân tay” hoặc “Đề xuất tăng ca” — không kiểm tra được.
          </div></div>
        ) : tcSoCnCoMa === 0 ? (
          <div style={s.card}><div style={{ ...s.empty, color: 'var(--amber)' }}>
            Chưa có công nhân nào của công ty này được gán mã vân tay — không thể đối chiếu.
          </div></div>
        ) : tcRows.length === 0 ? (
          <div style={s.card}><div style={s.empty}>
            Không có ai thiếu đề xuất tăng ca{ma ? ` cho mã “${ma}”` : ''} trong kỳ này. 🎉
          </div></div>
        ) : (
          <>
            <div style={s.resultMeta}>
              {tcCongTy && <b style={{ color: 'var(--text1)' }}>{tcCongTy}</b>} · Có{' '}
              <b style={{ color: 'var(--red)' }}>{tcRows.length}</b> ngày thiếu đề xuất tăng ca
            </div>
            <div style={s.card}>
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <SortTh label="Mã thẻ" col="card" sort={tcSort} onSort={onTcSort} />
                      <SortTh label="Họ tên" col="name" sort={tcSort} onSort={onTcSort} />
                      <SortTh label="Bộ phận" col="dept" sort={tcSort} onSort={onTcSort} />
                      <SortTh label="Ca" col="ca" sort={tcSort} onSort={onTcSort} />
                      <SortTh label="Loại ngày" col="loai_ngay" sort={tcSort} onSort={onTcSort} />
                      <SortTh label="Ngày" col="ngay_iso" sort={tcSort} onSort={onTcSort} />
                      <SortTh label="Giờ về" col="gio_ve" sort={tcSort} onSort={onTcSort} />
                      <SortTh label="TC thực tế (h)" col="tang_ca_thuc_te" sort={tcSort} onSort={onTcSort} />
                      <SortTh label="Đề xuất (h)" col="de_xuat" sort={tcSort} onSort={onTcSort} />
                      <SortTh label="Thiếu (h)" col="thieu" sort={tcSort} onSort={onTcSort} />
                      <SortTh label="Tình trạng" col="loai" sort={tcSort} onSort={onTcSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {tcRowsSorted.map((r, i) => (
                      <tr key={`${r.card}__${r.ngay_iso}`} style={i % 2 ? s.trAlt : undefined}>
                        <td style={{ ...s.td, ...s.mono }}>{r.card}</td>
                        <td style={s.td}>{r.name || ''}</td>
                        <td style={s.td}>{r.dept || ''}</td>
                        <td style={s.td}>{r.ca === 'dem' ? 'Đêm' : 'Ngày'}</td>
                        <td style={s.td}>{LOAI_NGAY_LABEL[r.loai_ngay] || r.loai_ngay}</td>
                        <td style={{ ...s.td, ...s.mono }}>{r.date_str}</td>
                        <td style={{ ...s.td, ...s.mono }}>{r.gio_ve || '—'}</td>
                        <td style={{ ...s.td, ...s.mono }}>{r.tang_ca_thuc_te}</td>
                        <td style={{ ...s.td, ...s.mono }}>{r.de_xuat}</td>
                        <td style={{ ...s.td, ...s.mono, color: 'var(--red)' }}>{r.thieu}</td>
                        <td style={s.td}>
                          <span style={r.loai === 'thieu_de_xuat' ? s.pillRed : s.pillAmber}>
                            {r.loai === 'thieu_de_xuat' ? 'Không có đề xuất' : 'Đề xuất thiếu giờ'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      ) : /* Nội dung — chế độ Bù chấm */ chuaChonCty ? (
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
      ) : soCnCoMa === 0 ? (
        <div style={s.card}><div style={{ ...s.empty, color: 'var(--amber)' }}>
          Chưa có công nhân nào của công ty này được gán mã vân tay — không thể đối chiếu.
          Hãy gán mã vân tay trong hồ sơ công nhân trước.
        </div></div>
      ) : records.length === 0 ? (
        <div style={s.card}><div style={s.empty}>
          Không có ngày nào thiếu chấm{ma ? ` cho mã “${ma}”` : ''} trong kỳ này
          {soCnCoMa != null ? ` (đã đối chiếu ${soCnCoMa} công nhân có mã)` : ''}. 🎉
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
                    <SortTh label="Mã thẻ" col="card" sort={buSort} onSort={onBuSort} />
                    <SortTh label="Họ tên" col="name" sort={buSort} onSort={onBuSort} />
                    <SortTh label="Bộ phận" col="dept" sort={buSort} onSort={onBuSort} />
                    <SortTh label="Ca" col="ca" sort={buSort} onSort={onBuSort} />
                    <SortTh label="Ngày" col="ngay_iso" sort={buSort} onSort={onBuSort} />
                    <SortTh label="Giờ vào" col="start_str" sort={buSort} onSort={onBuSort} />
                    <SortTh label="Giờ ra" col="end_str" sort={buSort} onSort={onBuSort} />
                    <SortTh label="Giờ bù đề xuất" col="bu_str" sort={buSort} onSort={onBuSort} />
                    <SortTh label="Lần thứ" col="order" sort={buSort} onSort={onBuSort} />
                  </tr>
                </thead>
                <tbody>
                  {recordsSorted.map((r, i) => {
                    const k = rowKey(r);
                    return (
                      <tr key={k} style={i % 2 ? s.trAlt : undefined}>
                        <td style={s.td}>
                          <input type="checkbox" checked={!!selected[k]} onChange={() => toggle(r)} />
                        </td>
                        <td style={{ ...s.td, ...s.mono }}>{r.card}</td>
                        <td style={s.td}>{r.name || ''}</td>
                        <td style={s.td}>{r.dept || ''}</td>
                        <td style={s.td}>{r.ca === 'dem' ? 'Đêm' : 'Ngày'}</td>
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

      {/* Thanh in cố định (chỉ chế độ bù chấm) */}
      {mode === 'bu' && selectedRecords.length > 0 && (
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
  segment: { display: 'inline-flex', background: 'var(--bg3)', borderRadius: 10, padding: 3, gap: 3, alignSelf: 'flex-start' },
  segBtn: {
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    color: 'var(--text2)', padding: '7px 14px', borderRadius: 7, fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  segOn: { background: 'var(--accent)', color: '#fff' },
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
  pillRed: {
    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
    background: 'rgba(255,95,114,0.15)', color: 'var(--red)', whiteSpace: 'nowrap',
  },
  pillAmber: {
    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
    background: 'rgba(255,179,68,0.15)', color: 'var(--amber)', whiteSpace: 'nowrap',
  },
  printBar: {
    position: 'sticky', bottom: 12, zIndex: 50,
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12,
    padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  },
};
