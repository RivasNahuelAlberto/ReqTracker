import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/AuthContext'
import LoginPage from './pages/LoginPage'
import Home from './pages/Home'
import ProjectPage from './pages/ProjectPage'
import Profile from './pages/Profile'
import OAuthSuccess from './pages/OAuthSuccess'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="rt-spinner" style={{ margin: '0 auto 12px' }} />
          <div style={{ color: 'var(--text-muted)' }}>Verificando sesión...</div>
        </div>
      </div>
    )
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const [isDark, setIsDark] = useState(false)
  const toggleTheme = () => setIsDark((d) => !d)

  return (
    <AuthProvider>
      <div className={isDark ? 'dark theme-transition' : 'theme-transition'} style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage isDark={isDark} toggleTheme={toggleTheme} />} />
            <Route path="/auth/success" element={<OAuthSuccess />} />
            <Route path="/" element={<ProtectedRoute><Home isDark={isDark} toggleTheme={toggleTheme} /></ProtectedRoute>} />
            <Route path="/project/:projectId" element={<ProtectedRoute><ProjectPage isDark={isDark} toggleTheme={toggleTheme} /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile isDark={isDark} toggleTheme={toggleTheme} /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </div>
    </AuthProvider>
  )
}
