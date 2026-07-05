import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import { ThemeScope } from '../context/ThemeContext';

export default function Layout({ children }) {
  const [mobileSidebar, setMobileSidebar] = useState(false);

  return (
    <ThemeScope storageKey="theme_quan_ly" style={{ minHeight: 'auto' }}>
    <div className="layout-root">
      {/* Desktop sidebar */}
      <div className="sidebar-wrap">
        <Sidebar />
      </div>

      {/* Mobile sidebar drawer */}
      <div
        className={`sidebar-overlay${mobileSidebar ? ' open' : ''}`}
        onClick={() => setMobileSidebar(false)}
      />
      <div className={`sidebar-mobile${mobileSidebar ? ' open' : ''}`}>
        <Sidebar onClose={() => setMobileSidebar(false)} />
      </div>

      {/* Main area */}
      <div className="layout-main main-area">
        <Topbar onMenuClick={() => setMobileSidebar(!mobileSidebar)} />
        <div className="layout-content">
          {children}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="bottom-nav-wrap">
        <BottomNav />
      </div>
    </div>
    </ThemeScope>
  );
}
