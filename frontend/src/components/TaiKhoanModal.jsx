import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMe, useUpdateMe } from '../hooks/useUsers';
import DoiMatKhauModal from './DoiMatKhauModal';

const ROLE_LABELS = {
  admin:         'Quản trị viên',
  quan_ly:       'Quản lý',
  vender:        'Vender',
  cong_tac_vien: 'Cộng tác viên',
  ke_toan:       'Kế toán',
};

// Các trường user tự sửa được
const FIELDS = [
  { key: 'ho_ten',        label: 'Họ tên' },
  { key: 'so_dien_thoai', label: 'Số điện thoại' },
  { key: 'ngan_hang',     label: 'Ngân hàng' },
  { key: 'so_tai_khoan',  label: 'Số tài khoản', mono: true },
  { key: 'ten_chu_tk',    label: 'Tên chủ tài khoản' },
];

const EMPTY = { ho_ten: '', so_dien_thoai: '', ngan_hang: '', so_tai_khoan: '', ten_chu_tk: '' };

// Thông tin cá nhân của user đang đăng nhập — xem + tự sửa.
export default function TaiKhoanModal({ onClose }) {
  const { user, updateUser } = useAuth();
  const { data: res, isLoading } = useMe();
  const capNhat = useUpdateMe();
  const me = res?.data ?? user ?? {};

  const [openDoiMatKhau, setOpenDoiMatKhau] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');

  if (openDoiMatKhau) return <DoiMatKhauModal onClose={onClose} />;

  function startEdit() {
    setForm({
      ho_ten:        me.ho_ten ?? '',
      so_dien_thoai: me.so_dien_thoai ?? '',
      ngan_hang:     me.ngan_hang ?? '',
      so_tai_khoan:  me.so_tai_khoan ?? '',
      ten_chu_tk:    me.ten_chu_tk ?? '',
    });
    setErr('');
    setEditing(true);
  }

  async function handleSave() {
    if (!form.ho_ten.trim()) { setErr('Họ tên không được để trống'); return; }
    setErr('');
    try {
      await capNhat.mutateAsync(form);
      updateUser({ ho_ten: form.ho_ten.trim() }); // đồng bộ tên ở sidebar
      setEditing(false);
    } catch (e) {
      setErr(e?.message ?? 'Cập nhật thất bại');
    }
  }

  const congTyQuanLy = me.cong_ty_quan_ly ?? [];

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h2 style={s.title}>Thông tin cá nhân</h2>
          <button style={s.closeBtn} onClick={onClose} aria-label="Đóng">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={s.body}>
          <div style={s.profile}>
            <div style={s.avatar}>{(me.ho_ten || user?.ho_ten)?.[0]?.toUpperCase() ?? 'A'}</div>
            <div style={{ minWidth: 0 }}>
              <div style={s.name}>{me.ho_ten || user?.ho_ten || 'Người dùng'}</div>
              <div style={s.role}>{ROLE_LABELS[me.vai_tro] ?? me.vai_tro}</div>
            </div>
          </div>

          <div style={s.field}>
            <div style={s.label}>Tên đăng nhập</div>
            <div style={{ ...s.value, fontFamily: "'JetBrains Mono', monospace" }}>{me.ten_dang_nhap ?? '—'}</div>
          </div>

          {editing ? (
            <>
              {FIELDS.map((f) => (
                <div key={f.key} style={s.field}>
                  <label style={s.label}>{f.label}{f.key === 'ho_ten' && ' *'}</label>
                  <input className="form-input" value={form[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    style={f.mono ? { fontFamily: "'JetBrains Mono', monospace" } : undefined} />
                </div>
              ))}
              {err && <div style={{ color: 'var(--red)', fontSize: 12 }}>{err}</div>}
            </>
          ) : (
            FIELDS.slice(1).map((f) => (
              <div key={f.key} style={s.field}>
                <div style={s.label}>{f.label}</div>
                <div style={{ ...s.value, fontFamily: f.mono ? "'JetBrains Mono', monospace" : undefined }}>
                  {me[f.key] || '—'}
                </div>
              </div>
            ))
          )}

          {/* Công ty đang quản lý — chỉ quan_ly */}
          {me.vai_tro === 'quan_ly' && (
            <div style={s.field}>
              <div style={s.label}>Công ty đang quản lý</div>
              {congTyQuanLy.length === 0 ? (
                <div style={{ ...s.value, color: 'var(--text3)' }}>Chưa phụ trách công ty nào</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {congTyQuanLy.map((ct) => (
                    <div key={ct.id} style={s.ctChip}>{ct.ten_cong_ty}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isLoading && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Đang tải hồ sơ...</div>}

          <div style={s.actions}>
            {editing ? (
              <>
                <button style={s.btnSecondary} onClick={() => setEditing(false)} disabled={capNhat.isPending}>Huỷ</button>
                <button style={s.btnPrimary} onClick={handleSave} disabled={capNhat.isPending}>
                  {capNhat.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </>
            ) : (
              <>
                <button style={s.btnSecondary} onClick={() => setOpenDoiMatKhau(true)}>Đổi mật khẩu</button>
                <button style={s.btnPrimary} onClick={startEdit}>✏️ Chỉnh sửa</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  card: {
    background: 'var(--bg1)', border: '1px solid var(--border)',
    borderRadius: 14, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid var(--border)',
    position: 'sticky', top: 0, background: 'var(--bg1)', zIndex: 1,
  },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--text1)' },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text3)', padding: 4, display: 'flex',
  },
  body: { padding: 20, display: 'flex', flexDirection: 'column', gap: 14 },
  profile: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 700, color: '#fff',
  },
  name: { fontSize: 16, fontWeight: 700, color: 'var(--text1)' },
  role: { fontSize: 12, color: 'var(--text3)', marginTop: 2 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: {
    fontSize: 10, fontWeight: 700, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  value: { fontSize: 14, color: 'var(--text1)' },
  ctChip: {
    background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '6px 12px', fontSize: 13,
    fontWeight: 600, color: 'var(--text1)',
  },
  actions: { display: 'flex', gap: 10, marginTop: 4 },
  btnSecondary: {
    flex: 1, background: 'transparent',
    border: '1px solid var(--border2)', color: 'var(--text2)',
    borderRadius: 8, padding: '10px 14px',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  btnPrimary: {
    flex: 1.4, background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 14px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif",
  },
};
