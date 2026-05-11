import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useGiaoDichList, useTongThang, useTaoGiaoDich, useXoaGiaoDich, useDanhMuc, useTaoDanhMuc, useCapNhatDanhMuc } from '../../hooks/useTaiChinh';
import { useTongTheoThang } from '../../hooks/useDashboard';
import { useAuth } from '../../context/AuthContext';

// Mới: chỉ còn 3 nhóm chính. Phân loại nhỏ chuyển sang `danh_muc_id`.
const LOAI_MAIN = ['thu', 'chi', 'tieu'];
const LOAI_ALL  = LOAI_MAIN; // chỉ filter theo 3 nhóm này

const LOAI_LABEL = {
  thu:  { label: 'Thu',  type: 'thu', color: 'var(--green)' },
  chi:  { label: 'Chi',  type: 'chi', color: 'var(--red)'   },
  tieu: { label: 'Tiêu', type: 'tieu',color: 'var(--accent)'},
  // Tương thích ngược (dữ liệu cũ)
  luong:          { label: 'Lương',         type: 'thu', color: 'var(--green)'  },
  thuong:         { label: 'Thưởng',         type: 'thu', color: 'var(--green)'  },
  phu_cap:        { label: 'Phụ cấp',       type: 'thu', color: 'var(--teal)'   },
  hoan_ung:       { label: 'Hoàn ứng',      type: 'thu', color: 'var(--teal)'   },
  khau_tru:       { label: 'Khấu trừ',      type: 'chi', color: 'var(--red)'    },
  tam_ung:        { label: 'Tạm ứng',       type: 'chi', color: 'var(--amber)'  },
  tien_phong_ktx: { label: 'Tiền phòng KTX',type: 'chi', color: 'var(--amber)'  },
  bao_hiem:       { label: 'Bảo hiểm',      type: 'chi', color: 'var(--red)'    },
  dong_phuc:      { label: 'Đồng phục',     type: 'chi', color: 'var(--amber)'  },
  phat_nghi:      { label: 'Phạt nghỉ',     type: 'chi', color: 'var(--red)'    },
  khac:           { label: 'Khác',           type: 'chi', color: 'var(--text2)'  },
};

function fmt(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }

// ─── Modal thêm giao dịch ─────────────────────────────────
function AddGiaoDichModal({ onClose, isVender }) {
  const tao = useTaoGiaoDich();
  const { data: dmRes } = useDanhMuc();
  const dmList = dmRes?.data ?? [];
  const now = new Date();
  const [form, setForm] = useState({
    loai: isVender ? 'tam_ung' : 'thu', so_tien: '', ngay: now.toISOString().split('T')[0],
    ghi_chu: '', danh_muc_id: '',
  });
  const [err, setErr] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };
      // Đổi loại chính → reset danh mục để tránh lệch
      if (name === 'loai') next.danh_muc_id = '';
      return next;
    });
  }

  async function handle() {
    setErr('');
    if (!form.so_tien || parseFloat(form.so_tien) <= 0) { setErr('Vui lòng nhập số tiền hợp lệ'); return; }
    try {
      await tao.mutateAsync({
        loai: form.loai,
        so_tien: parseFloat(form.so_tien),
        ngay: form.ngay,
        ghi_chu: form.ghi_chu || undefined,
        danh_muc_id: form.danh_muc_id ? parseInt(form.danh_muc_id, 10) : undefined,
      });
      onClose();
    } catch (e) { setErr(e?.response?.data?.error?.message ?? 'Lỗi không xác định'); }
  }

  // Hiển thị danh mục đúng theo loại chính đã chọn (thu/chi/tieu)
  const dmFiltered = dmList.filter((d) => d.loai === form.loai);

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={M.modal}>
        <div style={M.title}>Thêm giao dịch</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="form-label">Loại *</label>
            <select className="form-input" name="loai" value={form.loai} onChange={handleChange} disabled={isVender}>
              {isVender ? (
                <option value="tam_ung">↓ Tạm ứng</option>
              ) : (
                <>
                  <option value="thu">↑ Thu</option>
                  <option value="chi">↓ Chi</option>
                  <option value="tieu">· Tiêu</option>
                </>
              )}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="form-label">Danh mục</label>
            <select className="form-input" name="danh_muc_id" value={form.danh_muc_id} onChange={handleChange}>
              <option value="">— Không chọn —</option>
              {dmFiltered.map((d) => <option key={d.id} value={d.id}>{d.ten}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="form-label">Số tiền *</label>
            <input className="form-input" type="number" name="so_tien" value={form.so_tien} onChange={handleChange} placeholder="0" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="form-label">Ngày</label>
            <input className="form-input" type="date" name="ngay" value={form.ngay} onChange={handleChange} />
          </div>
          <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="form-label">Ghi chú</label>
            <input className="form-input" name="ghi_chu" value={form.ghi_chu} onChange={handleChange} placeholder="Nội dung..." />
          </div>
        </div>
        {err && <div style={M.err}>{err}</div>}
        <div style={M.actions}>
          <button className="btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={handle} disabled={tao.isPending}>{tao.isPending ? 'Đang lưu...' : 'Thêm giao dịch'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal quản lý danh mục ───────────────────────────────
function DanhMucModal({ onClose }) {
  const { data: dmRes } = useDanhMuc();
  const dmList = dmRes?.data ?? [];
  const tao = useTaoDanhMuc();
  const capNhat = useCapNhatDanhMuc();
  const [form, setForm] = useState({ ten: '', loai: 'chi', mo_ta: '' });
  const [err, setErr] = useState('');

  async function handleAdd() {
    setErr('');
    if (!form.ten.trim()) { setErr('Vui lòng nhập tên danh mục'); return; }
    try { await tao.mutateAsync(form); setForm({ ten: '', loai: 'chi', mo_ta: '' }); }
    catch (e) { setErr(e?.response?.data?.error?.message ?? 'Lỗi'); }
  }

  async function handleToggleActive(dm) {
    await capNhat.mutateAsync({ id: dm.id, active: !dm.active });
  }

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...M.modal, maxWidth: 520 }}>
        <div style={M.title}>Quản lý danh mục</div>
        {/* Thêm mới */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 10 }}>
          <input className="form-input" placeholder="Tên danh mục..." value={form.ten} onChange={(e) => setForm((f) => ({ ...f, ten: e.target.value }))} />
          <select className="form-input" value={form.loai} onChange={(e) => setForm((f) => ({ ...f, loai: e.target.value }))}>
            <option value="thu">Thu</option>
            <option value="chi">Chi</option>
            <option value="tieu">Tiêu</option>
          </select>
        </div>
        {err && <div style={M.err}>{err}</div>}
        <button className="btn-primary" style={{ marginBottom: 16, fontSize: 12, padding: '6px 14px' }} onClick={handleAdd} disabled={tao.isPending}>+ Thêm danh mục</button>
        {/* Danh sách */}
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {['thu','chi','tieu'].map((loai) => {
            const items = dmList.filter((d) => d.loai === loai);
            if (!items.length) return null;
            return (
              <div key={loai} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  {loai === 'thu' ? '↑ Thu' : loai === 'chi' ? '↓ Chi' : '· Tiêu'}
                </div>
                {items.map((dm) => (
                  <div key={dm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, color: dm.active ? 'var(--text1)' : 'var(--text3)', textDecoration: dm.active ? 'none' : 'line-through' }}>{dm.ten}</span>
                    <button style={{ fontSize: 11, color: dm.active ? 'var(--red)' : 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }} onClick={() => handleToggleActive(dm)}>
                      {dm.active ? 'Ẩn' : 'Kích hoạt'}
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn-ghost" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

export default function TaiChinh() {
  const { user } = useAuth();
  const isVender = user?.vai_tro === 'vender';
  const now = new Date();
  const [tab,           setTab]           = useState('giao-dich');
  const [addModal,      setAddModal]      = useState(false);
  const [danhMucModal,  setDanhMucModal]  = useState(false);
  const [thang,         setThang]         = useState(now.getMonth() + 1);
  const [nam,           setNam]           = useState(now.getFullYear());
  const [filterLoai,    setFilterLoai]    = useState('');

  const { data: gdRes }      = useGiaoDichList({ thang, nam, loai: filterLoai || undefined });
  const { data: tongRes }    = useTongThang(thang, nam);
  const { data: monthlyRes } = useTongTheoThang(5);
  const xoaGd                = useXoaGiaoDich();

  // Chia cho 1 triệu để hiển thị đơn vị "tr"
  const MONTHLY = (monthlyRes?.data ?? []).map((m) => ({
    thang: `T${m.thang}`,
    thu:   Math.round(Number(m.thu || 0) / 1_000_000),
    chi:   Math.round(Number(m.chi || 0) / 1_000_000),
  }));

  const gdList   = gdRes?.data ?? [];
  const tongData = tongRes?.data ?? {};
  const tongThu  = Number(tongData.tong_thu ?? 0);
  const tongChi  = Number(tongData.tong_chi ?? 0) + Number(tongData.da_hoan ?? 0);

  async function handleXoa(gd) {
    if (!window.confirm(`Bạn chắc muốn xoá giao dịch ${fmt(gd.so_tien)} này?`)) return;
    await xoaGd.mutateAsync(gd.id);
  }

  return (
    <div style={s.root}>
      {/* KPI row */}
      <div style={s.kpiRow}>
        {[
          { label: 'Tổng thu tháng này',   value: fmt(tongThu), color: 'var(--green)' },
          { label: 'Tổng chi tháng này',   value: fmt(tongChi), color: 'var(--red)' },
          { label: 'Tổng tiêu',            value: fmt(0),       color: 'var(--accent)' },
        ].map((k) => (
          <div key={k.label} style={s.kpi}>
            <div style={s.kpiLabel}>{k.label}</div>
            <div style={{ ...s.kpiValue, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Chart + tabs */}
      <div className="tai-chinh-main">
        {/* Chart */}
        <div style={{ ...s.card, width: 280, flexShrink: 0 }} className="tai-chinh-chart">
          <div style={s.cardTitle}>Thu/Chi 5 tháng</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={MONTHLY} margin={{ left: -24, right: 4 }}>
              <XAxis dataKey="thang" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} unit="tr" />
              <Tooltip formatter={(v) => [v + ' triệu', '']} contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="thu" fill="#22c986" radius={[4,4,0,0]} maxBarSize={20} />
              <Bar dataKey="chi" fill="#ff5f72" radius={[4,4,0,0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11 }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#22c986', marginRight: 4 }} />Thu</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#ff5f72', marginRight: 4 }} />Chi</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ ...s.card, flex: 1, minWidth: 0 }}>
          <div style={s.tabs}>
            {[['giao-dich','Giao dịch'], ...(!isVender ? [['danh-muc','Danh mục']] : [])].map(([v, label]) => (
              <button key={v} style={{ ...s.tab, ...(tab === v ? s.tabActive : {}) }} onClick={() => setTab(v)}>{label}</button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              {tab === 'giao-dich' && (
                <>
                  {/* Bộ lọc tháng/năm */}
                  <select style={s.filterSelect} value={thang} onChange={(e) => setThang(Number(e.target.value))}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>T{m}</option>)}
                  </select>
                  <select style={s.filterSelect} value={nam} onChange={(e) => setNam(Number(e.target.value))}>
                    {[2024,2025,2026,2027].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select style={s.filterSelect} value={filterLoai} onChange={(e) => setFilterLoai(e.target.value)}>
                    <option value="">Tất cả loại</option>
                    <option value="thu">Thu</option>
                    <option value="chi">Chi</option>
                    <option value="tieu">Tiêu</option>
                    <option value="tam_ung">Tạm ứng</option>
                  </select>
                </>
              )}
              <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setAddModal(true)}>+ Thêm</button>
            </div>
          </div>

          {tab === 'giao-dich' && (
            <div className="table-scroll">
              {gdList.length === 0 ? (
                <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text3)' }}>Không có giao dịch nào trong tháng {thang}/{nam}</div>
              ) : (
                <table style={s.table}>
                  <thead><tr>
                    {['Loại','Danh mục','Số tiền','Ngày','Ghi chú',''].map((h, i) => <th key={i} style={s.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {gdList.map((g) => {
                      const loai  = LOAI_LABEL[g.loai];
                      const isThu = loai?.type === 'thu';
                      return (
                        <tr key={g.id} style={s.tr}>
                          <td style={s.td}><span className="pill" style={{ background: (loai?.color ?? 'var(--text3)') + '1a', color: loai?.color }}>{loai?.label}</span></td>
                          <td style={s.td}><span style={{ fontSize: 11, color: 'var(--text3)' }}>{g.danh_muc_ten ?? '—'}</span></td>
                          <td style={s.td}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: isThu ? 'var(--green)' : 'var(--red)' }}>
                              {isThu ? '+' : '-'}{fmt(g.so_tien)}
                            </span>
                          </td>
                          <td style={s.td}><span style={{ fontSize: 12, color: 'var(--text2)' }}>{g.ngay ? new Date(g.ngay).toLocaleDateString('vi-VN') : '—'}</span></td>
                          <td style={s.td}><span style={{ fontSize: 12, color: 'var(--text2)' }}>{g.ghi_chu ?? '—'}</span></td>
                          <td style={s.td}>
                            {!isVender && (
                              <button
                                onClick={() => handleXoa(g)}
                                title="Xoá giao dịch"
                                style={{
                                  background: 'transparent',
                                  border: '1px solid var(--border)',
                                  borderRadius: 6, padding: '3px 8px', fontSize: 11,
                                  color: 'var(--red)', cursor: 'pointer',
                                  fontFamily: "'Be Vietnam Pro', sans-serif",
                                }}
                              >🗑 Xoá</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'danh-muc' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setDanhMucModal(true)}>⚙ Quản lý danh mục</button>
              </div>
              <DanhMucInline />
            </div>
          )}
        </div>
      </div>

      {addModal     && <AddGiaoDichModal isVender={isVender} onClose={() => setAddModal(false)} />}
      {danhMucModal && <DanhMucModal onClose={() => setDanhMucModal(false)} />}
    </div>
  );
}

// Hiển thị danh mục trực tiếp trong tab (không phải modal)
function DanhMucInline() {
  const { data: dmRes } = useDanhMuc();
  const dmList = dmRes?.data ?? [];

  return (
    <div>
      {['thu','chi','tieu'].map((loai) => {
        const items = dmList.filter((d) => d.loai === loai);
        return (
          <div key={loai} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              {loai === 'thu' ? '↑ Thu nhập' : loai === 'chi' ? '↓ Chi tiêu' : '· Tiêu khác'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {items.map((dm) => (
                <span key={dm.id} className="pill" style={{ background: 'var(--bg3)', color: dm.active ? 'var(--text1)' : 'var(--text3)', opacity: dm.active ? 1 : 0.5, fontSize: 12 }}>
                  {dm.ten}
                </span>
              ))}
              {items.length === 0 && <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Chưa có danh mục</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const s = {
  root:    { display: 'flex', flexDirection: 'column', gap: 14 },
  kpiRow:  { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 },
  kpi:     { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' },
  kpiLabel:{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 },
  kpiValue:{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" },
  card:    { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' },
  cardTitle:{ fontSize: 13, fontWeight: 700, color: 'var(--text1)', marginBottom: 14 },
  tabs:    { display: 'flex', gap: 4, marginBottom: 16, alignItems: 'center' },
  tab:     { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text3)', padding: '6px 12px', borderRadius: 8, fontFamily: "'Be Vietnam Pro', sans-serif" },
  tabActive: { background: 'var(--bg3)', color: 'var(--text1)' },
  filterSelect: { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 7, padding: '5px 8px', fontSize: 12, color: 'var(--text1)', cursor: 'pointer', outline: 'none', fontFamily: "'Be Vietnam Pro', sans-serif" },
  table:   { width: '100%', borderCollapse: 'collapse' },
  th:      { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 12px 10px 0', borderBottom: '1px solid var(--border)', textAlign: 'left' },
  tr:      { borderBottom: '1px solid var(--border)' },
  td:      { padding: '10px 12px 10px 0', verticalAlign: 'middle' },
};

const M = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal:   { background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' },
  title:   { fontSize: 15, fontWeight: 700, color: 'var(--text1)', marginBottom: 16 },
  err:     { color: 'var(--red)', fontSize: 12, marginBottom: 8 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
};
