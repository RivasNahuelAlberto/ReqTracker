import type { NavigateFn, User } from '../App'
import Sidebar from '../components/Sidebar'
import { useState } from 'react'

interface Props {
  user: User
  onLogout: () => void
  onUpdateUser?: (updates: Partial<User>) => void
  goBack?: () => void
  isDark: boolean
  toggleTheme: () => void
  navigate: NavigateFn
}

export default function Profile({ user, onLogout, onUpdateUser, goBack, isDark, toggleTheme, navigate }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [usernameDraft, setUsernameDraft] = useState(user.username)
  const [emailDraft, setEmailDraft] = useState(user.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savedMsg, setSavedMsg] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const initials = user.username
    .split('.')
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)

  const startEdit = () => {
    setUsernameDraft(user.username)
    setEmailDraft(user.email)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setErrors({})
    setEditMode(true)
  }

  const cancelEdit = () => {
    setEditMode(false)
    setErrors({})
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!usernameDraft.trim()) e.username = 'El nombre de usuario no puede estar vacío'
    if (!emailDraft.trim()) e.email = 'El email no puede estar vacío'
    if (emailDraft && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDraft)) e.email = 'Email inválido'
    if (newPassword) {
      if (!currentPassword) e.currentPassword = 'Ingresá la contraseña actual para cambiarla'
      if (newPassword.length < 6) e.newPassword = 'La nueva contraseña debe tener al menos 6 caracteres'
      if (newPassword !== confirmPassword) e.confirmPassword = 'Las contraseñas no coinciden'
    }
    return e
  }

  const handleSave = () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    onUpdateUser?.({ username: usernameDraft.trim(), email: emailDraft.trim() })
    setSavedMsg('Datos guardados correctamente.')
    setEditMode(false)
    setErrors({})
    setTimeout(() => setSavedMsg(''), 3500)
  }

  return (
    <div className="rt-layout">
      <Sidebar
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeKey="profile"
        items={[]}
        onNavigate={() => {}}
        onNavigateHome={() => navigate({ page: 'home' })}
        onNavigateProfile={() => {}}
        isDark={isDark}
        toggleTheme={toggleTheme}
        navigate={navigate}
        showHomeLink
      />

      <div className="rt-main">
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
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Perfil</span>
          </div>
          <button className="rt-btn rt-btn-danger rt-btn-sm" onClick={onLogout}>
            Cerrar sesión
          </button>
        </header>

        <div style={{ padding: '32px 24px', maxWidth: 640 }}>

          {savedMsg && (
            <div style={{
              padding: '10px 16px', borderRadius: 6, marginBottom: 16,
              background: 'var(--success-soft)', border: '1px solid var(--success)',
              color: 'var(--success)', fontSize: 13, fontWeight: 500,
            }}>
              ✓ {savedMsg}
            </div>
          )}

          {/* Profile header */}
          <div className="rt-card" style={{ padding: 28, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--accent-soft)', border: '2px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, color: 'var(--accent)',
              letterSpacing: '-0.03em', flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text)', marginBottom: 4 }}>
                {user.username}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`badge mono ${user.role === 'super_admin' ? 'badge-blue' : user.role === 'usuario' ? 'badge-green' : 'badge-muted'}`}>
                  {user.role}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{user.email}</span>
              </div>
            </div>
          </div>

          {/* Edit form or data fields */}
          <div className="rt-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Datos del usuario</h2>
              {!editMode && (
                <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={startEdit}>
                  ✎ Editar perfil
                </button>
              )}
            </div>

            {editMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Username */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 5 }}>
                    Nombre de usuario
                  </label>
                  <input
                    className="rt-input"
                    value={usernameDraft}
                    onChange={e => setUsernameDraft(e.target.value)}
                    autoFocus
                  />
                  {errors.username && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{errors.username}</div>}
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 5 }}>
                    Email
                  </label>
                  <input
                    className="rt-input"
                    type="email"
                    value={emailDraft}
                    onChange={e => setEmailDraft(e.target.value)}
                  />
                  {errors.email && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{errors.email}</div>}
                </div>

                {/* Read-only fields */}
                {[
                  { label: 'ROL GLOBAL', value: user.role },
                  { label: 'ID DE USUARIO', value: user.id, mono: true },
                ].map((f) => (
                  <div key={f.label}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 5 }}>
                      {f.label}
                    </label>
                    <input
                      className={`rt-input ${f.mono ? 'mono' : ''}`}
                      value={f.value}
                      disabled
                      style={{ background: 'var(--surface-2)', cursor: 'default' }}
                    />
                  </div>
                ))}

                {/* Password change */}
                <div style={{ marginTop: 4, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                    Cambiar contraseña (opcional)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 5 }}>
                        Contraseña actual
                      </label>
                      <input className="rt-input" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" />
                      {errors.currentPassword && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{errors.currentPassword}</div>}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 5 }}>
                        Nueva contraseña
                      </label>
                      <input className="rt-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                      {errors.newPassword && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{errors.newPassword}</div>}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 5 }}>
                        Confirmar nueva contraseña
                      </label>
                      <input className="rt-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repetí la nueva contraseña" />
                      {errors.confirmPassword && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{errors.confirmPassword}</div>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                  <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={cancelEdit}>Cancelar</button>
                  <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={handleSave}>Guardar cambios</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label: 'NOMBRE DE USUARIO', value: user.username },
                  { label: 'EMAIL', value: user.email },
                  { label: 'ROL GLOBAL', value: user.role },
                  { label: 'ID DE USUARIO', value: user.id, mono: true },
                ].map((f) => (
                  <div key={f.label}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 5 }}>
                      {f.label}
                    </label>
                    <input
                      className={`rt-input ${f.mono ? 'mono' : ''}`}
                      value={f.value}
                      disabled
                      style={{ background: 'var(--surface-2)', cursor: 'default' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Session info */}
          <div className="rt-card" style={{ padding: 24, marginTop: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Sesión activa</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'INICIO DE SESIÓN', value: new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) },
                { label: 'ÚLTIMA ACTIVIDAD', value: 'Hace menos de 1 minuto' },
                { label: 'TEMA', value: isDark ? 'Oscuro' : 'Claro' },
                { label: 'VERSIÓN', value: 'ReqTracker v2.0' },
              ].map((s) => (
                <div key={s.label} style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16 }}>
              <button className="rt-btn rt-btn-danger" onClick={onLogout} style={{ width: '100%', justifyContent: 'center' }}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
