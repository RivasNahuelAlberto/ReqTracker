import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export default function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const path = location.pathname;
  const searchParams = new URLSearchParams(location.search);
  const currentKey = path === '/'
    ? searchParams.get('section') || 'home'
    : path.startsWith('/project/')
      ? searchParams.get('tab') || 'documents'
      : 'home';

  const projectId = path.startsWith('/project/') ? path.split('/')[2] : null;

  const homeItems = useMemo(() => [
    { key: 'home', label: 'Inicio', icon: '🏠', section: 'home' },
    { key: 'view', label: 'Ver proyectos', icon: '📁', section: 'view' },
    ...(user?.role === 'super_admin'
      ? [
          { key: 'create', label: 'Crear proyecto', icon: '➕', section: 'create' },
          { key: 'roles', label: 'Administrar roles', icon: '🛠️', section: 'roles' }
        ]
      : [])
  ], [user?.role]);

  const projectItems = useMemo(() => [
    { key: 'documents', label: 'Documentos', icon: '📄' },
    { key: 'about', label: 'Acerca del Sistema', icon: 'ℹ️' },
    { key: 'symbols', label: 'Lista de símbolos', icon: '🔤' },
    { key: 'map', label: 'Mapa de relaciones', icon: '🗺️' },
    { key: 'scenarios', label: 'Escenarios', icon: '🎭' },
    { key: 'requirements', label: 'Requisitos', icon: '📌' },
    { key: 'tasks', label: 'Tareas pendientes', icon: '✅' },
    { key: 'inspection', label: 'Inspección', icon: '🔍' },
    { key: 'resolve', label: 'A Resolver', icon: '⚠️' },
    { key: 'assistant', label: 'Asistente', icon: '🤖' },
    ...(user?.role === 'super_admin' ? [{ key: 'users', label: 'Usuarios', icon: '👥' }] : [])
  ], [user?.role]);

  const items = path === '/'
    ? homeItems
    : path.startsWith('/project/')
      ? projectItems
      : homeItems;

  const handleNavigation = (item) => {
    if (path === '/') {
      const search = item.section === 'home' ? '' : `?section=${item.section}`;
      navigate(`/${search}`, { replace: true });
      return;
    }

    if (path.startsWith('/project/') && projectId) {
      navigate(`/project/${projectId}?tab=${item.key}`, { replace: true });
    }
  };

  const handleProfileNavigation = () => {
    navigate('/profile', { replace: true });
  };

  const initials = user?.username
    ? user.username.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    : 'US';

  return (
    <aside
      className={`sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="sidebar-brand">
        <div className="sidebar-brand-title">ReqTracker</div>
        <div className="sidebar-brand-subtitle">Navegación contextual</div>
      </div>

      <div className="sidebar-section-label">Secciones</div>
      <nav className="sidebar-nav" aria-label="Navegación principal">
        {items.map((item) => {
          const isActive = currentKey === (path === '/' ? item.section : item.key);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleNavigation(item)}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-item-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-user-button" onClick={handleProfileNavigation}>
          <span className="sidebar-user-avatar">{initials}</span>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.username || 'Invitado'}</span>
            <span className="sidebar-user-role">{user?.role || 'sin rol'}</span>
          </div>
        </button>
      </div>
    </aside>
  );
}
