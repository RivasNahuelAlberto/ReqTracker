import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../components/AuthContext'
import OverviewTabExt from '../components/tabs/OverviewTab'
import DocumentsTab from '../components/tabs/DocumentsTab'
import AboutTab from '../components/tabs/AboutTab'
import SymbolsTabExt from '../components/tabs/SymbolsTab'
import MapTab from '../components/tabs/MapTab'
import ScenariosTabExt from '../components/tabs/ScenariosTab'
import RequirementsTabExt from '../components/tabs/RequirementsTab'
import TasksTab from '../components/tabs/TasksTab'
import InspectionTab from '../components/tabs/InspectionTab'
import ResolveTab from '../components/tabs/ResolveTab'
import AnalyticsTab from '../components/tabs/AnalyticsTab'
import AssistantTab from '../components/tabs/AssistantTab'
import UsersTab from '../components/tabs/UsersTab'
import { fetchProjectNotificationsCount, fetchProjectNotifications } from '../api'

interface Props {
  goBack?: () => void
  isDark: boolean
  toggleTheme: () => void
}

const TAB_ITEMS = [
  { key: 'overview', icon: '▦', label: 'Resumen' },
  { key: 'documents', icon: '⊟', label: 'Documentos' },
  { key: 'about', icon: '◧', label: 'Acerca del Sistema' },
  { key: 'symbols', icon: '◈', label: 'Lista de símbolos' },
  { key: 'map', icon: '⊹', label: 'Mapa de relaciones' },
  { key: 'scenarios', icon: '◉', label: 'Escenarios' },
  { key: 'requirements', icon: '◎', label: 'Requisitos' },
  { key: 'tasks', icon: '✓', label: 'Tareas Pendientes' },
  { key: 'inspection', icon: '⊘', label: 'Inspección' },
  { key: 'resolve', icon: '⚑', label: 'A Resolver' },
  { key: 'analytics', icon: '◐', label: 'Analítica' },
  { key: 'assistant', icon: '⬡', label: 'Asistente IA' },
]

// ─── ProjectPage ───────────────────────────────────────────────────────────────
export default function ProjectPage({ goBack, isDark, toggleTheme }: Props) {
  const navigate = useNavigate()
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { user, socket } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [notificationCount, setNotificationCount] = useState(0)
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; createdAt: string; actor?: { username: string } }>>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [navTarget, setNavTarget] = useState<{ tab: string; itemId: string } | null>(null)

  const handleNavigateTo = (tab: string, itemId: string) => {
    setActiveTab(tab)
    setNavTarget({ tab, itemId })
  }

  const initialIdFor = (tab: string) => navTarget?.tab === tab ? navTarget.itemId : undefined

  const proj = { name: 'Proyecto', description: '' }
  const isSuperAdmin = user?.role === 'super_admin'

  useEffect(() => {
    const loadNotificationCount = async () => {
      if (!projectId) return
      try {
        const data = await fetchProjectNotificationsCount(projectId)
        setNotificationCount(data.count || 0)
      } catch (error) {
        console.warn('Error cargando el conteo de notificaciones:', error)
      }
    }

    loadNotificationCount()
  }, [projectId])

  const toggleNotificationsPanel = async () => {
    if (notificationsOpen) {
      setNotificationsOpen(false)
      return
    }

    setNotificationsOpen(true)
    setNotificationsLoading(true)
    try {
      const data = await fetchProjectNotifications(projectId)
      setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
      setNotificationCount(0)
    } catch (error) {
      console.warn('Error cargando notificaciones:', error)
      setNotifications([])
    } finally {
      setNotificationsLoading(false)
    }
  }

  const currentUserId = user?._id?.toString() || user?.id?.toString() || ''

  useEffect(() => {
    if (!socket || !projectId) return

    const handleNotification = (notification: { id: string; message: string; createdAt: string; actor?: { _id?: string; username?: string } }) => {
      if (!notification || !notification.actor) return
      const actorId = notification.actor._id?.toString() || ''
      if (actorId && currentUserId && actorId === currentUserId) return

      setNotifications((prev) => [notification, ...prev])
      setNotificationCount((count) => count + 1)
    }

    socket.on('projectNotification', handleNotification)

    return () => {
      socket.off('projectNotification', handleNotification)
    }
  }, [socket, projectId, currentUserId])

  const sidebarItems = [
    ...TAB_ITEMS,
    ...(isSuperAdmin ? [{ key: 'users', icon: '⊞', label: 'Equipo' }] : []),
  ]

  return (
    <div className="rt-layout">
      <Sidebar
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeKey={activeTab}
        items={sidebarItems}
        onNavigate={(key) => setActiveTab(key)}
        onNavigateHome={() => navigate('/')}
        onNavigateProfile={() => navigate('/profile')}
        isDark={isDark}
        toggleTheme={toggleTheme}
        navigate={navigate}
        showHomeLink
      />

      <div className="rt-main">

        {/* Top bar */}
        <header className="rt-topbar">
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            {goBack && (
              <button
                className="rt-btn rt-btn-ghost rt-btn-sm"
                onClick={goBack}
                style={{ padding: '4px 10px', gap: 4 }}
              >
                ← Volver
              </button>
            )}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.015em' }}>{proj.name}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>{projectId.toUpperCase()}</div>
            </div>
          </div>

          {/* Notifications */}
          <div style={{ position: 'relative' }}>
            <button
              className="rt-btn rt-btn-ghost rt-btn-sm"
              onClick={toggleNotificationsPanel}
              style={{ position: 'relative', padding: '5px 10px' }}
            >
              ◎ Notificaciones
              {notificationCount > 0 && (
                <span className="rt-notif-badge" style={{ position: 'absolute', top: -4, right: -4 }}>
                  {notificationCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6,
                width: 300, maxHeight: 420, background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, boxShadow: 'var(--shadow)', zIndex: 200, overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Notificaciones</span>
                  <button onClick={() => setNotificationsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 16 }}>×</button>
                </div>
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {notificationsLoading ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-faint)' }}>Cargando notificaciones...</div>
                  ) : notifications.length === 0 ? (
                    <div style={{ padding: '16px', color: 'var(--text-faint)' }}>No hay notificaciones nuevas.</div>
                  ) : (
                    notifications.map((notification) => (
                      <div key={notification.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.4 }}>{notification.message}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>{new Date(notification.createdAt).toLocaleString('es-ES')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{notification.actor?.username || 'Usuario'}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button className="rt-btn rt-btn-ghost rt-btn-sm">↓ Exportar JSON</button>
        </header>

        {/* Tab bar */}
        <div className="rt-tabbar">
          {sidebarItems.map((tab) => (
            <button
              key={tab.key}
              className={`rt-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {activeTab === 'overview' && <OverviewTabExt projectId={projectId} />}
          {activeTab === 'documents' && <DocumentsTab projectId={projectId} />}
          {activeTab === 'about' && <AboutTab projectId={projectId} />}
          {activeTab === 'symbols' && <SymbolsTabExt projectId={projectId} initialId={initialIdFor('symbols')} />}
          {activeTab === 'map' && <MapTab projectId={projectId} />}
          {activeTab === 'scenarios' && <ScenariosTabExt projectId={projectId} initialId={initialIdFor('scenarios')} />}
          {activeTab === 'requirements' && <RequirementsTabExt projectId={projectId} initialId={initialIdFor('requirements')} />}
          {activeTab === 'tasks' && <TasksTab projectId={projectId} onNavigate={handleNavigateTo} />}
          {activeTab === 'inspection' && <InspectionTab projectId={projectId} onNavigate={handleNavigateTo} />}
          {activeTab === 'resolve' && <ResolveTab projectId={projectId} />}
          {activeTab === 'analytics' && <AnalyticsTab projectId={projectId} />}
          {activeTab === 'assistant' && <AssistantTab projectId={projectId} />}
          {activeTab === 'users' && isSuperAdmin && <UsersTab projectId={projectId} />}
        </div>
      </div>
    </div>
  )
}
