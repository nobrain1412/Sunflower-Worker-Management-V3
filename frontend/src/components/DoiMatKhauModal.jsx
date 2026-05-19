import { useState } from 'react';
import api from '../hooks/useApi';

export default function DoiMatKhauModal({ onClose }) {
  const [form, setForm] = useState({ mat_khau_cu: '', mat_khau_moi: '', xac_nhan: '' });
  const [show, setShow] = useState({ cu: false, moi: false, xn: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    if (error) setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.mat_khau_cu || !form.mat_khau_moi) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    if (form.mat_khau_moi.length < 6) {
      setError('Mật khẩu mới tối thiểu 6 ký tự');
      return;
    }
    if (form.mat_khau_moi !== form.xac_nhan) {
      setError('Xác nhận mật khẩu không khớp');
      return;
    }
    if (form.mat_khau_cu === form.mat_khau_moi) {
      setError('Mật khẩu mới phải khác mật khẩu hiện tại');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/doi-mat-khau', {
        mat_khau_cu: form.mat_khau_cu,
        mat_khau_moi: form.mat_khau_moi,
      });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err?.message || 'Đổi mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h2 style={s.title}>Đổi mật khẩu</h2>
          <button style={s.closeBtn} onClick={onClose} aria-label="Đóng">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {success ? (
          <div style={s.successBox}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#22c986" strokeWidth="2"/>
              <polyline points="8 12 11 15 16 9" stroke="#22c986" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={s.successText}>Đổi mật khẩu thành công</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={s.form}>
            <PwField
              label="MẬT KHẨU HIỆN TẠI"
              name="mat_khau_cu"
              value={form.mat_khau_cu}
              onChange={handleChange}
              show={show.cu}
              onToggleShow={() => setShow((v) => ({ ...v, cu: !v.cu }))}
              autoFocus
            />
            <PwField
              label="MẬT KHẨU MỚI"
              name="mat_khau_moi"
              value={form.mat_khau_moi}
              onChange={handleChange}
              show={show.moi}
              onToggleShow={() => setShow((v) => ({ ...v, moi: !v.moi }))}
              hint="Tối thiểu 6 ký tự"
            />
            <PwField
              label="XÁC NHẬN MẬT KHẨU MỚI"
              name="xac_nhan"
              value={form.xac_nhan}
              onChange={handleChange}
              show={show.xn}
              onToggleShow={() => setShow((v) => ({ ...v, xn: !v.xn }))}
            />

            {error && (
              <div style={s.errorBox}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" stroke="#ff5f72" strokeWidth="2"/>
                  <line x1="12" y1="8" x2="12" y2="12" stroke="#ff5f72" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="12" y1="16" x2="12.01" y2="16" stroke="#ff5f72" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            <div style={s.actions}>
              <button type="button" onClick={onClose} style={s.btnSecondary} disabled={loading}>
                Huỷ
              </button>
              <button type="submit" style={s.btnPrimary} disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function PwField({ label, name, value, onChange, show, onToggleShow, hint, autoFocus }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      <div style={s.inputWrap}>
        <svg style={s.inputIcon} width="15" height="15" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <input
          name={name}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          style={s.input}
          autoComplete="new-password"
          autoFocus={autoFocus}
        />
        <button type="button" onClick={onToggleShow} style={s.eyeBtn} tabIndex={-1}>
          {show ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
            </svg>
          )}
        </button>
      </div>
      {hint && <div style={s.hint}>{hint}</div>}
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
    borderRadius: 14, width: '100%', maxWidth: 400,
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid var(--border)',
  },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--text1)' },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text3)', padding: 4, display: 'flex',
  },
  form: { padding: 20, display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: {
    fontSize: 10, fontWeight: 700, color: 'var(--text2)',
    letterSpacing: '0.08em',
  },
  inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  inputIcon: {
    position: 'absolute', left: 12, color: 'var(--text3)', pointerEvents: 'none',
  },
  input: {
    width: '100%', background: 'var(--bg3)',
    border: '1px solid var(--border2)', borderRadius: 8,
    padding: '10px 36px 10px 38px', fontSize: 13,
    color: 'var(--text1)', outline: 'none',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  eyeBtn: {
    position: 'absolute', right: 10, background: 'none', border: 'none',
    cursor: 'pointer', color: 'var(--text3)', padding: 4, lineHeight: 0,
  },
  hint: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(255,95,114,0.08)',
    border: '1px solid rgba(255,95,114,0.2)',
    borderRadius: 8, padding: '10px 14px',
    fontSize: 12, color: '#ff5f72',
  },
  actions: {
    display: 'flex', gap: 10, marginTop: 4,
  },
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
  successBox: {
    padding: '32px 20px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 12,
  },
  successText: {
    fontSize: 14, fontWeight: 600, color: 'var(--text1)',
  },
};
