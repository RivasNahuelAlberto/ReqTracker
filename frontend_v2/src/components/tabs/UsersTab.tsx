import { useEffect, useState } from 'react'
import { useProjectUpdateReload } from '../../hooks/useProjectUpdateReload'
import { assignRole, createUserInProject, fetchProjectUsers, removeUserProjectRole } from '../../api'

type ProjectUser = {
  id: string
  username: string
  email: string
  role: string
}

export default function UsersTab({ projectId }: { projectId: string }) {
  const [users, setUsers] = useState<ProjectUser[]>([])
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteRole, setInviteRole] = useState('usuario')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'usuario' })
  const [inviteMsg, setInviteMsg] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchProjectUsers(projectId)
      setUsers(Array.isArray(data?.users) ? data.users : [])
    } catch {
      setError('No se pudieron cargar los usuarios del proyecto.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!projectId) return
    loadUsers()
  }, [projectId])

  useProjectUpdateReload(projectId, loadUsers)

  const notify = (message: string, isError = false) => {
    if (isError) {
      setError(message)
      setTimeout(() => setError(''), 4000)
      return
    }
    setInviteMsg(message)
    setTimeout(() => setInviteMsg(''), 3000)
  }

  const handleRoleChange = async (username: string, role: string) => {
    setSaving(true)
    try {
      await assignRole(username, role, projectId)
      await loadUsers()
      notify(`Rol de ${username} actualizado a ${role}.`)
    } catch (err: any) {
      notify(err?.response?.data?.message || err?.response?.data?.error || 'No se pudo cambiar el rol.', true)
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (username: string) => {
    setSaving(true)
    setError('')
    try {
      await removeUserProjectRole(username, projectId)
      await loadUsers()
      setInviteMsg(`Se removió a ${username} del proyecto.`)
      setTimeout(() => setInviteMsg(''), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || 'No se pudo remover el usuario.')
    } finally {
      setSaving(false)
    }
  }

  const handleAssign = async () => {
    if (!inviteUsername.trim()) return
    setSaving(true)
    try {
      await assignRole(inviteUsername.trim(), inviteRole, projectId)
      await loadUsers()
      setInviteUsername('')
      setInviteRole('usuario')
      notify(`Usuario "${inviteUsername.trim()}" asignado al proyecto.`)
    } catch (err: any) {
      notify(err?.response?.data?.message || err?.response?.data?.error || 'No se pudo asignar el usuario.', true)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateUser = async () => {
    if (!newUser.username.trim() || !newUser.email.trim()) return
    setSaving(true)
    try {
      await createUserInProject(newUser.username.trim(), newUser.email.trim(), newUser.password, newUser.role, projectId)
      await loadUsers()
      const createdUsername = newUser.username.trim()
      setNewUser({ username: '', email: '', password: '', role: 'usuario' })
      setShowCreateModal(false)
      notify(`Usuario "${createdUsername}" creado y asignado.`)
    } catch (err: any) {
      notify(err?.response?.data?.message || err?.response?.data?.error || 'No se pudo crear el usuario.', true)
    } finally {
      setSaving(false)
    }
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
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)' }}>Cargando usuarios...</div>
        ) : (
          <table className="rt-table">
            <thead>
              <tr>
                <th>USUARIO</th>
                <th>EMAIL</th>
                <th>ROL</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                        {u.username.split('.').map((p) => p[0]?.toUpperCase() ?? '').join('').slice(0, 2)}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{u.username}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                  <td>
                    <span className={`badge mono ${u.role === 'admin' ? 'badge-blue' : u.role === 'usuario' ? 'badge-green' : 'badge-muted'}`} style={{ fontSize: 11 }}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <select className="rt-select" value={u.role} onChange={(e) => handleRoleChange(u.username, e.target.value)} style={{ width: 120, padding: '3px 8px', fontSize: 12 }} disabled={saving}>
                        <option value="admin">admin</option>
                        <option value="usuario">usuario</option>
                        <option value="invitado">invitado</option>
                      </select>
                      <button className="rt-btn rt-btn-danger rt-btn-sm" onClick={() => handleRemove(u.username)} disabled={saving}>Quitar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
              <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={handleCreateUser} disabled={!newUser.username.trim() || !newUser.email.trim() || saving}>Crear usuario</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
