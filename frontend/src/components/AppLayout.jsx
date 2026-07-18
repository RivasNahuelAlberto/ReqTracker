import { useLocation } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar.jsx';

export default function AppLayout({ children }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isLoginRoute = location.pathname === '/login';
  if (isLoginRoute) {
    return <>{children}</>;
  }

  const toggleSidebar = () => {
    // On small screens toggle the overlay; on larger screens toggle collapse
    try {
      if (window.innerWidth && window.innerWidth < 992) {
        setSidebarOpen((prev) => !prev);
      } else {
        setSidebarCollapsed((prev) => !prev);
      }
    } catch (e) {
      setSidebarOpen((prev) => !prev);
    }
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

  const sidebarToggleLabel = sidebarOpen || sidebarCollapsed ? 'Cerrar menú' : 'Abrir menú';

  return (
    <div className="rt-layout">
      <Sidebar isOpen={sidebarOpen} collapsed={sidebarCollapsed} onClose={closeSidebar} />
      <div className={`rt-main ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <header className="rt-topbar">
          <button
            className={`rt-btn rt-btn-ghost rt-mobile-menu-btn ${sidebarOpen || sidebarCollapsed ? 'active' : ''}`}
            onClick={toggleSidebar}
            aria-label={sidebarToggleLabel}
            aria-expanded={sidebarOpen || sidebarCollapsed}
          >
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
