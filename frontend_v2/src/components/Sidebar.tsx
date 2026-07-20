import { useState, useEffect } from 'react'
import type { NavigateFn, User } from '../App'

interface NavItem {
  key: string
  icon: string
  label: string
}

interface Props {
  user: User
  isOpen: boolean
  onClose: () => void
  activeKey: string
  items: NavItem[]
  onNavigate: (key: string) => void
  onNavigateHome: () => void
  onNavigateProfile: () => void
  isDark: boolean
  toggleTheme: () => void
  navigate: NavigateFn
  showHomeLink?: boolean
}

export default function Sidebar({
  user, isOpen, onClose, activeKey, items,
  onNavigate, onNavigateHome, onNavigateProfile,
  isDark, toggleTheme, showHomeLink = false,
}: Props) {
  // pinned = sidebar is locked open at full width
  // unpinned = sidebar collapses to icon-only rail; expands on hover as flyout
  const [pinned, setPinned] = useState(() => localStorage.getItem('sidebar-pinned') !== 'false')
  const [hovering, setHovering] = useState(false)

  const isExpanded = pinned || hovering

  const initials = user.username
    .split('.')
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)

  const roleLabel =
    user.role === 'super_admin' ? 'super_admin'
    : user.role === 'usuario' ? 'usuario'
    : 'invitado'

  const togglePin = () => {
    setPinned(p => {
      const next = !p
      localStorage.setItem('sidebar-pinned', String(next))
      return next
    })
  }

  useEffect(() => {
    // rt-main margin follows pinned state only (hovering is an overlay)
    document.documentElement.style.setProperty('--sidebar-w', pinned ? '220px' : '56px')
  }, [pinned])

  const handleMouseEnter = () => {
    if (!pinned) setHovering(true)
  }
  const handleMouseLeave = () => {
    setHovering(false)
  }

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`rt-sidebar-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />

      <aside
        className={`rt-sidebar ${isOpen ? 'open' : ''} ${!pinned && hovering ? 'flyout' : ''}`}
        style={{ width: isExpanded ? 220 : 56 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >

        {/* Brand */}
        <div className="rt-sidebar-brand" style={{ justifyContent: isExpanded ? 'flex-start' : 'center', padding: isExpanded ? '18px 16px 14px' : '18px 0 14px' }}>
          <div className="rt-sidebar-logo">R</div>
          {isExpanded && <span className="rt-sidebar-name">ReqTracker</span>}
          {isExpanded && (
            <button
              className="rt-collapse-btn"
              onClick={togglePin}
              title={pinned ? 'Contraer sidebar' : 'Fijar expandido'}
              style={{ marginLeft: 'auto' }}
            >
              {pinned ? '‹' : '📌'}
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="rt-sidebar-nav" aria-label="Navegación principal">
          {showHomeLink && (
            <>
              {isExpanded && <div className="rt-sidebar-section">Principal</div>}
              <button
                className={`rt-nav-item ${activeKey === 'home' ? 'active' : ''}`}
                onClick={() => { onNavigateHome(); onClose() }}
                title={!isExpanded ? 'Inicio' : undefined}
                style={{ justifyContent: isExpanded ? 'flex-start' : 'center', padding: isExpanded ? '7px 10px' : '9px 0' }}
              >
                <span className="rt-nav-icon">⌂</span>
                {isExpanded && <span className="rt-nav-label">Inicio</span>}
                {isExpanded && activeKey === 'home' && <span className="rt-nav-dot" />}
              </button>
            </>
          )}

          {items.length > 0 && (
            <>
              {isExpanded && <div className="rt-sidebar-section">Secciones</div>}
              {items.map((item) => {
                const active = activeKey === item.key
                return (
                  <button
                    key={item.key}
                    className={`rt-nav-item ${active ? 'active' : ''}`}
                    onClick={() => { onNavigate(item.key); onClose() }}
                    title={!isExpanded ? item.label : undefined}
                    style={{ justifyContent: isExpanded ? 'flex-start' : 'center', padding: isExpanded ? '7px 10px' : '9px 0' }}
                  >
                    <span className="rt-nav-icon">{item.icon}</span>
                    {isExpanded && <span className="rt-nav-label">{item.label}</span>}
                    {isExpanded && active && <span className="rt-nav-dot" />}
                  </button>
                )
              })}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="rt-sidebar-footer">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={!isExpanded ? (isDark ? 'Tema claro' : 'Tema oscuro') : undefined}
            style={{
              width: '100%',
              padding: isExpanded ? '7px 10px' : '7px 0',
              marginBottom: 6,
              display: 'flex', alignItems: 'center',
              justifyContent: isExpanded ? 'flex-start' : 'center',
              gap: isExpanded ? 8 : 0,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 5, cursor: 'pointer', fontSize: 12,
              color: 'rgba(255,255,255,0.45)', fontFamily: 'inherit',
              transition: 'background 0.12s',
            }}
          >
            <span style={{ fontSize: 14 }}>{isDark ? '☀' : '◐'}</span>
            {isExpanded && <span>{isDark ? 'Tema claro' : 'Tema oscuro'}</span>}
          </button>

          {/* User */}
          <button
            className="rt-user-btn"
            onClick={onNavigateProfile}
            title={!isExpanded ? user.username : 'Ver perfil'}
            style={{ justifyContent: isExpanded ? 'flex-start' : 'center', padding: isExpanded ? '8px 10px' : '8px 0' }}
          >
            <div className="rt-user-avatar">{initials}</div>
            {isExpanded && (
              <>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div className="rt-user-name"
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.username}
                  </div>
                  <div className="rt-user-role mono">{roleLabel}</div>
                </div>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.3, flexShrink: 0 }}>
                  <path d="M4.5 3l3 3-3 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
