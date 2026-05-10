import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Nav items có thêm `roles` để lọc theo quyền
const NAV = [
  {
    to: '/', label: 'Dashboard', exact: true,
    roles: ['admin','quan_ly','vender'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
        <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
        <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
        <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
  },
  {
    to: '/cong-nhan', label: 'Công nhân',
    roles: ['admin','quan_ly','vender'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    to: '/cham-cong', label: 'Chấm công',
    roles: ['admin','quan_ly','vender'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
    roles: ['admin','quan_ly'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    to: '/ktx', label: 'Phòng trọ',
    roles: ['admin','quan_ly'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    to: '/nhan-su', label: 'Nhân sự',
    roles: ['admin'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
        <path d="M22 11l-3-3m0 6l3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    to: '/cong-ty', label: 'Công ty',
    roles: ['admin'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
  },
  {
    to: '/bao-cao', label: 'Báo cáo',
    roles: ['admin','quan_ly'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const ROLE_LABELS = {
  admin:         'Quản trị viên',
  quan_ly:       'Quản lý',
  vender:        'Vender',
  cong_tac_vien: 'Cộng tác viên',
  ke_toan:       'Kế toán',
};

export default function Sidebar() {
  const { user, logout, isQuanLy, selectedCongTyId, chonCongTy } = useAuth();
  const navigate = useNavigate();
  const vaiTro = user?.vai_tro ?? 'vender';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const visibleNav = NAV.filter((item) => item.roles.includes(vaiTro));

  return (
    <aside style={s.sidebar}>
      {/* Logo */}
      <div style={s.logo}>
        <div style={s.logoIcon}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="9" cy="7" r="4" stroke="#fff" strokeWidth="2"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <span style={s.logoText}>WorkerOS</span>
      </div>

      {/* Dropdown chọn công ty (chỉ cho quan_ly) */}
      {isQuanLy && user?.cong_ty_ids?.length > 0 && (
        <CongTyDropdown
          congTyIds={user.cong_ty_ids}
          selectedId={selectedCongTyId}
          onSelect={chonCongTy}
        />
      )}

      {/* Nav section label */}
      <div style={s.sectionLabel}>MENU CHÍNH</div>

      {/* Nav links — lọc theo role */}
      <nav style={s.nav}>
        {visibleNav.map(({ to, label, icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            style={({ isActive }) => ({ ...s.link, ...(isActive ? s.linkActive : {}) })}
          >
            <span style={s.linkIcon}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: user info + logout */}
      <div style={s.bottom}>
        <div style={s.divider} />
        <div style={s.userRow}>
          <div style={s.avatar}>
            {user?.ho_ten?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div style={s.userInfo}>
            <div style={s.userName}>{user?.ho_ten ?? 'Người dùng'}</div>
            <div style={s.userRole}>{ROLE_LABELS[vaiTro] ?? vaiTro}</div>
          </div>
          <button onClick={handleLogout} style={s.logoutBtn} title="Đăng xuất">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

// Dropdown chọn công ty cho quản lý — fetch tên từ API
function CongTyDropdown({ congTyIds, selectedId, onSelect }) {
  // Tạm thời hiển thị ID, sẽ fetch tên đầy đủ sau khi có dữ liệu thực
  return (
    <div style={sd.wrap}>
      <div style={sd.label}>CÔNG TY</div>
      <select
        style={sd.select}
        value={selectedId ?? ''}
        onChange={(e) => onSelect(parseInt(e.target.value, 10))}
      >
        <option value="">-- Tất cả công ty --</option>
        {congTyIds.map((id) => (
          <option key={id} value={id}>Công ty #{id}</option>
        ))}
      </select>
    </div>
  );
}

const s = {
  sidebar: {
    width: 220, minWidth: 220, height: '100vh',
    background: 'var(--bg1)',
    borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column',
    position: 'fixed', left: 0, top: 0, zIndex: 100,
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '18px 20px 16px',
    borderBottom: '1px solid var(--border)',
  },
  logoIcon: {
    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 15, fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.3px' },
  sectionLabel: {
    fontSize: 10, fontWeight: 700, color: 'var(--text3)',
    letterSpacing: '0.1em', padding: '16px 20px 8px',
  },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px', flex: 1 },
  link: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 8,
    fontSize: 13, fontWeight: 500, color: 'var(--text2)',
    textDecoration: 'none', transition: 'all 0.15s',
  },
  linkActive: {
    background: 'rgba(79,124,255,0.12)',
    color: 'var(--accent)', fontWeight: 600,
  },
  linkIcon: { display: 'flex', alignItems: 'center', flexShrink: 0 },
  bottom: { padding: '0 10px 12px' },
  divider: { height: 1, background: 'var(--border)', margin: '8px 10px 12px' },
  userRow: { display: 'flex', alignItems: 'center', gap: 9, padding: '0 2px' },
  avatar: {
    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, color: '#fff',
  },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontSize: 12, fontWeight: 600, color: 'var(--text1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRole: { fontSize: 10, color: 'var(--text3)', marginTop: 1 },
  logoutBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text3)', padding: 4, borderRadius: 6,
    display: 'flex', alignItems: 'center',
    transition: 'color 0.15s',
  },
};

const sd = {
  wrap: {
    padding: '10px 14px 4px',
    borderBottom: '1px solid var(--border)',
  },
  label: {
    fontSize: 10, fontWeight: 700, color: 'var(--text3)',
    letterSpacing: '0.1em', marginBottom: 6,
  },
  select: {
    width: '100%', background: 'var(--bg3)',
    border: '1px solid var(--border2)',
    borderRadius: 6, color: 'var(--text1)',
    fontSize: 12, padding: '6px 8px',
    cursor: 'pointer', outline: 'none',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
};
