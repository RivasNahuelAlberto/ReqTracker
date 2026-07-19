import { useEffect } from 'react'
import type { NavigateFn } from '../App'

interface Props {
  navigate: NavigateFn
}

export default function OAuthSuccess({ navigate }: Props) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const error = params.get('error')

    if (error) {
      navigate({ page: 'login' })
      return
    }

    if (token) {
      try {
        localStorage.setItem('authToken', token)
        navigate({ page: 'home' })
      } catch {
        navigate({ page: 'login' })
      }
    } else {
      navigate({ page: 'login' })
    }
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0C14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        {/* Logo mark */}
        <div style={{
          width: 56, height: 56,
          background: 'rgba(99,102,241,0.15)',
          border: '1.5px solid rgba(99,102,241,0.5)',
          borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: 24,
        }}>⬡</div>

        {/* Spinner */}
        <div style={{
          width: 32, height: 32,
          border: '3px solid rgba(99,102,241,0.2)',
          borderTopColor: '#6366F1',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 20px',
        }} />

        <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>
          Iniciando sesión con Google...
        </div>
        <div style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)' }}>
          Por favor espera mientras verificamos tu cuenta.
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
