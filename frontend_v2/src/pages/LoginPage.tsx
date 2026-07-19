import { useState } from 'react'
import type { NavigateFn } from '../App'

interface Props {
  onLogin: () => void
  isDark: boolean
  toggleTheme: () => void
  navigate: NavigateFn
}

const GOOGLE_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

export default function LoginPage({ onLogin, isDark, toggleTheme }: Props) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [projectCode, setProjectCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) {
      setError('Completá los campos requeridos.')
      return
    }
    setIsSubmitting(true)
    setTimeout(() => { onLogin(); setIsSubmitting(false) }, 900)
  }

  const sLabel: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
    marginBottom: 5, letterSpacing: '0.02em'
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── Left panel: brand ──────────────────────────────────────────── */}
      <div style={{
        flex: '0 0 400px',
        background: '#0A0C14',
        display: 'flex',
        flexDirection: 'column',
        padding: '40px 44px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Grid texture */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: [
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          ].join(','),
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }} />
        {/* Radial fade */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 70% 30%, rgba(31,94,244,0.18) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 56 }}>
          <div style={{
            width: 32, height: 32, background: '#1F5EF4', borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em',
          }}>R</div>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>
            ReqTracker
          </span>
        </div>

        {/* Headline */}
        <div style={{ flex: 1, position: 'relative' }}>
          <h1 style={{
            fontSize: 34, fontWeight: 800, lineHeight: 1.18,
            letterSpacing: '-0.04em', color: '#FFFFFF', marginBottom: 16,
          }}>
            Gestión de<br />requisitos<br />inteligente.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.65, maxWidth: 280 }}>
            Plataforma de análisis léxico, escenarios y requisitos con IA semántica para equipos de software.
          </p>

          {/* Feature list */}
          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: '◈', text: 'Léxico contextual y relaciones semánticas' },
              { icon: '◉', text: 'Análisis IA de consistencia y riesgo' },
              { icon: '◎', text: 'Colaboración en tiempo real con bloqueo' },
              { icon: '◐', text: 'Analítica avanzada por grafo semántico' },
            ].map((f) => (
              <div key={f.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ color: '#3B82F6', fontSize: 16, marginTop: 1, flexShrink: 0 }}>{f.icon}</span>
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.5 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'relative', fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 32 }}>
          ReqTracker v2.0 · © 2025
        </div>
      </div>

      {/* ── Right panel: form ──────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', padding: '48px 24px', position: 'relative',
      }}>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={{
            position: 'absolute', top: 20, right: 20,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '6px 12px',
            cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'inherit',
          }}
        >
          {isDark ? '☀ Claro' : '◐ Oscuro'}
        </button>

        <div style={{ width: '100%', maxWidth: 360 }}>

          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{
              fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em',
              color: 'var(--text)', marginBottom: 6,
            }}>
              {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {isLogin
                ? 'Accedé a tu espacio de trabajo de ReqTracker'
                : 'Creá tu cuenta para comenzar a gestionar requisitos'}
            </p>
          </div>

          <form onSubmit={handleSubmit}>

            {/* Username */}
            <div style={{ marginBottom: 14 }}>
              <label style={sLabel}>USUARIO</label>
              <input
                className="rt-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="tu.usuario"
                autoComplete="username"
              />
            </div>

            {/* Register-only fields */}
            {!isLogin && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={sLabel}>EMAIL</label>
                  <input
                    className="rt-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@empresa.com"
                    autoComplete="email"
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={sLabel}>
                    CÓDIGO DE PROYECTO{' '}
                    <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>(opcional)</span>
                  </label>
                  <input
                    className="rt-input mono"
                    type="text"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    placeholder="ej: abc-123"
                  />
                  <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 4 }}>
                    Ingresá un código para unirte como invitado a un proyecto existente
                  </p>
                </div>
              </>
            )}

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={sLabel}>CONTRASEÑA</label>
              <input
                className="rt-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: '9px 12px', background: 'var(--danger-soft)',
                border: '1px solid var(--danger)', borderRadius: 6,
                color: 'var(--danger)', fontSize: 12.5, marginBottom: 14,
              }}>
                {error}
              </div>
            )}

            {/* Primary CTA */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="rt-btn rt-btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}
            >
              {isSubmitting
                ? <><span className="rt-spinner" />&nbsp;Verificando...</>
                : (isLogin ? 'Iniciar sesión' : 'Crear cuenta')}
            </button>

            {/* OAuth separator + button */}
            {isLogin && (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  margin: '14px 0', color: 'var(--text-faint)', fontSize: 11.5,
                }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  o
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                <button
                  type="button"
                  className="rt-btn rt-btn-ghost"
                  style={{ width: '100%', justifyContent: 'center', padding: '9px' }}
                >
                  {GOOGLE_ICON}
                  Continuar con Google
                </button>
              </>
            )}
          </form>

          {/* Toggle login/register */}
          <p style={{ textAlign: 'center', marginTop: 22, fontSize: 12.5, color: 'var(--text-muted)' }}>
            {isLogin ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
            <button
              onClick={() => { setIsLogin(!isLogin); setError('') }}
              style={{
                background: 'none', border: 'none', color: 'var(--accent)',
                cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                padding: 0,
              }}
            >
              {isLogin ? 'Registrarse' : 'Iniciar sesión'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
