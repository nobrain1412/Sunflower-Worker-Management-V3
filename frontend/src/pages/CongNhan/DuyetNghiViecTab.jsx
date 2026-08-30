/**
 * Tab "Duyệt nghỉ việc" trong trang Duyệt công nhân.
 *
 * Luồng:
 *   1) Chọn công ty → phân tích bảng vân tay mới nhất → dò công nhân đã không đi
 *      làm >= 3 ngày. Tích chọn rồi bấm 1 nút để DUYỆT NGHỈ VIỆC trực tiếp hàng loạt.
 *   2) Box dưới: công nhân chưa gán mã vân tay — nhập mã cho từng người rồi bấm 1
 *      nút kiểm tra tất cả; ai đủ điều kiện nghỉ việc được đưa lên danh sách trên.
 */
import { useState, useMemo } from 'react';
import { useCongTyList } from '../../hooks/useCongNhan';
import {
  useThangVanTay, usePhanTichNghiViec, useDuyetTrucTiep, useGanMaHangLoat,
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
    </div>
  );
}

// So sánh 2 dòng theo cột + hướng, theo cấu hình cột `cols`. Xử lý giá trị đặc biệt:
//   - kiểu 'date' null → xếp như ngày sớm nhất.
//   - kiểu 'absence' null ("Cả kỳ", vắng toàn bộ) → coi là vắng nhiều nhất.
function soSanh(a, b, key, dir, cols) {
  const type = cols[key]?.type ?? 'text';
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

// Hook nhỏ quản lý trạng thái sắp xếp + trả hàm sort dùng chung cho 2 bảng.
function useSort(cols) {
  const [sortBy, setSortBy] = useState({ key: null, dir: 'asc' });
  function onSort(key) {
    setSortBy((prev) => (
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    ));
  }
  function apply(rows) {
    if (!sortBy.key) return rows;
    return [...rows].sort((a, b) => soSanh(a, b, sortBy.key, sortBy.dir, cols));
  }
  return { sortBy, onSort, apply, reset: () => setSortBy({ key: null, dir: 'asc' }) };
}

// Tiêu đề cột có thể bấm để sắp xếp.
function SortableTh({ colKey, label, sortBy, onSort }) {
  const active = sortBy.key === colKey;
  return (
    <th
      style={{ ...s.th, ...s.thSort, ...(active ? s.thActive : null) }}
      onClick={() => onSort(colKey)}
      title="Bấm để sắp xếp"
    >
      {label}
      <span style={s.sortArrow}>{active ? (sortBy.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
    </th>
  );
}

// ─── Bảng ứng viên nghỉ việc (tích chọn + duyệt hàng loạt) ────────────────────
const SORT_COLS = {
  ho_ten: { label: 'Họ tên', type: 'text' },
  ma_van_tay: { label: 'Mã vân tay', type: 'text' },
  trang_thai: { label: 'Trạng thái', type: 'text' },
  ngay_cuoi_cung_di_lam: { label: 'Ngày công cuối', type: 'date' },
  so_ngay_vang: { label: 'Số ngày vắng', type: 'absence' },
};

function PhanTichPanel() {
  const [congTyId, setCongTyId] = useState('');
  const [ketQua, setKetQua] = useState(null);
  const [chon, setChon] = useState(() => new Set());
  const sort = useSort(SORT_COLS);

  const congTyQ = useCongTyList();
  const thangQ = useThangVanTay(congTyId ? Number(congTyId) : null);
  const phanTich = usePhanTichNghiViec();
  const duyetTrucTiep = useDuyetTrucTiep();

  const congTyList = congTyQ.data?.data ?? [];
  const thangList = thangQ.data?.data ?? [];
  // Bỏ chọn kỳ thủ công: luôn phân tích kỳ (bảng vân tay) mới nhất của công ty.
  const kyMoiNhat = thangList[0] ?? null;

  async function handlePhanTich() {
    if (!congTyId || !kyMoiNhat) return;
    const { thang, nam } = kyMoiNhat;
    try {
      const res = await phanTich.mutateAsync({ cong_ty_id: Number(congTyId), thang, nam });
      const data = res?.data ?? {};
      setKetQua(data);
      sort.reset();
      // Mặc định chọn tất cả ứng viên chưa có đề xuất.
      setChon(new Set((data.de_xuat ?? []).filter((d) => !d.da_co_de_xuat).map((d) => d.cong_nhan_id)));
    } catch (err) {
      alert(err?.message ?? 'Phân tích thất bại');
      setKetQua(null);
    }
  }

  // Duyệt nghỉ việc TRỰC TIẾP cho tất cả người đang được tích chọn.
  async function handleDuyet() {
    if (!congTyId || !ketQua?.ky || chon.size === 0) return;
    const ids = [...chon];
    if (!window.confirm(
      `Duyệt nghỉ việc cho ${ids.length} công nhân đã chọn?\n`
      + 'Ngày nghỉ ghi theo ngày công cuối của từng người. Thao tác này không hoàn tác được.',
    )) return;
    const { thang, nam } = ketQua.ky;
    try {
      const res = await duyetTrucTiep.mutateAsync({
        cong_ty_id: Number(congTyId), thang, nam, cong_nhan_ids: ids,
      });
      alert(res?.message ?? 'Đã duyệt nghỉ việc');
      // Gỡ những người vừa duyệt khỏi danh sách.
      setKetQua((prev) => (prev
        ? { ...prev, de_xuat: (prev.de_xuat ?? []).filter((d) => !chon.has(d.cong_nhan_id)) }
        : prev));
      setChon(new Set());
    } catch (err) {
      alert(err?.message ?? 'Duyệt thất bại');
    }
  }

  function toggle(id) {
    setChon((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Sau khi kiểm tra hàng loạt các CN chưa có mã: gỡ khỏi box dưới; ai đủ điều
  // kiện nghỉ việc thì đưa lên danh sách trên (chọn sẵn). Báo tổng kết 1 lần.
  function handleGanXongHangLoat(results) {
    const ungVien = results.filter((r) => r.ok && r.la_ung_vien && r.cong_nhan);
    const okSet = new Set(results.filter((r) => r.ok).map((r) => r.cong_nhan_id));

    setKetQua((prev) => {
      if (!prev) return prev;
      const khong = (prev.khong_doi_chieu ?? []).filter((k) => !okSet.has(k.cong_nhan_id));
      let deXuatMoi = prev.de_xuat ?? [];
      for (const r of ungVien) {
        if (!deXuatMoi.some((d) => d.cong_nhan_id === r.cong_nhan_id)) {
          deXuatMoi = [r.cong_nhan, ...deXuatMoi];
        }
      }
      return { ...prev, de_xuat: deXuatMoi, khong_doi_chieu: khong };
    });

    setChon((prev) => {
      const next = new Set(prev);
      for (const r of ungVien) if (!r.cong_nhan.da_co_de_xuat) next.add(r.cong_nhan_id);
      return next;
    });

    const nDiLam = results.filter((r) => r.ok && !r.la_ung_vien).length;
    const loi = results.filter((r) => !r.ok);
    let msg = `Đã kiểm tra ${results.length} công nhân:\n`
      + `• ${ungVien.length} đủ điều kiện nghỉ việc (đã đưa lên danh sách trên)\n`
      + `• ${nDiLam} vẫn đang đi làm (đã lưu mã)`;
    if (loi.length) {
      msg += `\n• ${loi.length} lỗi:\n` + loi.map((r) => `   - ${r.error}`).join('\n');
    }
    alert(msg);
  }

  const deXuat = ketQua?.de_xuat ?? [];
  const khongDoiChieu = ketQua?.khong_doi_chieu ?? [];
  const deXuatSapXep = useMemo(() => sort.apply(deXuat), [deXuat, sort]);

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
                        {Object.entries(SORT_COLS).map(([key, col]) => (
                          <SortableTh
                            key={key}
                            colKey={key}
                            label={col.label}
                            sortBy={sort.sortBy}
                            onSort={sort.onSort}
                          />
                        ))}
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
                    style={s.btnApprove}
                    onClick={handleDuyet}
                    disabled={chon.size === 0 || duyetTrucTiep.isPending}
                  >
                    {duyetTrucTiep.isPending ? 'Đang duyệt…' : `✓ Duyệt nghỉ việc (${chon.size})`}
                  </button>
                </div>
              )}
              <ChuaGanMaBox
                rows={khongDoiChieu}
                congTyId={congTyId}
                ky={ketQua.ky}
                onKetQuaHangLoat={handleGanXongHangLoat}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Box: công nhân chưa gán mã vân tay (nhập mã + kiểm tra hàng loạt) ─────────
const BOX_SORT_COLS = {
  ho_ten: { label: 'Họ tên', type: 'text' },
  ngay_vao_lam: { label: 'Ngày vào', type: 'date' },
  trang_thai: { label: 'Trạng thái', type: 'text' },
};

function ChuaGanMaBox({ rows, congTyId, ky, onKetQuaHangLoat }) {
  const [codes, setCodes] = useState({});   // { [cong_nhan_id]: 'mã' }
  const sort = useSort(BOX_SORT_COLS);
  const ganLo = useGanMaHangLoat();

  const rowsSapXep = useMemo(() => sort.apply(rows ?? []), [rows, sort]);
  const soDaNhap = (rows ?? []).filter((r) => (codes[r.cong_nhan_id] || '').trim()).length;

  if (!rows || rows.length === 0) return null;

  function setCode(id, val) {
    setCodes((prev) => ({ ...prev, [id]: val }));
  }

  async function handleKiemTraTatCa() {
    if (!ky) return;
    const items = (rows ?? [])
      .map((r) => ({ cong_nhan_id: r.cong_nhan_id, ma_van_tay: (codes[r.cong_nhan_id] || '').trim() }))
      .filter((it) => it.ma_van_tay);
    if (items.length === 0) { alert('Chưa nhập mã vân tay cho công nhân nào'); return; }
    try {
      const res = await ganLo.mutateAsync({
        cong_ty_id: Number(congTyId), thang: ky.thang, nam: ky.nam, items,
      });
      onKetQuaHangLoat(res?.data?.ket_qua ?? []);
    } catch (err) {
      alert(err?.message ?? 'Kiểm tra thất bại');
    }
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div style={s.subHeader}>
        <span>Công nhân chưa gán mã vân tay</span>
        <span style={s.countBadgeAmber}>{rows.length}</span>
      </div>
      <div style={s.panelHint}>
        Nhập mã vân tay cho từng người rồi bấm <b>Kiểm tra tất cả</b> để đối chiếu với bảng
        vân tay kỳ này. Ai đã nghỉ việc sẽ được đưa lên danh sách phía trên.
      </div>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {Object.entries(BOX_SORT_COLS).map(([key, col]) => (
                <SortableTh
                  key={key}
                  colKey={key}
                  label={col.label}
                  sortBy={sort.sortBy}
                  onSort={sort.onSort}
                />
              ))}
              <th style={s.th}>Mã vân tay</th>
            </tr>
          </thead>
          <tbody>
            {rowsSapXep.map((r) => (
              <tr key={r.cong_nhan_id}>
                <td style={s.td}>{r.ho_ten}</td>
                <td style={s.td}>{r.ngay_vao_lam ? fmtDate(r.ngay_vao_lam) : '—'}</td>
                <td style={s.td}>{r.trang_thai}</td>
                <td style={s.td}>
                  <input
                    className="form-input"
                    style={s.maInput}
                    value={codes[r.cong_nhan_id] || ''}
                    onChange={(e) => setCode(r.cong_nhan_id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleKiemTraTatCa(); }}
                    placeholder="Nhập mã…"
                    disabled={ganLo.isPending}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn-primary"
          onClick={handleKiemTraTatCa}
          disabled={soDaNhap === 0 || ganLo.isPending}
        >
          {ganLo.isPending ? 'Đang kiểm tra…' : `Kiểm tra tất cả (${soDaNhap})`}
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
  empty: {
    padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13,
    background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12,
  },
  btnApprove: {
    background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 8,
    padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
};
