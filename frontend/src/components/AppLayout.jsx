import { useLocation } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar.jsx';

export default function AppLayout({ children }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (location.pathname === '/login') {
    return <>{children}</>;
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="app-layout">
      <button className="sidebar-toggle" onClick={toggleSidebar} title="Toggle menu">
        ☰
      </button>
      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={closeSidebar}></div>
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <main className="app-main">
        {children}
      </main>
    </div>
  );
}
