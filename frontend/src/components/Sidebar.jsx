import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const path = location.pathname;
  const searchParams = new URLSearchParams(location.search);
  const currentKey = path === '/'
    ? searchParams.get('section') || 'home'
    : path.startsWith('/project/')
      ? searchParams.get('tab') || 'documents'
      : path === '/profile'
        ? 'profile'
        : 'home';

  const projectId = path.startsWith('/project/') ? path.split('/')[2] : null;
  const projectRole = useMemo(() => {
    return user?.projectRoles?.find((pr) => pr.project?.toString() === projectId)?.role || null;
  }, [user?.projectRoles, projectId]);
  const canViewProjectUsers = useMemo(() => {
    return user?.role === 'super_admin' || projectRole === 'admin';
  }, [user?.role, projectRole]);

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
    { key: 'home', label: 'Visión general', icon: '🏠' },
    { key: 'map', label: 'Mapa de relaciones', icon: '🗺️' },
    { key: 'assistant', label: 'IA / Copiloto', icon: '🤖' },
    { key: 'analytics', label: 'Analítica', icon: '📊' },
    { key: 'health', label: 'Salud', icon: '❤️' },
    { key: 'symbols', label: 'Símbolos', icon: '🔤' },
    { key: 'scenarios', label: 'Escenarios', icon: '🎭' },
    { key: 'requirements', label: 'Requisitos', icon: '📌' },
    { key: 'tasks', label: 'Tareas', icon: '✅' },
    { key: 'inspection', label: 'Inspección', icon: '🔍' },
    { key: 'resolve', label: 'A Resolver', icon: '⚠️' },
    ...(canViewProjectUsers ? [{ key: 'users', label: 'Usuarios', icon: '👥' }] : [])
  ], [canViewProjectUsers]);

  const profileItems = [
    { key: 'home', label: 'Inicio', icon: '🏠' },
    { key: 'profile', label: 'Perfil', icon: '👤' }
  ];

  const items = path === '/'
    ? homeItems
    : path.startsWith('/project/')
      ? projectItems
      : path === '/profile'
        ? profileItems
        : homeItems;

  const handleNavigation = (item) => {
    if (path === '/') {
      const search = item.section === 'home' ? '' : `?section=${item.section}`;
      navigate(`/${search}`, { replace: true });
      onClose();
      return;
    }

    if (path.startsWith('/project/') && projectId) {
      if (item.key === 'home') {
        navigate('/', { replace: true });
        onClose();
        return;
      }
      navigate(`/project/${projectId}?tab=${item.key}`, { replace: true });
      onClose();
      return;
    }

    if (path === '/profile') {
      if (item.key === 'home') {
        navigate('/', { replace: true });
        onClose();
        return;
      }
      return;
    }

    const search = item.section === 'home' ? '' : `?section=${item.section}`;
    navigate(`/${search}`, { replace: true });
    onClose();
  };

  const handleProfileNavigation = () => {
    navigate('/profile', { replace: true });
    onClose();
  };

  const initials = user?.username
    ? user.username.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    : 'US';

  return (
    <aside className={`rt-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="rt-sidebar-brand">
        <div className="rt-sidebar-logo">RT</div>
        <div>
          <div className="rt-sidebar-name">ReqTracker</div>
          <div className="rt-sidebar-subtitle">Navegación</div>
        </div>
      </div>

      <div className="rt-sidebar-section">Panel</div>
      <nav className="rt-sidebar-nav" aria-label="Navegación principal">
        {items.map((item) => {
          const isActive = currentKey === (path === '/' ? item.section : item.key);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleNavigation(item)}
              className={`rt-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="rt-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {isActive && <span className="rt-nav-dot" />}
            </button>
          );
        })}
      </nav>

      <div className="rt-sidebar-footer">
        <button type="button" className="rt-user-btn" onClick={handleProfileNavigation}>
          <span className="rt-user-avatar">{initials}</span>
          <div className="rt-user-info">
            <span className="rt-user-name">{user?.username || 'Invitado'}</span>
            <span className="rt-user-role">
              {path.startsWith('/project/') && projectRole
                ? projectRole === 'admin' ? 'Administrador' : projectRole === 'usuario' ? 'Usuario' : projectRole
                : user?.role === 'super_admin' ? 'Super Admin' : user?.role || 'Sin rol'}
            </span>
          </div>
        </button>
      </div>
    </aside>
  );
}
