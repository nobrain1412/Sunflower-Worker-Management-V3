/**
 * Tab "Duyệt nghỉ việc" trong trang Duyệt công nhân.
 *
 * 2 phần:
 *   1) Phân tích bảng vân tay: chọn công ty + kỳ (tháng) → dò công nhân đã không
 *      đi làm >= 3 ngày tính tới ngày cuối bảng → tạo đề xuất nghỉ việc.
 *   2) Hàng đợi đề xuất chờ duyệt: Duyệt (→ CN chuyển nghỉ việc) / Từ chối (gỡ).
 */
import { useState, useMemo } from 'react';
import { useCongTyList } from '../../hooks/useCongNhan';
import {
  useDeXuatNghiViecList, useThangVanTay, usePhanTichNghiViec,
  useTaoDeXuatNghiViec, useGanMaVanTay, useDuyetNghiViec, useTuChoiNghiViec,
} from '../../hooks/useDeXuatNghiViec';

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function DuyetNghiViecTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PhanTichPanel />
      <HangDoiDeXuat />
    </div>
  );
}

// ─── Phần 1: phân tích bảng vân tay ──────────────────────────────────────────
// Các cột có thể sắp xếp trong bảng kết quả (không gồm cột checkbox).
const SORT_COLS = {
  ho_ten: { label: 'Họ tên', type: 'text' },
  ma_van_tay: { label: 'Mã vân tay', type: 'text' },
  trang_thai: { label: 'Trạng thái', type: 'text' },
  ngay_cuoi_cung_di_lam: { label: 'Ngày công cuối', type: 'date' },
  so_ngay_vang: { label: 'Số ngày vắng', type: 'absence' },
};

// So sánh 2 dòng theo cột + hướng. Xử lý riêng các giá trị đặc biệt:
//   - ngay_cuoi_cung_di_lam = null ("Không có công") → xếp như ngày sớm nhất.
//   - so_ngay_vang = null ("Cả kỳ", vắng toàn bộ) → coi là vắng nhiều nhất.
function soSanh(a, b, key, dir) {
  const type = SORT_COLS[key]?.type ?? 'text';
  let x;
  let y;
  if (type === 'absence') {
    x = a[key] == null ? Infinity : a[key];
    y = b[key] == null ? Infinity : b[key];
  } else if (type === 'date') {
    x = a[key] || '';           // 'YYYY-MM-DD' so sánh chuỗi là đúng thứ tự
    y = b[key] || '';
  } else {
    x = a[key] ?? '';
    y = b[key] ?? '';
  }
  let cmp;
  if (type === 'text') cmp = String(x).localeCompare(String(y), 'vi');
  else cmp = x < y ? -1 : x > y ? 1 : 0;
  return dir === 'asc' ? cmp : -cmp;
}

function PhanTichPanel() {
  const [congTyId, setCongTyId] = useState('');
  const [ketQua, setKetQua] = useState(null);
  const [chon, setChon] = useState(() => new Set());
  const [sortBy, setSortBy] = useState({ key: null, dir: 'asc' });

  const congTyQ = useCongTyList();
  const thangQ = useThangVanTay(congTyId ? Number(congTyId) : null);
  const phanTich = usePhanTichNghiViec();
  const taoDeXuat = useTaoDeXuatNghiViec();

  const congTyList = congTyQ.data?.data ?? [];
  const thangList = thangQ.data?.data ?? [];
  // Bỏ chọn kỳ thủ công: luôn phân tích kỳ (bảng vân tay) mới nhất của công ty.
  // listThang trả về đã sắp xếp nam DESC, thang DESC → phần tử đầu là mới nhất.
  const kyMoiNhat = thangList[0] ?? null;

  async function handlePhanTich() {
    if (!congTyId || !kyMoiNhat) return;
    const { thang, nam } = kyMoiNhat;
    try {
      const res = await phanTich.mutateAsync({ cong_ty_id: Number(congTyId), thang, nam });
      const data = res?.data ?? {};
      setKetQua(data);
      setSortBy({ key: null, dir: 'asc' });
      // Mặc định chọn tất cả ứng viên chưa có đề xuất.
      setChon(new Set((data.de_xuat ?? []).filter((d) => !d.da_co_de_xuat).map((d) => d.cong_nhan_id)));
    } catch (err) {
      alert(err?.message ?? 'Phân tích thất bại');
      setKetQua(null);
    }
  }

  async function handleTao() {
    if (!congTyId || !kyMoiNhat || chon.size === 0) return;
    const { thang, nam } = kyMoiNhat;
    try {
      const res = await taoDeXuat.mutateAsync({
        cong_ty_id: Number(congTyId), thang, nam, cong_nhan_ids: [...chon],
      });
      alert(res?.message ?? 'Đã tạo đề xuất');
      setKetQua(null);
      setChon(new Set());
    } catch (err) {
      alert(err?.message ?? 'Tạo đề xuất thất bại');
    }
  }

  function toggle(id) {
    setChon((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Sau khi gán mã + đối chiếu cho 1 CN chưa có mã: gỡ khỏi box dưới, và nếu là
  // ứng viên nghỉ việc thì đưa lên danh sách phía trên (chọn sẵn).
  function handleGanXong(congNhanId, data) {
    const cn = data?.cong_nhan;
    setKetQua((prev) => {
      if (!prev) return prev;
      const khong = (prev.khong_doi_chieu ?? []).filter((k) => k.cong_nhan_id !== congNhanId);
      let deXuatMoi = prev.de_xuat ?? [];
      if (data?.la_ung_vien && cn && !deXuatMoi.some((d) => d.cong_nhan_id === congNhanId)) {
        deXuatMoi = [cn, ...deXuatMoi];
      }
      return { ...prev, de_xuat: deXuatMoi, khong_doi_chieu: khong };
    });

    if (data?.la_ung_vien && cn) {
      if (!cn.da_co_de_xuat) {
        setChon((prev) => new Set(prev).add(congNhanId));
      }
      alert(`${cn.ho_ten}: đã đưa lên danh sách nghỉ việc `
        + `(${cn.so_ngay_vang == null ? 'vắng cả kỳ' : `vắng ${cn.so_ngay_vang} ngày`}).`);
    } else if (cn) {
      const last = cn.ngay_cuoi_cung_di_lam;
      alert(`${cn.ho_ten}: vẫn đang đi làm${last ? ` (ngày công cuối ${fmtDate(last)})` : ''} `
        + '— đã lưu mã, chưa đưa vào danh sách nghỉ việc.');
    }
  }

  // Click tiêu đề cột: cùng cột thì đảo hướng, cột khác thì asc từ đầu.
  function handleSort(key) {
    setSortBy((prev) => (
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    ));
  }

  const deXuat = ketQua?.de_xuat ?? [];
  const khongDoiChieu = ketQua?.khong_doi_chieu ?? [];

  const deXuatSapXep = useMemo(() => {
    if (!sortBy.key) return deXuat;
    return [...deXuat].sort((a, b) => soSanh(a, b, sortBy.key, sortBy.dir));
  }, [deXuat, sortBy]);

  return (
    <div style={s.panel}>
      <div style={s.panelTitle}>🔍 Phân tích nghỉ việc từ bảng vân tay</div>
      <div style={s.panelHint}>
        Dò công nhân không đi làm ≥ 3 ngày tính tới ngày cuối cùng trong bảng vân tay mới nhất của công ty.
      </div>

      <div style={s.filterRow}>
        <select
          className="form-input" style={s.select}
          value={congTyId}
          onChange={(e) => { setCongTyId(e.target.value); setKetQua(null); }}
        >
          <option value="">— Chọn công ty —</option>
          {congTyList.map((c) => <option key={c.id} value={c.id}>{c.ten_cong_ty}</option>)}
        </select>

        <button
          className="btn-primary"
          onClick={handlePhanTich}
          disabled={!congTyId || !kyMoiNhat || phanTich.isPending}
        >
          {phanTich.isPending ? 'Đang dò…' : 'Phân tích'}
        </button>

        {congTyId && (
          <span style={s.kyInfo}>
            {thangList.length === 0
              ? '— Chưa có bảng vân tay —'
              : `Kỳ mới nhất: T${kyMoiNhat.thang}/${kyMoiNhat.nam} (${kyMoiNhat.so_cong_nhan} CN)`}
          </span>
        )}
      </div>

      {ketQua && (
        <div style={{ marginTop: 14 }}>
          <div style={s.resultMeta}>
            Ngày chốt bảng: <b style={{ color: 'var(--text1)' }}>{fmtDate(ketQua.ngay_chot)}</b>
            {' · '}Tìm thấy <b style={{ color: 'var(--red)' }}>{deXuat.length}</b> công nhân nghi đã nghỉ
            {khongDoiChieu.length > 0 && (
              <span style={{ color: 'var(--amber)' }}> · {khongDoiChieu.length} người chưa gán mã (không đối chiếu được)</span>
            )}
          </div>

          {deXuat.length === 0 && khongDoiChieu.length === 0 ? (
            <div style={s.empty}>Không có công nhân nào thoả điều kiện nghỉ việc.</div>
          ) : (
            <>
              {deXuat.length > 0 && (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}></th>
                      {Object.entries(SORT_COLS).map(([key, col]) => {
                        const active = sortBy.key === key;
                        return (
                          <th
                            key={key}
                            style={{ ...s.th, ...s.thSort, ...(active ? s.thActive : null) }}
                            onClick={() => handleSort(key)}
                            title="Bấm để sắp xếp"
                          >
                            {col.label}
                            <span style={s.sortArrow}>{active ? (sortBy.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {deXuatSapXep.map((d) => (
                      <tr key={d.cong_nhan_id} style={d.da_co_de_xuat ? s.trDim : undefined}>
                        <td style={s.td}>
                          <input
                            type="checkbox"
                            checked={chon.has(d.cong_nhan_id)}
                            onChange={() => toggle(d.cong_nhan_id)}
                          />
                        </td>
                        <td style={s.td}>
                          {d.ho_ten}
                          {d.da_co_de_xuat && <span style={s.badgeDim}>đã có đề xuất</span>}
                        </td>
                        <td style={{ ...s.td, fontFamily: "'JetBrains Mono', monospace" }}>{d.ma_van_tay}</td>
                        <td style={s.td}>{d.trang_thai}</td>
                        <td style={s.td}>{d.ngay_cuoi_cung_di_lam ? fmtDate(d.ngay_cuoi_cung_di_lam) : 'Không có công'}</td>
                        <td style={{ ...s.td, textAlign: 'right', color: 'var(--red)', fontWeight: 700 }}>
                          {d.so_ngay_vang == null ? 'Cả kỳ' : `${d.so_ngay_vang} ngày`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
              {deXuat.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn-primary"
                  onClick={handleTao}
                  disabled={chon.size === 0 || taoDeXuat.isPending}
                >
                  {taoDeXuat.isPending ? 'Đang tạo…' : `Tạo ${chon.size} đề xuất nghỉ việc`}
                </button>
              </div>
              )}
              <ChuaGanMaBox
                rows={khongDoiChieu}
                congTyId={congTyId}
                ky={ketQua.ky}
                onKetQua={handleGanXong}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Box: công nhân chưa gán mã vân tay (nhập mã + kiểm tra nghỉ việc) ────────
function ChuaGanMaBox({ rows, congTyId, ky, onKetQua }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div style={{ marginTop: 18 }}>
      <div style={s.subHeader}>
        <span>Công nhân chưa gán mã vân tay</span>
        <span style={s.countBadgeAmber}>{rows.length}</span>
      </div>
      <div style={s.panelHint}>
        Nhập mã vân tay rồi bấm <b>Kiểm tra</b> để đối chiếu với bảng vân tay kỳ này.
        Nếu đã nghỉ việc, công nhân sẽ được đưa lên danh sách phía trên.
      </div>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Họ tên</th>
              <th style={s.th}>Ngày vào</th>
              <th style={s.th}>Trạng thái</th>
              <th style={s.th}>Mã vân tay</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <ChuaGanMaRow
                key={r.cong_nhan_id}
                row={r}
                congTyId={congTyId}
                ky={ky}
                onKetQua={onKetQua}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChuaGanMaRow({ row, congTyId, ky, onKetQua }) {
  const [ma, setMa] = useState('');
  const ganMa = useGanMaVanTay();

  async function handleCheck() {
    const val = ma.trim();
    if (!val || !ky) return;
    try {
      const res = await ganMa.mutateAsync({
        cong_ty_id: Number(congTyId), thang: ky.thang, nam: ky.nam,
        cong_nhan_id: row.cong_nhan_id, ma_van_tay: val,
      });
      onKetQua(row.cong_nhan_id, res?.data ?? {});
    } catch (err) {
      alert(err?.message ?? 'Kiểm tra thất bại');
    }
  }

  return (
    <tr>
      <td style={s.td}>{row.ho_ten}</td>
      <td style={s.td}>{row.ngay_vao_lam ? fmtDate(row.ngay_vao_lam) : '—'}</td>
      <td style={s.td}>{row.trang_thai}</td>
      <td style={s.td}>
        <input
          className="form-input"
          style={s.maInput}
          value={ma}
          onChange={(e) => setMa(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCheck(); }}
          placeholder="Nhập mã…"
          disabled={ganMa.isPending}
        />
      </td>
      <td style={s.td}>
        <button
          className="btn-primary"
          style={s.btnCheck}
          onClick={handleCheck}
          disabled={!ma.trim() || ganMa.isPending}
        >
          {ganMa.isPending ? '…' : 'Kiểm tra'}
        </button>
      </td>
    </tr>
  );
}

// ─── Phần 2: hàng đợi đề xuất chờ duyệt ──────────────────────────────────────
function HangDoiDeXuat() {
  const listQ = useDeXuatNghiViecList('cho_duyet');
  const rows = listQ.data?.data ?? [];

  return (
    <div>
      <div style={s.sectionHeader}>
        <span>Đề xuất chờ duyệt</span>
        <span style={s.countBadge}>{rows.length}</span>
      </div>
      {listQ.isLoading ? (
        <div style={s.empty}>Đang tải…</div>
      ) : rows.length === 0 ? (
        <div style={s.empty}>Chưa có đề xuất nghỉ việc nào.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((dx) => <DeXuatCard key={dx.id} dx={dx} />)}
        </div>
      )}
    </div>
  );
}

function DeXuatCard({ dx }) {
  const duyet = useDuyetNghiViec();
  const tuChoi = useTuChoiNghiViec();
  const busy = duyet.isPending || tuChoi.isPending;

  async function handleDuyet() {
    if (!window.confirm(
      `Duyệt cho "${dx.ho_ten}" nghỉ việc? `
      + `Ngày nghỉ sẽ ghi theo ngày công cuối (${fmtDate(dx.ngay_cuoi_cung_di_lam)}).`,
    )) return;
    try { await duyet.mutateAsync(dx.id); }
    catch (err) { alert(err?.message ?? 'Duyệt thất bại'); }
  }

  async function handleTuChoi() {
    const ghiChu = window.prompt(
      `Từ chối đề xuất nghỉ việc của "${dx.ho_ten}"? Đề xuất sẽ bị gỡ, công nhân giữ nguyên.\n`
      + 'Nhập lý do (tuỳ chọn) rồi bấm OK:', '',
    );
    if (ghiChu === null) return;
    try { await tuChoi.mutateAsync({ id: dx.id, ghi_chu: ghiChu.trim() || null }); }
    catch (err) { alert(err?.message ?? 'Từ chối thất bại'); }
  }

  return (
    <div style={s.card}>
      <div style={s.avatar}>{dx.ho_ten?.[0]?.toUpperCase() ?? '?'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={s.name}>{dx.ho_ten}</div>
        <div style={s.meta}>
          <span>🏭 {dx.ten_cong_ty ?? '—'}</span>
          <span>· 👤 {dx.nguoi_tuyen_ho_ten ?? '—'}</span>
          <span>· 🔢 {dx.ma_van_tay ?? '—'}</span>
        </div>
        <div style={s.meta}>
          <span>Ngày công cuối: {fmtDate(dx.ngay_cuoi_cung_di_lam)}</span>
          <span>· Vắng: <b style={{ color: 'var(--red)' }}>{dx.so_ngay_vang == null ? 'cả kỳ' : `${dx.so_ngay_vang} ngày`}</b></span>
          <span>· Kỳ T{dx.ky_thang}/{dx.ky_nam}</span>
        </div>
      </div>
      <div style={s.actions}>
        <button onClick={handleTuChoi} style={s.btnReject} disabled={busy}>
          {tuChoi.isPending ? '…' : '✕ Từ chối'}
        </button>
        <button onClick={handleDuyet} style={s.btnApprove} disabled={busy}>
          {duyet.isPending ? '…' : '✓ Duyệt nghỉ việc'}
        </button>
      </div>
    </div>
  );
}

const s = {
  panel: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 },
  panelTitle: { fontSize: 14, fontWeight: 700, color: 'var(--text1)' },
  panelHint: { fontSize: 11, color: 'var(--text3)', marginTop: 4, marginBottom: 12 },
  filterRow: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  select: { minWidth: 180, padding: '8px 10px', fontSize: 13 },
  kyInfo: { fontSize: 12, color: 'var(--text2)' },
  resultMeta: { fontSize: 12, color: 'var(--text2)', marginBottom: 10 },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 12, whiteSpace: 'nowrap' },
  th: {
    background: 'var(--bg2)', color: 'var(--text2)', fontWeight: 600, textAlign: 'left',
    padding: '8px 10px', borderBottom: '1px solid var(--border2)', fontSize: 11,
  },
  thSort: { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' },
  thActive: { color: 'var(--text1)' },
  sortArrow: { marginLeft: 6, fontSize: 10, color: 'var(--text3)' },
  td: { padding: '7px 10px', color: 'var(--text1)', borderBottom: '1px solid var(--border)' },
  trDim: { opacity: 0.55 },
  badgeDim: {
    marginLeft: 8, fontSize: 10, fontWeight: 700, color: 'var(--text3)',
    background: 'var(--bg3)', borderRadius: 6, padding: '2px 7px',
  },
  subHeader: {
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
    fontSize: 13, fontWeight: 700, color: 'var(--text1)',
  },
  countBadgeAmber: {
    fontSize: 12, fontWeight: 700, color: 'var(--amber)',
    background: 'rgba(255,179,68,0.12)', borderRadius: 12, padding: '3px 10px',
  },
  maInput: {
    minWidth: 130, padding: '6px 8px', fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
  },
  btnCheck: { padding: '7px 14px', fontSize: 12 },
  sectionHeader: {
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
    fontSize: 14, fontWeight: 700, color: 'var(--text1)',
  },
  countBadge: {
    fontSize: 12, fontWeight: 700, color: 'var(--red)',
    background: 'rgba(255,95,114,0.12)', borderRadius: 12, padding: '3px 10px',
  },
  empty: {
    padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13,
    background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12,
  },
  card: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12, padding: 16,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
    background: 'linear-gradient(135deg, var(--red), var(--amber))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 700, color: '#fff',
  },
  name: { fontSize: 14, fontWeight: 700, color: 'var(--text1)', marginBottom: 4 },
  meta: { fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  actions: { display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' },
  btnApprove: {
    background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 8,
    padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  btnReject: {
    background: 'var(--bg3)', color: 'var(--text1)', border: '1px solid var(--border2)',
    borderRadius: 8, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
};
