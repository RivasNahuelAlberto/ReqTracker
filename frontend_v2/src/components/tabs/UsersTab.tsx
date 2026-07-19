import { useState } from 'react'
import { MOCK_USERS } from '../../data/mockData'

export default function UsersTab({ projectId }: { projectId: string }) {
  void projectId
  const [users, setUsers] = useState(MOCK_USERS.map((u) => ({ ...u })))
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteRole, setInviteRole] = useState('usuario')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'usuario' })
  const [inviteMsg, setInviteMsg] = useState('')

  const handleRoleChange = (userId: string, role: string) => {
    setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, role } : u))
  }

  const handleRemove = (userId: string) => {
    setUsers((prev) => prev.filter((u) => u._id !== userId))
  }

  const handleAssign = () => {
    if (!inviteUsername.trim()) return
    const exists = users.find((u) => u.username === inviteUsername.trim())
    if (exists) { setInviteMsg('El usuario ya está en el proyecto.'); return }
    const newEntry = { _id: `u-${Date.now()}`, username: inviteUsername.trim(), email: `${inviteUsername.trim()}@example.com`, role: inviteRole, joined: new Date().toLocaleDateString('es-AR') }
    setUsers((prev) => [...prev, newEntry])
    setInviteUsername('')
    setInviteMsg(`Usuario "${newEntry.username}" asignado al proyecto.`)
    setTimeout(() => setInviteMsg(''), 3000)
  }

  const handleCreateUser = () => {
    if (!newUser.username.trim() || !newUser.email.trim()) return
    const entry = { _id: `u-${Date.now()}`, username: newUser.username.trim(), email: newUser.email.trim(), role: newUser.role, joined: new Date().toLocaleDateString('es-AR') }
    setUsers((prev) => [...prev, entry])
    setNewUser({ username: '', email: '', password: '', role: 'usuario' })
    setShowCreateModal(false)
    setInviteMsg(`Usuario "${entry.username}" creado y asignado.`)
    setTimeout(() => setInviteMsg(''), 3000)
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Equipo del proyecto</h2>
        <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setShowCreateModal(true)}>+ Nuevo usuario</button>
      </div>

      <div className="rt-card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Asignar usuario existente</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div className="rt-label" style={{ marginBottom: 4 }}>Nombre de usuario</div>
            <input className="rt-input" value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)} placeholder="usuario.apellido" style={{ width: '100%' }} />
          </div>
          <div style={{ minWidth: 130 }}>
            <div className="rt-label" style={{ marginBottom: 4 }}>Rol</div>
            <select className="rt-select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ width: '100%' }}>
              <option value="admin">admin</option>
              <option value="usuario">usuario</option>
              <option value="invitado">invitado</option>
            </select>
          </div>
          <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={handleAssign} disabled={!inviteUsername.trim()}>Asignar</button>
        </div>
        {inviteMsg && <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 8 }}>{inviteMsg}</div>}
      </div>

      <div className="rt-card" style={{ overflow: 'hidden' }}>
        <table className="rt-table">
          <thead>
            <tr>
              <th>USUARIO</th>
              <th>EMAIL</th>
              <th>ROL</th>
              <th>DESDE</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                      {u.username.split('.').map((p: string) => p[0]?.toUpperCase() ?? '').join('').slice(0, 2)}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{u.username}</span>
                  </div>
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                <td>
                  <span className={`badge mono ${u.role === 'admin' ? 'badge-blue' : u.role === 'usuario' ? 'badge-green' : 'badge-muted'}`}>
                    {u.role}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-faint)' }}>{u.joined}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select className="rt-select" value={u.role} onChange={(e) => handleRoleChange(u._id, e.target.value)} style={{ width: 110, padding: '3px 8px', fontSize: 12 }}>
                      <option value="admin">admin</option>
                      <option value="usuario">usuario</option>
                      <option value="invitado">invitado</option>
                    </select>
                    <button className="rt-btn rt-btn-danger rt-btn-sm" onClick={() => handleRemove(u._id)}>Quitar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="rt-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="rt-modal" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="rt-modal-header">
              <div className="rt-modal-title">Nuevo usuario</div>
              <button className="rt-modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <div className="rt-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="rt-label">Nombre de usuario *</label>
                <input className="rt-input" value={newUser.username} onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))} placeholder="ana.garcia" style={{ width: '100%', marginTop: 5 }} />
              </div>
              <div>
                <label className="rt-label">Email *</label>
                <input className="rt-input" type="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} placeholder="ana@example.com" style={{ width: '100%', marginTop: 5 }} />
              </div>
              <div>
                <label className="rt-label">Contraseña</label>
                <input className="rt-input" type="password" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} placeholder="••••••••" style={{ width: '100%', marginTop: 5 }} />
              </div>
              <div>
                <label className="rt-label">Rol en el proyecto</label>
                <select className="rt-select" value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))} style={{ width: '100%', marginTop: 5 }}>
                  <option value="admin">admin</option>
                  <option value="usuario">usuario</option>
                  <option value="invitado">invitado</option>
                </select>
              </div>
            </div>
            <div className="rt-modal-footer">
              <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setShowCreateModal(false)}>Cancelar</button>
              <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={handleCreateUser} disabled={!newUser.username.trim() || !newUser.email.trim()}>Crear usuario</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
