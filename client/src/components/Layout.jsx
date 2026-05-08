import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const merchantNav = [
  { path: '/dashboard', label: 'Dashboard', icon: '◎' },
  { path: '/menu', label: 'Menu', icon: '☰' },
  { path: '/qr-code', label: 'QR Code', icon: '⊞' },
  { path: '/transactions', label: 'Activity', icon: '⇄' },
];

const customerNav = [
  { path: '/wallet', label: 'Rewards Wallet', icon: '◈' },
  { path: '/redeem', label: 'Redeem Rewards', icon: '✦' },
  { path: '/transactions', label: 'Activity', icon: '⇄' },
];

export default function Layout({ children }) {
  const { user, logout, isMerchant } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Close sidebar on route change
  useEffect(() => { closeSidebar(); }, [location.pathname, closeSidebar]);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const handleLogout = () => { logout(); navigate('/'); };
  const navItems = isMerchant ? merchantNav : customerNav;

  return (
    <div className="sp-layout">
      {/* ── Overlay ──────────────────────────────────── */}
      <div
        className={`sp-sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* ── Sidebar ──────────────────────────────────── */}
      <aside className={`sp-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sp-sidebar-header">
          <div>
            <Link to={isMerchant ? '/dashboard' : '/wallet'} className="sp-sidebar-logo">
              SafiPoints
            </Link>
            <div className="sp-sidebar-subtitle">
              {isMerchant ? 'Business Console' : 'Customer Rewards'}
            </div>
          </div>
          <button className="sp-sidebar-close" onClick={closeSidebar} aria-label="Close menu">
            ✕
          </button>
        </div>

        <nav className="sp-sidebar-nav">
          <div className="sp-sidebar-nav-label">Workspace</div>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sp-sidebar-link${isActive ? ' active' : ''}`}
              >
                <span className="sp-sidebar-link-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sp-sidebar-user">
          <div className="sp-sidebar-user-info">
            <div className="sp-sidebar-avatar">
              {(user?.name || user?.email || '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sp-sidebar-user-name">{user?.name || user?.email}</div>
              <div className="sp-sidebar-user-role">
                {isMerchant ? 'Business Manager' : user?.tier?.toUpperCase() || 'MEMBER'}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="sp-sidebar-logout">Sign Out</button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────── */}
      <main className="sp-main">
        <div className="sp-topbar">
          <div className="sp-topbar-left">
            <button className="sp-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <div className="sp-hamburger-lines">
                <span /><span /><span />
              </div>
            </button>
            <div className="sp-topbar-label">
              {isMerchant ? 'Business Workspace' : 'Customer Workspace'} · SafiPoints
            </div>
          </div>
          <a href="https://testnet.xrpl.org" target="_blank" rel="noreferrer" className="sp-topbar-xrpl">
            <span className="sp-topbar-xrpl-dot" />
            Verification Network
          </a>
        </div>

        <div className="sp-main-content">
          {children}
        </div>
      </main>
    </div>
  );
}
