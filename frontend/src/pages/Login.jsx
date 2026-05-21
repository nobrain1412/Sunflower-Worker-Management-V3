import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate   = useNavigate();

  const [form, setForm]       = useState({ ten_dang_nhap: '', mat_khau: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    if (error) setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.ten_dang_nhap || !form.mat_khau) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    setLoading(true);
    try {
      await login(form.ten_dang_nhap, form.mat_khau);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      {/* Nền gradient mờ */}
      <div style={styles.bgBlob1} />
      <div style={styles.bgBlob2} />

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="9" cy="7" r="4" stroke="#fff" strokeWidth="2"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={styles.logoText}>WorkerOS</div>
            <div style={styles.logoSub}>Hệ thống quản lý công nhân</div>
          </div>
        </div>

        <h1 style={styles.title}>Đăng nhập</h1>
        <p style={styles.subtitle}>Nhập thông tin tài khoản của bạn</p>

        <form onSubmit={handleSubmit} style={styles.form} autoComplete="off">
          {/* Tên đăng nhập */}
          <div style={styles.field}>
            <label style={styles.label}>TÊN ĐĂNG NHẬP</label>
            <div style={styles.inputWrap}>
              <svg style={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
              </svg>
              <input
                name="ten_dang_nhap"
                type="text"
                placeholder="Nhập tên đăng nhập"
                value={form.ten_dang_nhap}
                onChange={handleChange}
                style={styles.input}
                autoComplete="username"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Mật khẩu */}
          <div style={styles.field}>
            <label style={styles.label}>MẬT KHẨU</label>
            <div style={styles.inputWrap}>
              <svg style={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input
                name="mat_khau"
                type={showPw ? 'text' : 'password'}
                placeholder="Nhập mật khẩu"
                value={form.mat_khau}
                onChange={handleChange}
                style={styles.input}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                style={styles.eyeBtn}
                tabIndex={-1}
              >
                {showPw ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={styles.errorBox}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" stroke="#ff5f72" strokeWidth="2"/>
                <line x1="12" y1="8" x2="12" y2="12" stroke="#ff5f72" strokeWidth="2" strokeLinecap="round"/>
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="#ff5f72" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading ? (
              <span style={styles.spinner} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                <polyline points="10 17 15 12 10 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="15" y1="12" x2="3" y2="12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>

          <div style={styles.footerNote}>
            Chưa có tài khoản? <Link to="/dang-ky" style={styles.link}>Đăng ký ngay</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg0)',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  bgBlob1: {
    position: 'absolute', top: '-120px', left: '-120px',
    width: 400, height: 400, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(79,124,255,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  bgBlob2: {
    position: 'absolute', bottom: '-100px', right: '-80px',
    width: 350, height: 350, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(123,95,255,0.1) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    background: 'var(--bg1)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 400,
    position: 'relative',
    zIndex: 1,
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 12,
    marginBottom: 32,
  },
  logoIcon: {
    width: 42, height: 42, borderRadius: 10,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  logoText: {
    fontSize: 16, fontWeight: 700, color: 'var(--text1)',
    letterSpacing: '-0.3px',
  },
  logoSub: {
    fontSize: 11, color: 'var(--text3)', marginTop: 1,
  },
  title: {
    fontSize: 22, fontWeight: 700, color: 'var(--text1)',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13, color: 'var(--text2)', marginBottom: 28,
  },
  form: {
    display: 'flex', flexDirection: 'column', gap: 20,
  },
  field: {
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  label: {
    fontSize: 10, fontWeight: 700, color: 'var(--text2)',
    letterSpacing: '0.08em',
  },
  inputWrap: {
    position: 'relative', display: 'flex', alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute', left: 12, color: 'var(--text3)',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    background: 'var(--bg3)',
    border: '1px solid var(--border2)',
    borderRadius: 8,
    padding: '10px 12px 10px 38px',
    fontSize: 13,
    color: 'var(--text1)',
    fontFamily: "'Be Vietnam Pro', sans-serif",
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  eyeBtn: {
    position: 'absolute', right: 10,
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text3)', padding: 4, lineHeight: 0,
  },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(255,95,114,0.08)',
    border: '1px solid rgba(255,95,114,0.2)',
    borderRadius: 8, padding: '10px 14px',
    fontSize: 12, color: '#ff5f72',
  },
  submitBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    color: '#fff', border: 'none', borderRadius: 8,
    padding: '11px 16px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', marginTop: 4,
    fontFamily: "'Be Vietnam Pro', sans-serif",
    transition: 'opacity 0.15s',
  },
  footerNote: {
    textAlign: 'center', fontSize: 12, color: 'var(--text2)', marginTop: 6,
  },
  link: { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 },
  spinner: {
    width: 16, height: 16, borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block',
  },
};
