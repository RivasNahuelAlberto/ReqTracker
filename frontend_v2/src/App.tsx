import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import Home from './pages/Home'
import ProjectPage from './pages/ProjectPage'
import Profile from './pages/Profile'

// ─── Types ────────────────────────────────────────────────────────────────────
export type Route =
  | { page: 'login' }
  | { page: 'home' }
  | { page: 'project'; projectId: string }
  | { page: 'profile' }

export type NavigateFn = (route: Route) => void

export interface User {
  id: string
  username: string
  email: string
  role: 'super_admin' | 'usuario' | 'invitado'
}

// ─── Mock user ─────────────────────────────────────────────────────────────────
const MOCK_USER: User = {
  id: 'u1',
  username: 'carlos.mendez',
  email: 'carlos.mendez@empresa.com',
  role: 'super_admin',
}

// ─── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [isDark, setIsDark] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [route, setRoute] = useState<Route>({ page: 'login' })
  const [history, setHistory] = useState<Route[]>([])
  const [user, setUser] = useState<User>(MOCK_USER)

  const navigate: NavigateFn = (r) => {
    setHistory(prev => [...prev, route])
    setRoute(r)
  }

  const goBack = () => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    setRoute(prev)
  }

  const canGoBack = history.length > 0

  const toggleTheme = () => setIsDark((d) => !d)

  const handleLogin = () => {
    setIsLoggedIn(true)
    setRoute({ page: 'home' })
    setHistory([])
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setRoute({ page: 'login' })
    setHistory([])
  }

  const handleUpdateUser = (updates: Partial<User>) => {
    setUser(u => ({ ...u, ...updates }))
  }

  const sharedProps = { isDark, toggleTheme, navigate }

  return (
    <div className={isDark ? 'dark theme-transition' : 'theme-transition'} style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {route.page === 'login' && (
        <LoginPage onLogin={handleLogin} {...sharedProps} />
      )}
      {route.page === 'home' && isLoggedIn && (
        <Home user={user} onLogout={handleLogout} {...sharedProps} />
      )}
      {route.page === 'project' && isLoggedIn && (
        <ProjectPage
          projectId={route.projectId}
          user={user}
          goBack={canGoBack ? goBack : undefined}
          {...sharedProps}
        />
      )}
      {route.page === 'profile' && isLoggedIn && (
        <Profile
          user={user}
          onLogout={handleLogout}
          onUpdateUser={handleUpdateUser}
          goBack={canGoBack ? goBack : undefined}
          {...sharedProps}
        />
      )}
    </div>
  )
}
