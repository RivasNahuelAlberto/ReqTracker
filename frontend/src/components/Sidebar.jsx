import { useMemo, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export default function Sidebar({ isOpen = false, collapsed = false, onClose = () => {} }) {
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

  function ThemeToggle() {
    const [theme, setTheme] = useState(() => {
      try {
        return window.localStorage.getItem('reqtrackerTheme') || 'light';
      } catch (e) {
        return 'light';
      }
    });

    useEffect(() => {
      applyTheme(theme);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const applyTheme = (t) => {
      try {
        if (t === 'dark') {
          document.documentElement.classList.add('theme-dark');
          document.documentElement.style.colorScheme = 'dark';
        } else {
          document.documentElement.classList.remove('theme-dark');
          document.documentElement.style.colorScheme = 'light';
        }
        window.localStorage.setItem('reqtrackerTheme', t);
        setTheme(t);
      } catch (e) {
        // ignore
      }
    };

    const toggle = () => applyTheme(theme === 'dark' ? 'light' : 'dark');

    return (
      <button
        type="button"
        className={`rt-theme-toggle ${theme === 'dark' ? 'active' : ''}`}
        onClick={toggle}
        aria-pressed={theme === 'dark'}
        aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        title={theme === 'dark' ? 'Tema: oscuro' : 'Tema: claro'}
      >
        {theme === 'dark' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 7a5 5 0 100 10 5 5 0 000-10z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
    );
  }

  return (
    <aside className={`rt-sidebar ${isOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
      <div className="rt-sidebar-brand">
        <div className="rt-sidebar-logo">RT</div>
        <div className="rt-sidebar-brand-copy">
          <div className="rt-sidebar-name">ReqTracker</div>
          <div className="rt-sidebar-subtitle">Navegación</div>
        </div>
        <ThemeToggle />
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
