import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCongNhanList } from '../../hooks/useCongNhan';

const TRANG_THAI_PILL = {
  cho_duyet: { cls: 'pill-amber',  label: 'Chờ duyệt' },
  doi_viec:  { cls: 'pill-purple', label: 'Đợi việc' },
  dang_lam:  { cls: 'pill-green',  label: 'Đang làm' },
  moi_vao:   { cls: 'pill-blue',   label: 'Mới vào'  },
  nghi_phep: { cls: 'pill-amber',  label: 'Nghỉ phép' },
  nghi_viec: { cls: 'pill-red',    label: 'Nghỉ việc' },
};

// Chọn công nhân để in hồ sơ: tìm theo tên/CCCD/SĐT, chọn nhiều người (kể cả qua
// nhiều lần tìm khác nhau) rồi in tất cả cùng lúc. `selected` là Map(id → công nhân)
// để giữ được người đã chọn dù họ không còn trong kết quả tìm hiện tại.
export default function InHoSoModal({ onClose }) {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Map());

  // Debounce ô tìm kiếm
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError } = useCongNhanList({
    search: search || undefined, limit: 30, page: 1, sort: 'ho_ten', order: 'asc',
  });
  const rows = data?.data ?? [];

  function toggle(cn) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(cn.id)) next.delete(cn.id); else next.set(cn.id, cn);
      return next;
    });
  }
  function remove(id) {
    setSelected((prev) => { const next = new Map(prev); next.delete(id); return next; });
  }

  function inHoSo() {
    if (selected.size === 0) return;
    navigate(`/cong-nhan/in-ho-so?ids=${[...selected.keys()].join(',')}`);
  }

  const chosen = [...selected.values()];

  return (
    <div style={o.overlay} onClick={onClose}>
      <div style={o.modal} onClick={(e) => e.stopPropagation()}>
        <div style={o.header}>
          <div>
            <div style={o.title}>In hồ sơ công nhân</div>
            <div style={o.sub}>Tìm theo tên, CCCD hoặc SĐT — chọn nhiều người để in cùng lúc</div>
          </div>
          <button style={o.close} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={o.controls}>
          <div style={o.searchWrap}>
            <svg style={o.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              className="form-input"
              style={{ paddingLeft: 36 }}
              placeholder="Tìm tên, CCCD, SĐT..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Đã chọn — chip có thể bỏ */}
        {chosen.length > 0 && (
          <div style={o.chips}>
            {chosen.map((cn) => (
              <span key={cn.id} style={o.chip}>
                {cn.ho_ten}
                <button style={o.chipX} onClick={() => remove(cn.id)} title="Bỏ chọn">×</button>
              </span>
            ))}
          </div>
        )}

        <div style={o.body}>
          {isLoading ? (
            <div style={o.center}>Đang tải...</div>
          ) : isError ? (
            <div style={{ ...o.center, color: 'var(--red)' }}>Lỗi tải dữ liệu</div>
          ) : rows.length === 0 ? (
            <div style={o.center}>{search ? 'Không tìm thấy công nhân phù hợp' : 'Nhập tên để tìm công nhân'}</div>
          ) : (
            <div style={o.list}>
              {rows.map((cn) => {
                const pill = TRANG_THAI_PILL[cn.trang_thai] ?? TRANG_THAI_PILL.moi_vao;
                const checked = selected.has(cn.id);
                return (
                  <label key={cn.id} style={{ ...o.item, ...(checked ? o.itemOn : {}) }}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(cn)} style={{ accentColor: 'var(--accent)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={o.itemName}>{cn.ho_ten}</div>
                      <div style={o.itemSub}>
                        {cn.ten_cong_ty ?? 'Chưa phân công'}
                        {cn.cccd ? ` · ${cn.cccd}` : ''}
                      </div>
                    </div>
                    <span className={`pill ${pill.cls}`}>{pill.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div style={o.footer}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>
            Đã chọn <b style={{ color: 'var(--accent)' }}>{selected.size}</b> người
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={onClose}>Hủy</button>
            <button className="btn-primary" onClick={inHoSo} disabled={selected.size === 0}>
              🖨 In hồ sơ ({selected.size})
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
  controls:{ padding: '16px 24px 8px' },
  searchWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchIcon: { position: 'absolute', left: 12, color: 'var(--text3)', pointerEvents: 'none' },
  chips:   { display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 24px 8px' },
  chip:    { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'rgba(79,124,255,0.12)', border: '1px solid rgba(79,124,255,0.3)', borderRadius: 20, padding: '3px 6px 3px 10px' },
  chipX:   { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 16, lineHeight: 1, padding: 0 },
  body:    { flex: 1, overflowY: 'auto', padding: '8px 24px 16px', minHeight: 160 },
  center:  { padding: 36, textAlign: 'center', color: 'var(--text2)', fontSize: 13 },
  list:    { display: 'flex', flexDirection: 'column', gap: 6 },
  item:    { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer' },
  itemOn:  { border: '1px solid var(--accent)', background: 'rgba(79,124,255,0.08)' },
  itemName:{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemSub: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  footer:  { display: 'flex', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--border)', gap: 8 },
};
