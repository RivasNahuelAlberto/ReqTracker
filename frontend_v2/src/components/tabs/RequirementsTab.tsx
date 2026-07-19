import { useState, useEffect } from 'react'
import { MOCK_REQUIREMENTS, STATUS_BADGE, STATUS_LABEL } from '../../data/mockData'

type Requirement = typeof MOCK_REQUIREMENTS[0]

const REQ_TYPES = ['Funcional', 'No Funcional', 'Seguridad', 'Rendimiento', 'Usabilidad', 'Otro']
const PRIORITIES = ['Alta', 'Media', 'Baja']
const SCALE_OPTS = ['Alta', 'Media', 'Baja']
const SCALE_OPTS_M = ['Alto', 'Medio', 'Bajo']

const EMPTY: Omit<Requirement, '_id'> = {
  identifier: '', name: '', type: 'Funcional', priority: 'Media', status: 'incomplete',
  description: '', basis: '', criticidad: 'Media', volatilidad: 'Media', factibilidad: 'Alta',
  riesgo: 'Bajo', costoImplementacion: 'Medio',
}

export default function RequirementsTab({ projectId: _projectId, initialId }: { projectId: string; initialId?: string }) {
  const [reqs, setReqs] = useState(MOCK_REQUIREMENTS.map(r => ({ ...r })))
  const [selected, setSelected] = useState<Requirement | null>(null)

  useEffect(() => {
    if (!initialId) return
    const found = reqs.find(r => r._id === initialId)
    if (found) setSelected(found)
  }, [initialId]) // eslint-disable-line react-hooks/exhaustive-deps
  const [typeFilter, setTypeFilter] = useState('Todos')
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [draft, setDraft] = useState<Omit<Requirement, '_id'>>({ ...EMPTY })

  const [searchQuery, setSearchQuery] = useState('')
  const types = ['Todos', ...Array.from(new Set(reqs.map(r => r.type)))]
  const typeFiltered = reqs.filter(r => typeFilter === 'Todos' || r.type === typeFilter)
  const filtered = searchQuery.trim()
    ? typeFiltered.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.identifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : typeFiltered

  const handleCreate = () => {
    if (!draft.name.trim()) return
    const newReq: Requirement = { ...draft, _id: `r-${Date.now()}`, name: draft.name.trim(), identifier: draft.identifier.trim() }
    setReqs(prev => [...prev, newReq])
    setSelected(newReq)
    setShowCreate(false)
  }

  const handleEdit = () => {
    if (!selected || !draft.name.trim()) return
    const updated = { ...draft, _id: selected._id }
    setReqs(prev => prev.map(r => r._id === selected._id ? updated : r))
    setSelected(updated)
    setShowEdit(false)
  }

  const handleDelete = () => {
    if (!selected) return
    setReqs(prev => prev.filter(r => r._id !== selected._id))
    setSelected(null)
    setShowDelete(false)
  }

  const openEdit = (req: Requirement) => {
    setDraft({ identifier: req.identifier, name: req.name, type: req.type, priority: req.priority, status: req.status, description: req.description, basis: req.basis, criticidad: req.criticidad, volatilidad: req.volatilidad, factibilidad: req.factibilidad, riesgo: req.riesgo, costoImplementacion: req.costoImplementacion })
    setShowEdit(true)
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Requisitos</h2>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {types.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} className="rt-btn rt-btn-ghost rt-btn-sm" style={{
              border: 'none', background: typeFilter === t ? 'var(--accent-soft)' : 'transparent',
              color: typeFilter === t ? 'var(--accent)' : 'var(--text-muted)',
            }}>{t}</button>
          ))}
        </div>
        <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={() => { setDraft({ ...EMPTY }); setShowCreate(true) }}>+ Agregar</button>
      </div>

      {/* Search bar */}
      <div className="rt-card" style={{ padding: '8px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>⌕</span>
        <input
          className="rt-input"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre, identificador o descripción..."
          style={{ flex: 1, border: 'none', background: 'transparent', padding: '2px 0', fontSize: 13 }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 14, padding: '0 4px' }}
          >
            ×
          </button>
        )}
        {searchQuery && (
          <span style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 16, alignItems: 'start' }}>
        <div className="rt-card" style={{ overflow: 'hidden' }}>
          <table className="rt-table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>ID</th>
                <th>NOMBRE</th>
                <th>TIPO</th>
                <th>PRIORIDAD</th>
                <th>ESTADO</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(req => (
                <tr key={req._id} className={selected?._id === req._id ? 'selected' : ''} onClick={() => setSelected(selected?._id === req._id ? null : req)} style={{ cursor: 'pointer' }}>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{req.identifier}</td>
                  <td style={{ fontWeight: 500 }}>{req.name}</td>
                  <td><span className="badge badge-muted" style={{ fontSize: 11 }}>{req.type}</span></td>
                  <td>
                    <span className={`badge ${req.priority === 'Alta' ? 'badge-red' : req.priority === 'Media' ? 'badge-amber' : 'badge-muted'}`} style={{ fontSize: 11 }}>
                      {req.priority}
                    </span>
                  </td>
                  <td><span className={`badge ${STATUS_BADGE[req.status]}`} style={{ fontSize: 11 }}>{STATUS_LABEL[req.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="rt-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{selected.identifier}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => openEdit(selected)}>Editar</button>
                <button className="rt-btn rt-btn-danger rt-btn-sm" onClick={() => setShowDelete(true)}>Eliminar</button>
                <button onClick={() => setSelected(null)} className="rt-btn rt-btn-ghost rt-btn-sm" style={{ padding: '4px 8px' }}>×</button>
              </div>
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12, lineHeight: 1.3 }}>{selected.name}</h3>
            <div className="rt-detail-field">
              <span className="rt-detail-label">DESCRIPCIÓN</span>
              <p className="rt-detail-value" style={{ marginTop: 4 }}>{selected.description}</p>
            </div>
            {selected.basis && (
              <div className="rt-detail-field">
                <span className="rt-detail-label">FUENTE / BASE</span>
                <p className="rt-detail-value" style={{ marginTop: 4 }}>{selected.basis}</p>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              {[
                { label: 'TIPO', value: selected.type },
                { label: 'PRIORIDAD', value: selected.priority },
                { label: 'CRITICIDAD', value: selected.criticidad },
                { label: 'VOLATILIDAD', value: selected.volatilidad },
                { label: 'FACTIBILIDAD', value: selected.factibilidad },
                { label: 'RIESGO', value: selected.riesgo },
                { label: 'COSTO', value: selected.costoImplementacion },
                { label: 'ESTADO', value: STATUS_LABEL[selected.status] },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 3 }}>{f.label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 500 }}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {(showCreate || showEdit) && (
        <div className="rt-modal-overlay" onClick={() => { setShowCreate(false); setShowEdit(false) }}>
          <div className="rt-modal rt-modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="rt-modal-header">
              <div className="rt-modal-title">{showCreate ? 'Nuevo requisito' : `Editar — ${selected?.identifier || 'Requisito'}`}</div>
              <button className="rt-modal-close" onClick={() => { setShowCreate(false); setShowEdit(false) }}>✕</button>
            </div>
            <div className="rt-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="rt-label">Identificador</label>
                  <input className="rt-input mono" value={draft.identifier} onChange={e => setDraft(p => ({ ...p, identifier: e.target.value }))} placeholder="RF-001" style={{ width: '100%', marginTop: 5 }} />
                </div>
                <div>
                  <label className="rt-label">Nombre *</label>
                  <input className="rt-input" value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))} placeholder="Nombre del requisito" style={{ width: '100%', marginTop: 5 }} />
                </div>
                <div>
                  <label className="rt-label">Tipo</label>
                  <select className="rt-select" value={draft.type} onChange={e => setDraft(p => ({ ...p, type: e.target.value }))} style={{ width: '100%', marginTop: 5 }}>
                    {REQ_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="rt-label">Prioridad</label>
                  <select className="rt-select" value={draft.priority} onChange={e => setDraft(p => ({ ...p, priority: e.target.value }))} style={{ width: '100%', marginTop: 5 }}>
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="rt-label">Descripción</label>
                <textarea className="rt-textarea" value={draft.description} onChange={e => setDraft(p => ({ ...p, description: e.target.value }))} rows={4} placeholder="Descripción detallada del requisito..." style={{ width: '100%', marginTop: 5 }} />
              </div>
              <div>
                <label className="rt-label">Fuente / Base</label>
                <input className="rt-input" value={draft.basis} onChange={e => setDraft(p => ({ ...p, basis: e.target.value }))} placeholder="Ej. Entrevista cliente, normativa..." style={{ width: '100%', marginTop: 5 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { key: 'criticidad', label: 'Criticidad', opts: SCALE_OPTS },
                  { key: 'volatilidad', label: 'Volatilidad', opts: SCALE_OPTS },
                  { key: 'factibilidad', label: 'Factibilidad', opts: SCALE_OPTS },
                  { key: 'riesgo', label: 'Riesgo', opts: SCALE_OPTS_M },
                  { key: 'costoImplementacion', label: 'Costo', opts: SCALE_OPTS_M },
                ].map(({ key, label, opts }) => (
                  <div key={key}>
                    <label className="rt-label">{label}</label>
                    <select className="rt-select" value={(draft as Record<string, string>)[key]} onChange={e => setDraft(p => ({ ...p, [key]: e.target.value }))} style={{ width: '100%', marginTop: 5 }}>
                      {opts.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="rt-modal-footer">
              <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => { setShowCreate(false); setShowEdit(false) }}>Cancelar</button>
              <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={showCreate ? handleCreate : handleEdit} disabled={!draft.name.trim()}>
                {showCreate ? 'Crear requisito' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDelete && selected && (
        <div className="rt-modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="rt-modal" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
            <div className="rt-modal-header">
              <div className="rt-modal-title">Eliminar requisito</div>
              <button className="rt-modal-close" onClick={() => setShowDelete(false)}>✕</button>
            </div>
            <div className="rt-modal-body">
              <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
                ¿Eliminar <strong>{selected.identifier} — {selected.name}</strong>? Esta acción no se puede deshacer.
              </p>
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
