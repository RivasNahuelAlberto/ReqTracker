import { useState, useEffect } from 'react'
import { createScenario, deleteScenario, fetchProject, updateScenario } from '../../api'
import { STATUS_BADGE, STATUS_LABEL } from '../../data/mockData'

type Scenario = {
  _id?: string
  id?: string
  type: string
  title: string
  order?: string
  objective?: string
  actors?: string
  preconditions?: string
  resources?: string
  locationTemporal?: string
  locationGeographic?: string
  episodes?: string
  exceptions?: string
  status?: string
}

const TYPES = ['Escenario', 'Subescenario', 'Episodio']
const STATUSES = ['complete', 'review', 'incomplete']

const SCENARIO_FIELDS = [
  { key: 'objective', label: 'OBJETIVO', rows: 2 },
  { key: 'actors', label: 'ACTORES', rows: 2 },
  { key: 'preconditions', label: 'PRECONDICIONES', rows: 3 },
  { key: 'resources', label: 'RECURSOS', rows: 2 },
  { key: 'locationTemporal', label: 'UBICACIÓN TEMPORAL', rows: 1 },
  { key: 'locationGeographic', label: 'UBICACIÓN GEOGRÁFICA', rows: 1 },
  { key: 'episodes', label: 'EPISODIOS', rows: 6 },
  { key: 'exceptions', label: 'EXCEPCIONES', rows: 3 },
] as const

const EMPTY: Omit<Scenario, '_id' | 'id'> = { type: 'Escenario', title: '', order: '', objective: '', actors: '', preconditions: '', resources: '', locationTemporal: '', locationGeographic: '', episodes: '', exceptions: '', status: 'incomplete' }

export default function ScenariosTab({ projectId, initialId }: { projectId: string; initialId?: string }) {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selected, setSelected] = useState<Scenario | null>(null)
  const [typeFilter, setTypeFilter] = useState('Todos')
  const [search, setSearch] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editDraft, setEditDraft] = useState<Scenario>({ ...EMPTY, title: '' })
  const [showCreate, setShowCreate] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [draft, setDraft] = useState<Omit<Scenario, '_id' | 'id'>>({ ...EMPTY })

  const activeScenario = selected ?? (scenarios[0] ? scenarios[0] : { ...EMPTY, title: '' })

  const loadScenarios = async () => {
    setIsLoading(true)
    setError('')
    try {
      const data = await fetchProject(projectId)
      const normalized = Array.isArray(data?.scenarios) ? data.scenarios : []
      setScenarios(normalized)
      const initialSelection = normalized.find((item) => item._id === initialId || item.id === initialId) || normalized[0] || null
      setSelected(initialSelection)
      setEditDraft(initialSelection ? { ...initialSelection } : { ...EMPTY, title: '' })
    } catch {
      setError('No se pudieron cargar los escenarios del proyecto.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!projectId) return
      if (!mounted) return
      await loadScenarios()
    }
    run()
    return () => {
      mounted = false
    }
  }, [projectId])

  useEffect(() => {
    if (!initialId || scenarios.length === 0) return
    const found = scenarios.find((item) => item._id === initialId || item.id === initialId)
    if (found) {
      setSelected(found)
      setEditDraft({ ...found })
      setEditMode(false)
    }
  }, [initialId, scenarios])

  const filtered = scenarios.filter((item) => {
    const q = search.toLowerCase()
    return (typeFilter === 'Todos' || item.type === typeFilter) && (!q || item.title.toLowerCase().includes(q))
  })

  const handleSelect = (sc: Scenario) => {
    setSelected(sc)
    setEditDraft({ ...sc })
    setEditMode(false)
  }

  const handleSaveEdit = async () => {
    if (!selected || !selected._id) return
    setIsSaving(true)
    try {
      const saved = await updateScenario(projectId, selected._id, {
        ...editDraft,
        title: editDraft.title.trim(),
        type: editDraft.type,
        status: editDraft.status || 'incomplete',
        order: editDraft.order || '',
      })
      setScenarios((prev) => prev.map((item) => (item._id === selected._id || item.id === selected._id ? { ...item, ...saved } : item)))
      setSelected((prev) => prev ? { ...prev, ...saved } : prev)
      setEditMode(false)
    } catch {
      setError('No se pudo actualizar el escenario.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreate = async () => {
    if (!draft.title.trim()) return
    setIsSaving(true)
    try {
      const created = await createScenario(projectId, {
        ...draft,
        title: draft.title.trim(),
        order: draft.order || '',
      })
      await loadScenarios()
      setSelected(created)
      setDraft({ ...EMPTY })
      setShowCreate(false)
      setEditMode(false)
    } catch {
      setError('No se pudo crear el escenario.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selected || !selected._id) return
    setIsSaving(true)
    try {
      await deleteScenario(projectId, selected._id)
      await loadScenarios()
      setShowDelete(false)
    } catch {
      setError('No se pudo eliminar el escenario.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0, height: 'calc(100vh - 140px)', overflow: 'hidden' }}>
      {/* List */}
      <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input className="rt-input" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 12 }} />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['Todos', ...TYPES].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} className="rt-btn rt-btn-ghost rt-btn-sm" style={{
                padding: '2px 6px', fontSize: 11, border: 'none',
                background: typeFilter === t ? 'var(--accent-soft)' : 'transparent',
                color: typeFilter === t ? 'var(--accent)' : 'var(--text-muted)',
              }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {isLoading ? (
            <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '16px 8px' }}>Cargando escenarios...</div>
          ) : error ? (
            <div style={{ fontSize: 12, color: 'var(--danger)', padding: '16px 8px' }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '16px 8px' }}>No hay escenarios para mostrar.</div>
          ) : filtered.map((sc) => (
            <button key={sc._id || sc.id} onClick={() => handleSelect(sc)} style={{
              width: '100%', textAlign: 'left', padding: '8px 10px',
              background: activeScenario._id === (sc._id || sc.id) ? 'var(--accent-soft)' : 'transparent',
              border: 'none', borderRadius: 5, cursor: 'pointer', marginBottom: 2,
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', width: 28, flexShrink: 0, marginTop: 2 }}>{sc.order || ''}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: activeScenario._id === (sc._id || sc.id) ? 'var(--accent)' : 'var(--text)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{sc.type}</div>
              </div>
              <span className={`badge ${STATUS_BADGE[sc.status || 'incomplete']}`} style={{ fontSize: 10, flexShrink: 0 }}>{STATUS_LABEL[sc.status || 'incomplete']}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
          <button className="rt-btn rt-btn-primary rt-btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setDraft({ ...EMPTY }); setShowCreate(true) }}>
            + Nuevo escenario
          </button>
        </div>
      </div>

      {/* Detail */}
      <div style={{ overflow: 'auto', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text)' }}>{activeScenario.title || 'Sin selección'}</h2>
              {!editMode && activeScenario._id && (
                <>
                  <span className="badge badge-muted">{activeScenario.type}</span>
                  <span className={`badge ${STATUS_BADGE[activeScenario.status || 'incomplete']}`}>{STATUS_LABEL[activeScenario.status || 'incomplete']}</span>
                </>
              )}
            </div>
            {activeScenario._id && (
              <div className="mono" style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>SCN-{activeScenario.order || ''}</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {editMode ? (
              <>
                <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setEditMode(false)}>Cancelar</button>
                <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={handleSaveEdit} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar'}</button>
              </>
            ) : (
              <>
                <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => { setEditDraft({ ...activeScenario }); setEditMode(true) }} disabled={!activeScenario._id}>Editar</button>
                <button className="rt-btn rt-btn-danger rt-btn-sm" onClick={() => setShowDelete(true)} disabled={!activeScenario._id}>Eliminar</button>
              </>
            )}
          </div>
        </div>

        {editMode && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div>
              <label className="rt-label">TIPO</label>
              <select className="rt-select" value={editDraft.type} onChange={(e) => setEditDraft((prev) => ({ ...prev, type: e.target.value }))} style={{ marginTop: 4 }}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="rt-label">ESTADO</label>
              <select className="rt-select" value={editDraft.status || 'incomplete'} onChange={(e) => setEditDraft((prev) => ({ ...prev, status: e.target.value }))} style={{ marginTop: 4 }}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="rt-label">ORDEN</label>
              <input className="rt-input mono" value={editDraft.order || ''} onChange={(e) => setEditDraft((prev) => ({ ...prev, order: e.target.value }))} style={{ marginTop: 4, width: '100%' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="rt-label">TÍTULO</label>
              <input className="rt-input" value={editDraft.title} onChange={(e) => setEditDraft((prev) => ({ ...prev, title: e.target.value }))} style={{ marginTop: 4, width: '100%' }} />
            </div>
          </div>
        )}

        <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {SCENARIO_FIELDS.map((field) => (
            <div key={field.key} className="rt-detail-field">
              <span className="rt-detail-label">{field.label}</span>
              {editMode ? (
                <textarea className="rt-textarea" value={String(editDraft[field.key as keyof Scenario] || '')} onChange={(e) => setEditDraft((prev) => ({ ...prev, [field.key]: e.target.value }))} rows={field.rows} />
              ) : (
                <p className="rt-detail-value" style={{ whiteSpace: 'pre-wrap' }}>{String(activeScenario[field.key as keyof Scenario] || '') || <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>No definido</span>}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="rt-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="rt-modal rt-modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="rt-modal-header">
              <div className="rt-modal-title">Nuevo escenario</div>
              <button className="rt-modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="rt-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="rt-label">Título *</label>
                  <input className="rt-input" value={draft.title} onChange={e => setDraft(p => ({ ...p, title: e.target.value }))} placeholder="Título del escenario" style={{ width: '100%', marginTop: 5 }} />
                </div>
                <div>
                  <label className="rt-label">Tipo</label>
                  <select className="rt-select" value={draft.type} onChange={e => setDraft(p => ({ ...p, type: e.target.value }))} style={{ width: '100%', marginTop: 5 }}>
                    {TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="rt-label">Orden</label>
                  <input className="rt-input mono" value={draft.order} onChange={e => setDraft(p => ({ ...p, order: e.target.value }))} placeholder="Ej. 1, 1.2" style={{ width: '100%', marginTop: 5 }} />
                </div>
              </div>
              {SCENARIO_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="rt-label">{f.label}</label>
                  {f.rows === 1
                    ? <input className="rt-input" value={(draft as Record<string, string>)[f.key] || ''} onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))} style={{ width: '100%', marginTop: 5 }} />
                    : <textarea className="rt-textarea" value={(draft as Record<string, string>)[f.key] || ''} onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))} rows={f.rows} style={{ width: '100%', marginTop: 5 }} />
                  }
                </div>
              ))}
            </div>
            <div className="rt-modal-footer">
              <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={handleCreate} disabled={!draft.title.trim()}>Crear escenario</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDelete && (
        <div className="rt-modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="rt-modal" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
            <div className="rt-modal-header">
              <div className="rt-modal-title">Eliminar escenario</div>
              <button className="rt-modal-close" onClick={() => setShowDelete(false)}>✕</button>
            </div>
            <div className="rt-modal-body">
              <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>¿Eliminar <strong>{selected.title}</strong>? Esta acción no se puede deshacer.</p>
            </div>
            <div className="rt-modal-footer">
              <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setShowDelete(false)}>Cancelar</button>
              <button className="rt-btn rt-btn-danger rt-btn-sm" onClick={handleDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
