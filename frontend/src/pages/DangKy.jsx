import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { setAccessToken } from '../hooks/useApi';

export default function DangKy() {
  const [form, setForm] = useState({
    ten_dang_nhap: '',
    ho_ten: '',
    so_dien_thoai: '',
    mat_khau: '',
    nhap_lai_mat_khau: '',
  });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    if (error) setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.ten_dang_nhap || !form.ho_ten || !form.so_dien_thoai
        || !form.mat_khau || !form.nhap_lai_mat_khau) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    if (form.mat_khau !== form.nhap_lai_mat_khau) {
      setError('Mật khẩu nhập lại không khớp');
      return;
    }
    if (form.mat_khau.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/dang-ky', form);
      // Lưu phiên đăng nhập rồi điều hướng về Dashboard.
      setAccessToken(res.data.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      // Reload toàn trang để AuthProvider khởi tạo lại với phiên mới.
      window.location.assign('/');
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.bgBlob1} />
      <div style={styles.bgBlob2} />

      <div style={styles.card}>
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

        <h1 style={styles.title}>Đăng ký tài khoản</h1>
        <p style={styles.subtitle}>Tài khoản mặc định ở vai trò <b>cộng tác viên</b></p>

        <form onSubmit={handleSubmit} style={styles.form} autoComplete="off">
          <Field
            label="TÊN ĐĂNG NHẬP"
            name="ten_dang_nhap"
            value={form.ten_dang_nhap}
            onChange={handleChange}
            placeholder="vd: nguyenvana"
            autoComplete="username"
          />
          <Field
            label="HỌ VÀ TÊN"
            name="ho_ten"
            value={form.ho_ten}
            onChange={handleChange}
            placeholder="Nguyễn Văn A"
            autoComplete="name"
          />
          <Field
            label="SỐ ĐIỆN THOẠI"
            name="so_dien_thoai"
            value={form.so_dien_thoai}
            onChange={handleChange}
            placeholder="0901234567"
            inputMode="tel"
            autoComplete="tel"
          />
          <Field
            label="MẬT KHẨU"
            name="mat_khau"
            type={showPw ? 'text' : 'password'}
            value={form.mat_khau}
            onChange={handleChange}
            placeholder="Tối thiểu 6 ký tự"
            autoComplete="new-password"
            trailing={
              <button type="button" onClick={() => setShowPw((v) => !v)}
                style={styles.eyeBtn} tabIndex={-1}>
                {eyeIcon(showPw)}
              </button>
            }
          />
          <Field
            label="NHẬP LẠI MẬT KHẨU"
            name="nhap_lai_mat_khau"
            type={showPw2 ? 'text' : 'password'}
            value={form.nhap_lai_mat_khau}
            onChange={handleChange}
            placeholder="Nhập lại mật khẩu"
            autoComplete="new-password"
            trailing={
              <button type="button" onClick={() => setShowPw2((v) => !v)}
                style={styles.eyeBtn} tabIndex={-1}>
                {eyeIcon(showPw2)}
              </button>
            }
          />

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
            {loading ? <span style={styles.spinner} /> : null}
            {loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
          </button>

          <div style={styles.footerNote}>
            Đã có tài khoản? <Link to="/login" style={styles.link}>Đăng nhập</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, trailing, ...inputProps }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <div style={styles.inputWrap}>
        <input {...inputProps} style={styles.input} spellCheck={false} />
        {trailing}
      </div>
    </div>
  );
}

function eyeIcon(open) {
  return open ? (
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
  );
}

const styles = {
  root: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg0)', position: 'relative', overflow: 'hidden',
    fontFamily: "'Be Vietnam Pro', sans-serif", padding: '20px 0',
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
    background: 'var(--bg1)', border: '1px solid var(--border)',
    borderRadius: 16, padding: '36px 36px', width: '100%', maxWidth: 420,
    position: 'relative', zIndex: 1,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 },
  logoIcon: {
    width: 42, height: 42, borderRadius: 10,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  logoText: { fontSize: 16, fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.3px' },
  logoSub:  { fontSize: 11, color: 'var(--text3)', marginTop: 1 },
  title:    { fontSize: 22, fontWeight: 700, color: 'var(--text1)', marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'var(--text2)', marginBottom: 22 },
  form:     { display: 'flex', flexDirection: 'column', gap: 14 },
  field:    { display: 'flex', flexDirection: 'column', gap: 6 },
  label:    { fontSize: 10, fontWeight: 700, color: 'var(--text2)', letterSpacing: '0.08em' },
  inputWrap:{ position: 'relative', display: 'flex', alignItems: 'center' },
  input: {
    width: '100%', background: 'var(--bg3)',
    border: '1px solid var(--border2)', borderRadius: 8,
    padding: '10px 12px', fontSize: 13, color: 'var(--text1)',
    fontFamily: "'Be Vietnam Pro', sans-serif", outline: 'none',
    transition: 'border-color 0.15s',
  },
  eyeBtn: {
    position: 'absolute', right: 10,
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text3)', padding: 4, lineHeight: 0,
  },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(255,95,114,0.08)', border: '1px solid rgba(255,95,114,0.2)',
    borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ff5f72',
  },
  submitBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    color: '#fff', border: 'none', borderRadius: 8,
    padding: '11px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4,
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  spinner: {
    width: 16, height: 16, borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
    animation: 'spin 0.7s linear infinite', display: 'inline-block',
  },
  footerNote: {
    textAlign: 'center', fontSize: 12, color: 'var(--text2)', marginTop: 6,
  },
  link: { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 },
};
