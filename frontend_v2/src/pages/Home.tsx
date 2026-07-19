import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../components/AuthContext'
import { createProject, createProjectFromJson, deleteProject, fetchProjects, fetchProjectCode, setProjectSecurity } from '../api'

interface Props {
  isDark: boolean
  toggleTheme: () => void
}

const typeOptions = ['Sujeto', 'Objeto', 'Verbo', 'Estado']
const statusStyles: Record<string, { label: string; cls: string }> = {
  active: { label: 'Activo', cls: 'badge-green' },
  review: { label: 'En revisión', cls: 'badge-amber' },
  incomplete: { label: 'Incompleto', cls: 'badge-red' },
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function Home({ isDark, toggleTheme }: Props) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('projects')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [message, setMessage] = useState('')
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [newName, setNewName] = useState('')
  const [adminUser, setAdminUser] = useState('')
  const [adminPass, setAdminPass] = useState('')
  const [seedSymbols, setSeedSymbols] = useState([{ name: '', type: 'Sujeto' }])
  const [isCreating, setIsCreating] = useState(false)
  const [importJsonFile, setImportJsonFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [showCodeModal, setShowCodeModal] = useState(false)
  const [modalCode, setModalCode] = useState('')
  const [modalHash, setModalHash] = useState('')
  const [modalProjectName, setModalProjectName] = useState('')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')

  const isSuperAdmin = user?.role === 'super_admin'

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    setIsLoadingProjects(true)
    try {
      const data = await fetchProjects()
      setProjects(Array.isArray(data) ? data : [])
    } catch {
      setMessage('Error al cargar proyectos')
    } finally {
      setIsLoadingProjects(false)
    }
  }

  const sidebarItems = [
    { key: 'projects', icon: '▤', label: 'Proyectos' },
    ...(isSuperAdmin ? [
      { key: 'create', icon: '+', label: 'Nuevo proyecto' },
      { key: 'roles', icon: '⊞', label: 'Roles y permisos' },
    ] : []),
  ]

  const filteredProjects = useMemo(() => projects.filter((p: any) =>
    (p.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  ), [projects, searchQuery])

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) { setMessage('El nombre del proyecto es requerido.'); return }
    if (!adminUser.trim() || !adminPass.trim()) { setMessage('El username y la contraseña del administrador son obligatorios.'); return }
    const filledSeeds = seedSymbols.map((item) => ({ name: item.name.trim(), type: item.type.trim() }))
    if (!filledSeeds.length || filledSeeds.some((item) => !item.name || !item.type)) { setMessage('Todos los símbolos semilla deben tener nombre y tipo.'); return }
    setIsCreating(true)
    try {
      await createProject(newName.trim(), filledSeeds, adminUser.trim(), adminPass.trim())
      setNewName(''); setAdminUser(''); setAdminPass('')
      setSeedSymbols([{ name: '', type: 'Sujeto' }])
      setShowCreateModal(false)
      setMessage('Proyecto creado correctamente. Usá "Ver código" para compartir el hash.')
      await loadProjects()
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'No se pudo crear el proyecto.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleSelectJsonFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setImportJsonFile(file)
  }

  const handleCreateFromJson = async () => {
    if (!importJsonFile) {
      setMessage('Selecciona un archivo JSON para importar.')
      return
    }
    try {
      const jsonText = await importJsonFile.text()
      const parsed = JSON.parse(jsonText)
      await createProjectFromJson(parsed)
      setImportJsonFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setMessage('Proyecto importado correctamente desde JSON.')
      await loadProjects()
      setActiveSection('projects')
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'JSON inválido o formato incorrecto.')
    }
  }

  const handleOpenCode = async (project: any) => {
    setShowCodeModal(true)
    setModalCode(''); setModalProjectName(project.name); setModalError(''); setModalLoading(true)
    try {
      const data = await fetchProjectCode(project._id || project.id)
      setModalCode(data.securityCode || '')
      setModalHash(data.projectHash || '')
    } catch (error: any) {
      setModalError(error?.response?.data?.message || 'No se pudo obtener el código del proyecto.')
    } finally {
      setModalLoading(false)
    }
  }

  const handleCopyCode = async () => { if (!modalCode) return; try { await navigator.clipboard.writeText(modalCode); setMessage('Código copiado al portapapeles.') } catch { setMessage('No se pudo copiar el código.') } }
  const handleCopyHash = async () => { if (!modalHash) return; try { await navigator.clipboard.writeText(modalHash); setMessage('Hash copiado al portapapeles.') } catch { setMessage('No se pudo copiar el hash al portapapeles.') } }
  const handleSetSecurity = async (projectId: string) => { const code = window.prompt('Ingrese un código de seguridad para este proyecto:'); if (!code?.trim()) return; try { await setProjectSecurity(projectId, code.trim()); setMessage('Código de seguridad establecido correctamente.'); await loadProjects(); } catch (error: any) { setMessage(error?.response?.data?.message || 'No se pudo establecer el código de seguridad.') } }
  const handleDelete = async (project: any) => { if (!window.confirm('¿Eliminar este proyecto?')) return; if (!project.hasSecurity) { setMessage('Este proyecto no tiene código de seguridad. Establezca uno antes de eliminarlo.'); return } const code = window.prompt('Ingrese el código de seguridad para eliminar el proyecto:'); if (!code?.trim()) return; try { await deleteProject(project._id || project.id, code.trim()); await loadProjects(); } catch (error: any) { setMessage(error?.response?.data?.message || 'Error al eliminar el proyecto') } }

  const s = {
    label: { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 } as React.CSSProperties,
  }

  return (
    <div className="rt-layout">
      <Sidebar
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeKey={activeSection}
        items={sidebarItems}
        onNavigate={(key) => {
          if (key === 'create') { setActiveSection('projects'); setShowCreateModal(true) }
          else setActiveSection(key)
        }}
        onNavigateHome={() => {}}
        onNavigateProfile={() => navigate('/profile')}
        isDark={isDark}
        toggleTheme={toggleTheme}
        navigate={navigate}
      />

      <div className="rt-main">

        {/* Top bar */}
        <header className="rt-topbar">
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              display: 'none', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)',
              padding: '4px 8px',
            }}
            className="sidebar-toggle-btn"
          >
            ☰
          </button>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Proyectos
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
              {filteredProjects.length} proyecto{filteredProjects.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
              fontSize: 13, color: 'var(--text-faint)',
            }}>⌕</span>
            <input
              className="rt-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar proyectos..."
              style={{ width: 220, paddingLeft: 28, fontSize: 12.5 }}
            />
          </div>

          {isSuperAdmin && (
            <button
              className="rt-btn rt-btn-primary rt-btn-sm"
              onClick={() => setShowCreateModal(true)}
            >
              + Nuevo proyecto
            </button>
          )}

          <button
            className="rt-btn rt-btn-ghost rt-btn-sm"
            onClick={signOut}
          >
            Salir
          </button>
        </header>

        {/* Message */}
        {message && (
          <div style={{
            margin: '16px 24px 0', padding: '10px 14px',
            background: 'var(--accent-soft)', border: '1px solid var(--accent)',
            borderRadius: 6, fontSize: 12.5, color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            {message}
            <button onClick={() => setMessage('')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 15, color: 'var(--accent)', fontFamily: 'inherit',
            }}>×</button>
          </div>
        )}

        {/* Main content */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>

          {/* Stats row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24
          }}>
            {[
              { label: 'PROYECTOS', value: projects.length },
              { label: 'SÍMBOLOS TOTAL', value: projects.reduce((s, p) => s + p.symbols, 0) },
              { label: 'ESCENARIOS', value: projects.reduce((s, p) => s + p.scenarios, 0) },
              { label: 'REQUISITOS', value: projects.reduce((s, p) => s + p.requirements, 0) },
            ].map((stat) => (
              <div key={stat.label} className="rt-metric-card">
                <div className="rt-metric-card-label">{stat.label}</div>
                <div className="rt-metric-card-value">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Project grid */}
          {activeSection === 'projects' && (
            <>
              {isLoadingProjects ? (
                <div className="rt-empty"><span className="rt-empty-icon">⏳</span><span style={{ fontSize: 13 }}>Cargando proyectos...</span></div>
              ) : filteredProjects.length === 0 ? (
                <div className="rt-empty">
                  <span className="rt-empty-icon">⬚</span>
                  <span style={{ fontSize: 13 }}>No se encontraron proyectos</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                  {filteredProjects.map((project: any) => {
                    const st = statusStyles[project.status || 'active'] || statusStyles.active
                    return (
                      <div key={project._id || project.id} className="rt-card" style={{ padding: 20 }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 style={{
                              fontSize: 14.5, fontWeight: 700, color: 'var(--text)',
                              letterSpacing: '-0.015em', marginBottom: 4, lineHeight: 1.3,
                            }}>
                              {project.name}
                            </h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                              {project.description || project.about?.intro || 'Sin descripción' }
                            </p>
                          </div>
                          <span className={`badge ${st.cls}`} style={{ marginLeft: 10, flexShrink: 0 }}>
                            {st.label}
                          </span>
                        </div>

                        {/* Metrics row */}
                        <div style={{
                          display: 'flex', gap: 16, padding: '10px 0',
                          borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
                          margin: '10px 0',
                        }}>
                          {[
                            { label: 'SÍM', value: project.symbols?.length || project.symbolCount || 0 },
                            { label: 'ESC', value: project.scenarios?.length || project.scenarioCount || 0 },
                            { label: 'REQ', value: project.requirements?.length || project.requirementCount || 0 },
                          ].map((m) => (
                            <div key={m.label} style={{ textAlign: 'center' }}>
                              <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
                                {m.value}
                              </div>
                              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-faint)', marginTop: 2 }}>
                                {m.label}
                              </div>
                            </div>
                          ))}
                          <div style={{ flex: 1 }} />
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                              Creado {new Date(project.createdAt || project.created_at || Date.now()).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                            {!project.hasSecurity && (
                              <span className="badge badge-amber" style={{ marginTop: 2 }}>Sin código</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            className="rt-btn rt-btn-primary rt-btn-sm"
                            onClick={() => navigate(`/project/${project._id || project.id}`)}
                          >
                            Abrir →
                          </button>
                          {(user?.role === 'super_admin' || project.canManage) && (
                            <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => handleOpenCode(project)}>
                              Ver código
                            </button>
                          )}
                          {!project.hasSecurity && (
                            <button className="rt-btn rt-btn-ghost rt-btn-sm" style={{ color: 'var(--warning)' }}>
                              Establecer código
                            </button>
                          )}
                          {(user?.role === 'super_admin' || project.canManage) && (
                            <button
                              className="rt-btn rt-btn-danger rt-btn-sm"
                              onClick={() => setShowDeleteConfirm(project._id || project.id)}
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Roles section */}
          {activeSection === 'roles' && (() => {
            const ALL_PROJECTS = ['all', 'SGA-2024', 'LMS-Core', 'E-Commerce']
            const filtered = rolesUsers
              .filter((u) => rolesProject === 'all' || u.project === rolesProject)
              .filter((u) => {
                if (!rolesSearch.trim()) return true
                const q = rolesSearch.toLowerCase()
                if (rolesSearchField === 'usuario') return u.username.toLowerCase().includes(q)
                if (rolesSearchField === 'email') return u.email.toLowerCase().includes(q)
                return u.project.toLowerCase().includes(q)
              })
              .sort((a, b) => rolesSortOrder === 'asc' ? a.username.localeCompare(b.username) : b.username.localeCompare(a.username))
            const pageCount = Math.max(1, Math.ceil(filtered.length / rolesPageSize))
            const paginated = filtered.slice((rolesPage - 1) * rolesPageSize, rolesPage * rolesPageSize)

            const handleRolesRoleChange = (id: string, role: string) => {
              setRolesUsers((prev) => prev.map((u) => u.id === id ? { ...u, role } : u))
            }
            const handleRolesRemove = (id: string) => setRolesUsers((prev) => prev.filter((u) => u.id !== id))
            const handleAssign = () => {
              if (!assignUsername.trim()) return
              const exists = rolesUsers.find((u) => u.username === assignUsername.trim() && u.project === assignProject)
              if (exists) { setRolesMsg('El usuario ya está asignado a ese proyecto.'); setTimeout(() => setRolesMsg(''), 3000); return }
              setRolesUsers((prev) => [...prev, { id: `r-${Date.now()}`, username: assignUsername.trim(), email: `${assignUsername.trim()}@empresa.com`, role: assignRole, project: assignProject, projects: 1 }])
              setAssignUsername('')
              setRolesMsg(`Usuario asignado a ${assignProject}.`)
              setTimeout(() => setRolesMsg(''), 3000)
            }
            const handleCreateRoleUser = () => {
              if (!newRoleUser.username.trim() || !newRoleUser.email.trim()) return
              setRolesUsers((prev) => [...prev, { id: `r-${Date.now()}`, username: newRoleUser.username.trim(), email: newRoleUser.email.trim(), role: newRoleUser.role, project: newRoleUser.project, projects: 1 }])
              setNewRoleUser({ username: '', email: '', password: '', role: 'usuario', project: 'SGA-2024' })
              setShowCreateRoleModal(false)
              setRolesMsg('Usuario creado y asignado.')
              setTimeout(() => setRolesMsg(''), 3000)
            }

            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Administración de roles</h2>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Gestión de permisos globales. Solo disponible para super_admin.</p>
                  </div>
                  <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setShowCreateRoleModal(true)}>+ Nuevo usuario</button>
                </div>

                {/* Assign existing */}
                <div className="rt-card" style={{ padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Asignar usuario existente</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div className="rt-label" style={{ marginBottom: 4 }}>Usuario</div>
                      <input className="rt-input" value={assignUsername} onChange={(e) => setAssignUsername(e.target.value)} placeholder="usuario.apellido" style={{ width: '100%' }} />
                    </div>
                    <div style={{ minWidth: 120 }}>
                      <div className="rt-label" style={{ marginBottom: 4 }}>Proyecto</div>
                      <select className="rt-select" value={assignProject} onChange={(e) => setAssignProject(e.target.value)} style={{ width: '100%' }}>
                        {ALL_PROJECTS.filter((p) => p !== 'all').map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div style={{ minWidth: 120 }}>
                      <div className="rt-label" style={{ marginBottom: 4 }}>Rol</div>
                      <select className="rt-select" value={assignRole} onChange={(e) => setAssignRole(e.target.value)} style={{ width: '100%' }}>
                        <option value="usuario">usuario</option>
                        <option value="super_admin">super_admin</option>
                        <option value="invitado">invitado</option>
                      </select>
                    </div>
                    <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={handleAssign} disabled={!assignUsername.trim()}>Asignar</button>
                  </div>
                  {rolesMsg && <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 8 }}>{rolesMsg}</div>}
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                  <select className="rt-select" value={rolesProject} onChange={(e) => { setRolesProject(e.target.value); setRolesPage(1) }} style={{ minWidth: 130 }}>
                    {ALL_PROJECTS.map((p) => <option key={p} value={p}>{p === 'all' ? 'Todos los proyectos' : p}</option>)}
                  </select>
                  <select className="rt-select" value={rolesSearchField} onChange={(e) => setRolesSearchField(e.target.value as 'usuario' | 'email' | 'proyecto')} style={{ minWidth: 110 }}>
                    <option value="usuario">Usuario</option>
                    <option value="email">Email</option>
                    <option value="proyecto">Proyecto</option>
                  </select>
                  <input className="rt-input" value={rolesSearch} onChange={(e) => { setRolesSearch(e.target.value); setRolesPage(1) }} placeholder="Buscar..." style={{ flex: 1, minWidth: 150 }} />
                  <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setRolesSortOrder((o) => o === 'asc' ? 'desc' : 'asc')}>
                    {rolesSortOrder === 'asc' ? '↑ A–Z' : '↓ Z–A'}
                  </button>
                  <select className="rt-select" value={rolesPageSize} onChange={(e) => { setRolesPageSize(Number(e.target.value)); setRolesPage(1) }}>
                    <option value={10}>10 / pág</option>
                    <option value={25}>25 / pág</option>
                    <option value={50}>50 / pág</option>
                    <option value={100}>100 / pág</option>
                  </select>
                </div>

                {/* Table */}
                <div className="rt-card" style={{ overflow: 'hidden', marginBottom: 10 }}>
                  <table className="rt-table">
                    <thead>
                      <tr>
                        <th>USUARIO</th>
                        <th>EMAIL</th>
                        <th>PROYECTO</th>
                        <th>ROL ACTUAL</th>
                        <th>PROYECTOS</th>
                        <th>ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((u) => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 600 }}>{u.username}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{u.email}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.project}</td>
                          <td>
                            <span className={`badge mono ${u.role === 'super_admin' ? 'badge-blue' : u.role === 'usuario' ? 'badge-green' : 'badge-muted'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="mono" style={{ color: 'var(--text-muted)' }}>{u.projects}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <select className="rt-select" value={u.role} onChange={(e) => handleRolesRoleChange(u.id, e.target.value)} style={{ width: 120, padding: '3px 8px', fontSize: 12 }}>
                                <option value="usuario">usuario</option>
                                <option value="super_admin">super_admin</option>
                                <option value="invitado">invitado</option>
                              </select>
                              <button className="rt-btn rt-btn-danger rt-btn-sm" onClick={() => handleRolesRemove(u.id)}>Quitar</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {paginated.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: 20, fontSize: 12 }}>Sin resultados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pageCount > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="rt-btn rt-btn-ghost rt-btn-sm" disabled={rolesPage === 1} onClick={() => setRolesPage((p) => p - 1)}>‹ Ant</button>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pág {rolesPage} de {pageCount}</span>
                    <button className="rt-btn rt-btn-ghost rt-btn-sm" disabled={rolesPage === pageCount} onClick={() => setRolesPage((p) => p + 1)}>Sig ›</button>
                  </div>
                )}

                {/* Create user modal */}
                {showCreateRoleModal && (
                  <div className="rt-modal-backdrop" onClick={() => setShowCreateRoleModal(false)}>
                    <div className="rt-modal" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
                      <div className="rt-modal-header">
                        <div>
                          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Nuevo usuario</h2>
                        </div>
                        <button onClick={() => setShowCreateRoleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: '2px 6px' }}>×</button>
                      </div>
                      <div className="rt-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <label className="rt-label">Nombre de usuario *</label>
                          <input className="rt-input" value={newRoleUser.username} onChange={(e) => setNewRoleUser((p) => ({ ...p, username: e.target.value }))} placeholder="ana.garcia" style={{ width: '100%', marginTop: 5 }} />
                        </div>
                        <div>
                          <label className="rt-label">Email *</label>
                          <input className="rt-input" type="email" value={newRoleUser.email} onChange={(e) => setNewRoleUser((p) => ({ ...p, email: e.target.value }))} placeholder="ana@empresa.com" style={{ width: '100%', marginTop: 5 }} />
                        </div>
                        <div>
                          <label className="rt-label">Contraseña</label>
                          <input className="rt-input" type="password" value={newRoleUser.password} onChange={(e) => setNewRoleUser((p) => ({ ...p, password: e.target.value }))} placeholder="••••••••" style={{ width: '100%', marginTop: 5 }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <label className="rt-label">Rol</label>
                            <select className="rt-select" value={newRoleUser.role} onChange={(e) => setNewRoleUser((p) => ({ ...p, role: e.target.value }))} style={{ width: '100%', marginTop: 5 }}>
                              <option value="usuario">usuario</option>
                              <option value="super_admin">super_admin</option>
                              <option value="invitado">invitado</option>
                            </select>
                          </div>
                          <div>
                            <label className="rt-label">Proyecto</label>
                            <select className="rt-select" value={newRoleUser.project} onChange={(e) => setNewRoleUser((p) => ({ ...p, project: e.target.value }))} style={{ width: '100%', marginTop: 5 }}>
                              {ALL_PROJECTS.filter((p) => p !== 'all').map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="rt-modal-footer">
                        <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setShowCreateRoleModal(false)}>Cancelar</button>
                        <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={handleCreateRoleUser} disabled={!newRoleUser.username.trim() || !newRoleUser.email.trim()}>Crear usuario</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* ── Create project modal ────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="rt-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="rt-modal rt-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modal-header">
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Nuevo proyecto</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Completá los datos del proyecto y sus símbolos semilla
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: '2px 6px' }}
              >×</button>
            </div>
            <div className="rt-modal-body">
              <form onSubmit={handleCreateProject}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={s.label}>NOMBRE DEL PROYECTO</label>
                    <input className="rt-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Sistema de gestión XYZ" />
                  </div>
                  <div>
                    <label style={s.label}>USUARIO ADMINISTRADOR</label>
                    <input className="rt-input mono" value={adminUser} onChange={(e) => setAdminUser(e.target.value)} placeholder="admin.usuario" />
                  </div>
                  <div>
                    <label style={s.label}>CONTRASEÑA ADMINISTRADOR</label>
                    <input className="rt-input" type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} placeholder="••••••••" />
                  </div>
                </div>

                <div style={{ marginBottom: 6 }}>
                  <label style={s.label}>SÍMBOLOS SEMILLA</label>
                </div>
                {seedSymbols.map((sym, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                    <input
                      className="rt-input"
                      value={sym.name}
                      onChange={(e) => setSeedSymbols(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                      placeholder="Nombre del símbolo"
                    />
                    <select
                      className="rt-select"
                      value={sym.type}
                      onChange={(e) => setSeedSymbols(prev => prev.map((s, i) => i === idx ? { ...s, type: e.target.value } : s))}
                    >
                      {typeOptions.map((t) => <option key={t}>{t}</option>)}
                    </select>
                    <button
                      type="button"
                      className="rt-btn rt-btn-ghost rt-btn-sm"
                      onClick={() => setSeedSymbols(prev => prev.filter((_, i) => i !== idx))}
                      disabled={seedSymbols.length === 1}
                      style={{ width: 34, justifyContent: 'center', padding: '4px' }}
                    >×</button>
                  </div>
                ))}
                <button
                  type="button"
                  className="rt-btn rt-btn-ghost rt-btn-sm"
                  onClick={() => setSeedSymbols(prev => [...prev, { name: '', type: 'Sujeto' }])}
                  style={{ marginBottom: 16 }}
                >
                  + Agregar símbolo semilla
                </button>

                <hr className="rt-divider" style={{ margin: '20px 0' }} />

                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                    Importar desde JSON
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                    Alternativamente, cargá un archivo JSON con el esquema del proyecto.
                  </p>
                  <button type="button" className="rt-btn rt-btn-ghost rt-btn-sm">
                    ↑ Seleccionar archivo JSON
                  </button>
                </div>

                {message && (
                  <div style={{ marginTop: 14, padding: '8px 12px', background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 6, fontSize: 12, color: 'var(--danger)' }}>
                    {message}
                  </div>
                )}

                <div className="rt-modal-footer" style={{ padding: '16px 0 0', border: 'none' }}>
                  <button type="button" className="rt-btn rt-btn-ghost" onClick={() => setShowCreateModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="rt-btn rt-btn-primary" disabled={isCreating}>
                    {isCreating ? <><span className="rt-spinner" />&nbsp;Creando...</> : 'Crear proyecto'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ──────────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="rt-modal-backdrop" onClick={() => setShowDeleteConfirm(null)}>
          <div className="rt-modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="rt-modal-header">
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)' }}>Eliminar proyecto</h2>
              <button onClick={() => setShowDeleteConfirm(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>×</button>
            </div>
            <div className="rt-modal-body">
              <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 14 }}>
                Esta acción es irreversible. Ingresá el código de seguridad del proyecto para confirmar.
              </p>
              <input className="rt-input mono" placeholder="Código de seguridad" />
            </div>
            <div className="rt-modal-footer">
              <button className="rt-btn rt-btn-ghost" onClick={() => setShowDeleteConfirm(null)}>Cancelar</button>
              <button className="rt-btn rt-btn-danger" onClick={() => setShowDeleteConfirm(null)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
