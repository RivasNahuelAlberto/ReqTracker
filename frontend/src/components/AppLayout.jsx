import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';

export default function AppLayout({ children }) {
  const location = useLocation();

  if (location.pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        {children}
      </main>
    </div>
  );
}
