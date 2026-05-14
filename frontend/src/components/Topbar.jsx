import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PAGE_TITLE = {
  '/':          'Dashboard',
  '/cong-nhan': 'Công nhân',
  '/cham-cong': 'Chấm công',
  '/tai-chinh': 'Tài chính',
  '/ktx':       'Ký túc xá',
  '/cong-ty':   'Công ty',
  '/bao-cao':   'Báo cáo',
};

export default function Topbar({ onMenuClick }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const title = PAGE_TITLE[pathname] ?? 'WorkerOS';
  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header style={s.bar}>
      {/* Hamburger — shown on mobile via CSS */}
      <button className="hamburger-btn" onClick={onMenuClick}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      <div>
        <h1 style={s.title}>{title}</h1>
        <p style={s.date}>{today}</p>
      </div>

      <div style={s.right}>
        {/* Tìm kiếm nhanh — hidden on mobile */}
        <div className="topbar-search">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={s.searchIcon}>
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input style={s.searchInput} placeholder="Tìm kiếm..." />
        </div>

        {/* Notification bell */}
        <button style={s.iconBtn}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span style={s.notifDot} />
        </button>
        <button className="topbar-mobile-logout" style={s.mobileLogoutBtn} onClick={handleLogout} title="Đăng xuất">
          Đăng xuất
        </button>
      </div>
    </header>
  );
}

const s = {
  bar: {
    height: 56, background: 'var(--bg1)',
    borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center',
    padding: '0 20px', gap: 12,
    position: 'sticky', top: 0, zIndex: 50,
  },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--text1)', lineHeight: 1 },
  date:  { fontSize: 11, color: 'var(--text3)', marginTop: 2, textTransform: 'capitalize' },
  right: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 },
  searchIcon: {
    position: 'absolute', left: 10, color: 'var(--text3)', pointerEvents: 'none',
  },
  searchInput: {
    background: 'var(--bg3)', border: '1px solid var(--border2)',
    borderRadius: 8, padding: '6px 12px 6px 30px',
    fontSize: 12, color: 'var(--text1)', outline: 'none',
    width: 200, fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  iconBtn: {
    position: 'relative',
    background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 8, padding: 8, cursor: 'pointer',
    color: 'var(--text2)', display: 'flex',
  },
  notifDot: {
    position: 'absolute', top: 7, right: 7,
    width: 6, height: 6, borderRadius: '50%',
    background: 'var(--red)', border: '1.5px solid var(--bg1)',
  },
  mobileLogoutBtn: {
    background: 'transparent',
    border: '1px solid var(--border2)',
    color: 'var(--text2)',
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
};
