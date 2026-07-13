import { useTheme } from '../../context/ThemeContext';
import { NAV_ITEMS } from './tuyenDungData';
import Logo from './Logo';

// Header sticky: logo + nav + nút đổi theme + đăng nhập + menu mobile (☰).
// `isLoggedIn` để đổi "Đăng nhập" → "Vào trang quản lý"; `onNav(path)` điều hướng thật.
export default function Header({ isLoggedIn, onNav, menuOpen, onToggleMenu }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header style={s.header}>
      <div style={s.inner}>
        <a href="#" onClick={(e) => { e.preventDefault(); onNav('/'); }} style={{ textDecoration: 'none', flex: 'none' }}>
          <Logo />
        </a>

        <nav style={s.nav}>
          {NAV_ITEMS.map((nv) => (
            <a key={nv.label} href="#" className="sf-navlink"
              onClick={(e) => { e.preventDefault(); if (nv.to) onNav(nv.to); }}
              style={s.navLink}>{nv.label}</a>
          ))}
        </nav>

        <div style={s.actions}>
          <button onClick={toggleTheme} title="Đổi giao diện sáng / tối" style={s.themeBtn}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>{isDark ? '☾' : '☀︎'}</span>
            {isDark ? 'Tối' : 'Sáng'}
          </button>

          {isLoggedIn ? (
            <a href="#" onClick={(e) => { e.preventDefault(); onNav('/quan-ly'); }} className="sf-btn-navy" style={{ ...s.authBase, ...s.btnNavy }}>Vào trang quản lý</a>
          ) : (
            <a href="#" onClick={(e) => { e.preventDefault(); onNav('/login'); }} className="sf-btn-outline" style={{ ...s.authBase, ...s.btnOutline }}>Đăng nhập</a>
          )}
          <a href="#" onClick={(e) => { e.preventDefault(); onNav(isLoggedIn ? '/quan-ly' : '/login'); }} className="sf-btn-flame" style={{ ...s.authBase, ...s.btnFlame }}>Đăng tuyển ngay</a>

          <button onClick={onToggleMenu} aria-label="Menu" style={s.burger}>
            <span style={s.burgerLine} /><span style={s.burgerLine} /><span style={s.burgerLine} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div style={s.mobileMenu}>
          {NAV_ITEMS.map((nv) => (
            <a key={nv.label} href="#"
              onClick={(e) => { e.preventDefault(); if (nv.to) { onNav(nv.to); onToggleMenu(); } }}
              style={s.mobileLink}>{nv.label}</a>
          ))}
          <div style={{ display: 'flex', gap: 10, padding: '12px 8px' }}>
            {isLoggedIn ? (
              <a href="#" onClick={(e) => { e.preventDefault(); onNav('/quan-ly'); }} style={{ ...s.mobileAuth, ...s.btnNavy, flex: 1, textAlign: 'center' }}>Vào trang quản lý</a>
            ) : (
              <a href="#" onClick={(e) => { e.preventDefault(); onNav('/login'); }} style={{ ...s.mobileAuth, ...s.btnOutline, flex: 1, textAlign: 'center' }}>Đăng nhập</a>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

const s = {
  header: {
    position: 'sticky', top: 0, zIndex: 50,
    background: 'var(--sf-surface)', borderBottom: '1px solid var(--sf-brd)',
    boxShadow: 'var(--sf-shadow)',
  },
  inner: {
    maxWidth: 1180, margin: '0 auto', padding: '10px 20px',
    display: 'flex', alignItems: 'center', gap: 20,
  },
  nav: { display: 'var(--sf-nav-disp)', gap: 2, flex: 1, justifyContent: 'center' },
  navLink: {
    padding: '9px 11px', borderRadius: 8, fontSize: 14.5, fontWeight: 600,
    color: 'var(--sf-text)', textDecoration: 'none', whiteSpace: 'nowrap',
  },
  actions: { display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' },
  themeBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    background: 'var(--sf-surface2)', border: '1px solid var(--sf-brd)', color: 'var(--sf-text)',
    borderRadius: 999, padding: '7px 13px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  authBase: { padding: '8px 14px', borderRadius: 8, fontSize: 14, textDecoration: 'none', display: 'var(--sf-auth-disp)' },
  btnOutline: { fontWeight: 600, color: 'var(--sf-navy)', border: '1.5px solid var(--sf-navy)' },
  btnNavy: { fontWeight: 700, color: 'var(--sf-navy-ink)', background: 'var(--sf-navy)', border: 'none' },
  btnFlame: { fontWeight: 700, color: '#7a4a12', background: 'linear-gradient(135deg,var(--sf-flame1),var(--sf-flame2))', border: 'none' },
  burger: {
    display: 'var(--sf-burger-disp)', flexDirection: 'column', gap: 4,
    background: 'none', border: '1px solid var(--sf-brd)', borderRadius: 8, padding: 10, cursor: 'pointer',
  },
  burgerLine: { display: 'block', width: 18, height: 2, background: 'var(--sf-text)' },
  mobileMenu: {
    borderTop: '1px solid var(--sf-brd)', background: 'var(--sf-surface)',
    padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 2,
  },
  mobileLink: {
    padding: '11px 8px', borderRadius: 8, fontSize: 15, fontWeight: 600,
    color: 'var(--sf-text)', textDecoration: 'none', borderBottom: '1px solid var(--sf-brd)',
  },
  mobileAuth: { padding: 10, borderRadius: 8, fontSize: 14, textDecoration: 'none' },
};
