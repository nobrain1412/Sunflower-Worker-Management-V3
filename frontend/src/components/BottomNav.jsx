import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TABS = [
  {
    to: '/', label: 'Tổng quan', exact: true,
    roles: ['admin','quan_ly','vender','ke_toan'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
        <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
        <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
        <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
  },
  {
    to: '/cong-nhan', label: 'Công nhân',
    roles: ['admin','quan_ly','vender','ke_toan','cong_tac_vien'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    to: '/cham-cong', label: 'Chấm công',
    roles: ['admin','quan_ly','vender','ke_toan'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
        <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
        <path d="M9 16l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    to: '/tai-chinh', label: 'Tài chính',
    roles: ['admin','quan_ly','vender'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    to: '/ktx', label: 'KTX',
    roles: ['admin'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    to: '/phong-tro', label: 'Nhà trọ',
    roles: ['quan_ly','vender'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function BottomNav() {
  const { user } = useAuth();
  const vaiTro = user?.vai_tro ?? 'vender';
  const visibleTabs = TABS.filter((t) => t.roles.includes(vaiTro));

  return (
    <nav style={s.nav}>
      {visibleTabs.map(({ to, label, icon, exact }) => (
        <NavLink
          key={to} to={to} end={exact}
          style={({ isActive }) => ({ ...s.tab, ...(isActive ? s.tabActive : {}) })}
        >
          {({ isActive }) => (
            <>
              <span style={{ color: isActive ? 'var(--accent)' : 'var(--text3)' }}>{icon}</span>
              <span style={{ ...s.tabLabel, color: isActive ? 'var(--accent)' : 'var(--text3)' }}>
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

const s = {
  nav: {
    display: 'none', // shown via media query in CSS
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: 'var(--bg1)', borderTop: '1px solid var(--border)',
    zIndex: 200, height: 60,
  },
  tab: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 2,
    textDecoration: 'none',
  },
  tabLabel: { fontSize: 10, fontWeight: 600 },
  tabActive: {},
};
