import { useState, useMemo } from 'react';
import { useCongNhanList, useCongTyList, useGanCongTyHangLoat } from '../../hooks/useCongNhan';
import { useAuth } from '../../context/AuthContext';

const TRANG_THAI_PILL = {
  cho_duyet: { cls: 'pill-amber',  label: 'Chờ duyệt' },
  doi_viec:  { cls: 'pill-purple', label: 'Đợi việc' },
  dang_lam:  { cls: 'pill-green',  label: 'Đang làm' },
  moi_vao:   { cls: 'pill-blue',   label: 'Mới vào'  },
  nghi_phep: { cls: 'pill-amber',  label: 'Nghỉ phép' },
  nghi_viec: { cls: 'pill-red',    label: 'Nghỉ việc' },
};

// Gán công ty hàng loạt cho công nhân chưa có công ty.
export default function GanCongTyModal({ onClose }) {
  const { user, isQuanLy } = useAuth();
  const congTyArr = useCongTyList().data?.data ?? [];
  const ganMutation = useGanCongTyHangLoat();

  // Lấy CN chưa có công ty trong phạm vi quyền của user
  const { data, isLoading, isError } = useCongNhanList({
    cong_ty_id: '__empty__', limit: 100, page: 1, sort: 'ho_ten', order: 'asc',
  });
  const rows = data?.data ?? [];

  const [selected, setSelected] = useState(() => new Set());
  const [congTyId, setCongTyId] = useState('');
  const [trangThai, setTrangThai] = useState('moi_vao');
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);

  const congTyOptions = useMemo(() => {
    if (isQuanLy) {
      const ids = user?.cong_ty_ids ?? [];
      return congTyArr.filter((c) => ids.includes(c.id));
    }
    return congTyArr;
  }, [congTyArr, isQuanLy, user]);

  const allIds = rows.map((r) => r.id);
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleOne(id) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(allIds));
  }

  async function handleSubmit() {
    setErr('');
    if (selected.size === 0) { setErr('Vui lòng chọn ít nhất 1 công nhân'); return; }
    if (!congTyId) { setErr('Vui lòng chọn công ty'); return; }
    try {
      const res = await ganMutation.mutateAsync({
        ids: [...selected],
        cong_ty_id: parseInt(congTyId, 10),
        trang_thai: trangThai,
      });
      // api interceptor trả thẳng body { success, data, message } → kết quả ở res.data
      setResult(res?.data ?? { assigned: selected.size, skipped: [] });
    } catch (e) {
      setErr(e?.message ?? 'Có lỗi xảy ra');
    }
  }

  // Màn hình kết quả
  if (result) {
    return (
      <div style={o.overlay} onClick={onClose}>
        <div style={o.modal} onClick={(e) => e.stopPropagation()}>
          <div style={sc.root}>
            <div style={sc.icon}>✅</div>
            <div style={sc.title}>Đã gán công ty!</div>
            <div style={sc.sub}>
              Gán thành công <b>{result.assigned}</b> công nhân
              {result.skipped?.length ? <> · bỏ qua <b>{result.skipped.length}</b></> : null}
            </div>
            {result.skipped?.length > 0 && (
              <div style={sc.skipBox}>
                {result.skipped.map((s) => (
                  <div key={s.id} style={sc.skipRow}>CN #{s.id}: {s.reason}</div>
                ))}
              </div>
            )}
            <div style={sc.actions}>
              <button className="btn-primary" onClick={onClose}>Hoàn tất</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={o.overlay} onClick={onClose}>
      <div style={o.modal} onClick={(e) => e.stopPropagation()}>
        <div style={o.header}>
          <div>
            <div style={o.title}>Gán công ty nhanh</div>
            <div style={o.sub}>Chọn công nhân chưa có công ty và gán hàng loạt</div>
          </div>
          <button style={o.close} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={o.controls}>
          <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="form-label">Công ty *</label>
            <select className="form-input" value={congTyId} onChange={(e) => setCongTyId(e.target.value)}>
              <option value="">— Chọn công ty —</option>
              {congTyOptions.map((ct) => <option key={ct.id} value={ct.id}>{ct.ten_cong_ty}</option>)}
            </select>
          </div>
          <div style={{ width: 150, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="form-label">Trạng thái sau gán</label>
            <select className="form-input" value={trangThai} onChange={(e) => setTrangThai(e.target.value)}>
              <option value="moi_vao">Mới vào (vào làm)</option>
              <option value="doi_viec">Đợi việc (chờ duyệt)</option>
            </select>
          </div>
        </div>

        <div style={o.body}>
          {isLoading ? (
            <div style={o.center}>Đang tải...</div>
          ) : isError ? (
            <div style={{ ...o.center, color: 'var(--red)' }}>Lỗi tải dữ liệu</div>
          ) : rows.length === 0 ? (
            <div style={o.center}>🎉 Không còn công nhân nào chưa có công ty</div>
          ) : (
            <>
              <label style={o.selectAll}>
                <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                Chọn tất cả ({rows.length}) · đã chọn <b style={{ color: 'var(--accent)' }}>{selected.size}</b>
              </label>
              <div style={o.list}>
                {rows.map((cn) => {
                  const pill = TRANG_THAI_PILL[cn.trang_thai] ?? TRANG_THAI_PILL.moi_vao;
                  const checked = selected.has(cn.id);
                  return (
                    <label key={cn.id} style={{ ...o.item, ...(checked ? o.itemOn : {}) }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleOne(cn.id)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={o.itemName}>{cn.ho_ten}</div>
                        <div style={o.itemSub}>
                          {cn.cccd ?? cn.so_dien_thoai ?? '—'}
                          {cn.nguoi_tuyen_ho_ten ? ` · ${cn.nguoi_tuyen_ho_ten}` : ''}
                        </div>
                      </div>
                      <span className={`pill ${pill.cls}`}>{pill.label}</span>
                    </label>
                  );
                })}
              </div>
              {rows.length >= 100 && (
                <div style={o.note}>Hiển thị 100 CN đầu tiên. Gán bớt rồi mở lại để xử lý tiếp.</div>
              )}
            </>
          )}
        </div>

        {err && <div style={o.errBox}>{err}</div>}

        <div style={o.footer}>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={onClose}>Hủy</button>
            <button className="btn-primary" onClick={handleSubmit}
              disabled={ganMutation.isPending || selected.size === 0 || !congTyId}>
              {ganMutation.isPending ? 'Đang gán...' : `Gán ${selected.size} công nhân`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const o = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' },
  modal:   { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', fontFamily: "'Be Vietnam Pro', sans-serif" },
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' },
  title:   { fontSize: 16, fontWeight: 700, color: 'var(--text1)' },
  sub:     { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  close:   { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 4 },
  controls:{ display: 'flex', gap: 14, padding: '16px 24px 8px', flexWrap: 'wrap' },
  body:    { flex: 1, overflowY: 'auto', padding: '8px 24px 16px', minHeight: 120 },
  center:  { padding: 36, textAlign: 'center', color: 'var(--text2)', fontSize: 13 },
  selectAll: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)', padding: '6px 0 10px', cursor: 'pointer' },
  list:    { display: 'flex', flexDirection: 'column', gap: 6 },
  item:    { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer' },
  itemOn:  { border: '1px solid var(--accent)', background: 'rgba(79,124,255,0.08)' },
  itemName:{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemSub: { fontSize: 11, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 },
  note:    { fontSize: 11, color: 'var(--amber)', marginTop: 10 },
  errBox:  { margin: '0 24px', padding: '10px 14px', background: 'rgba(255,95,114,0.08)', border: '1px solid rgba(255,95,114,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--red)' },
  footer:  { display: 'flex', padding: '16px 24px', borderTop: '1px solid var(--border)', gap: 8 },
};

const sc = {
  root:    { padding: '36px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
  icon:    { fontSize: 48, marginBottom: 12 },
  title:   { fontSize: 20, fontWeight: 700, color: 'var(--text1)' },
  sub:     { fontSize: 13, color: 'var(--text2)', marginTop: 6 },
  skipBox: { marginTop: 14, width: '100%', maxHeight: 140, overflowY: 'auto', textAlign: 'left', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' },
  skipRow: { fontSize: 11, color: 'var(--amber)', padding: '2px 0' },
  actions: { display: 'flex', gap: 10, marginTop: 24 },
};
