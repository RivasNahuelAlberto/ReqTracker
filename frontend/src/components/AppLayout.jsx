import { useLocation } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar.jsx';

export default function AppLayout({ children }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginRoute = location.pathname === '/login';
  if (isLoginRoute) {
    return <>{children}</>;
  }

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const pageTitle = location.pathname === '/'
    ? 'Inicio'
    : location.pathname.startsWith('/project/')
      ? 'Proyecto'
      : location.pathname === '/profile'
        ? 'Perfil'
        : '';

  return (
    <div className="rt-layout">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <div className="rt-main">
        <header className="rt-topbar">
          <button className="rt-btn rt-btn-ghost rt-mobile-menu-btn" onClick={toggleSidebar} aria-label="Abrir menú">
            ☰
          </button>
          <div className="rt-topbar-left">
            <div className="rt-topbar-brand">ReqTracker</div>
            {pageTitle && <div className="rt-topbar-title">{pageTitle}</div>}
          </div>
          <div className="rt-topbar-actions">
            <span className="rt-topbar-badge">Panel de control</span>
          </div>
        </header>

        <div className="rt-page-content">
          {children}
        </div>
      </div>
      {sidebarOpen && <div className="rt-backdrop" onClick={closeSidebar} />}
    </div>
  );
}
