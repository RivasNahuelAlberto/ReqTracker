import { useEffect, useState } from 'react'
import { createInspection, deleteInspection, fetchProject, updateInspection } from '../../api'
import { STATUS_BADGE, STATUS_LABEL } from '../../data/mockData'

type Inspection = {
  _id?: string
  id?: string
  aspect: string
  description: string
  targetType: string
  targetId: string
  targetLabel: string
  createdAt?: string
  status?: string
  updatedBy?: string
  updatedAt?: string
}

const ASPECTS = ['Ambigüedad', 'Completitud', 'Consistencia', 'Trazabilidad', 'Factibilidad', 'Redundancia', 'Otro']

const EMPTY_DRAFT = { aspect: 'Ambigüedad', description: '', targetKey: '', targetType: '', targetId: '', targetLabel: '' }

const TARGET_TAB: Record<string, string> = { symbol: 'symbols', scenario: 'scenarios', requirement: 'requirements' }

export default function InspectionTab({ projectId, onNavigate }: { projectId: string; onNavigate?: (tab: string, itemId: string) => void }) {
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [targetOptions, setTargetOptions] = useState<Array<{ value: string; label: string; targetType: string; targetId: string; targetLabel: string }>>([])
  const [selected, setSelected] = useState<Inspection | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showResolve, setShowResolve] = useState(false)
  const [aspectFilter, setAspectFilter] = useState('Todos')
  const [sortDate, setSortDate] = useState<'newest' | 'oldest'>('newest')
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const loadInspections = async () => {
    setIsLoading(true)
    setError('')
    try {
      const data = await fetchProject(projectId)
      const normalized = Array.isArray(data?.inspections) ? data.inspections : []
      const symbols = Array.isArray(data?.symbols) ? data.symbols : []
      const scenarios = Array.isArray(data?.scenarios) ? data.scenarios : []
      const requirements = Array.isArray(data?.requirements) ? data.requirements : []
      const options = [
        ...symbols.map((item: any) => ({ value: `symbol:${item._id || item.id}`, label: `${item.name} (Símbolo)`, targetType: 'symbol', targetId: item._id || item.id, targetLabel: item.name })),
        ...scenarios.map((item: any) => ({ value: `scenario:${item._id || item.id}`, label: `${item.title} (Escenario)`, targetType: 'scenario', targetId: item._id || item.id, targetLabel: item.title })),
        ...requirements.map((item: any) => ({ value: `req:${item._id || item.id}`, label: `${item.identifier} — ${item.name} (Requisito)`, targetType: 'requirement', targetId: item._id || item.id, targetLabel: item.identifier })),
      ]
      setInspections(normalized)
      setTargetOptions(options)
    } catch {
      setError('No se pudieron cargar las inspecciones del proyecto.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!projectId || !mounted) return
      await loadInspections()
    }
    run()
    return () => {
      mounted = false
    }
  }, [projectId])

  const aspectFiltered = inspections.filter((item) => aspectFilter === 'Todos' || item.aspect === aspectFilter)
  const sorted = [...aspectFiltered].sort((a, b) => {
    const cmp = (a.createdAt || '').localeCompare(b.createdAt || '')
    return sortDate === 'newest' ? -cmp : cmp
  })
  const open = sorted.filter((item) => (item.status ?? 'open') === 'open')
  const resolved = sorted.filter((item) => (item.status ?? 'open') !== 'open')

  const resolveTarget = (key: string) => targetOptions.find((option) => option.value === key)

  const handleCreate = async () => {
    const target = resolveTarget(draft.targetKey)
    if (!draft.description.trim() || !target) return
    setIsSaving(true)
    try {
      const created = await createInspection(projectId, {
        aspect: draft.aspect,
        description: draft.description.trim(),
        targetLabel: target.targetLabel,
        targetType: target.targetType,
        targetId: target.targetId,
      })
      await loadInspections()
      setSelected(created)
      setDraft({ ...EMPTY_DRAFT })
      setShowCreate(false)
    } catch {
      setError('No se pudo crear el reporte de inspección.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!selected || !selected._id || !draft.description.trim()) return
    const target = resolveTarget(draft.targetKey) || { targetType: selected.targetType, targetId: selected.targetId, targetLabel: selected.targetLabel }
    setIsSaving(true)
    try {
      const updated = await updateInspection(projectId, selected._id, {
        aspect: draft.aspect,
        description: draft.description.trim(),
        targetType: target.targetType,
        targetId: target.targetId,
        targetLabel: target.targetLabel,
      })
      await loadInspections()
      setSelected(updated)
      setShowEdit(false)
    } catch {
      setError('No se pudo actualizar el reporte.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleResolve = async () => {
    if (!selected || !selected._id) return
    setIsSaving(true)
    try {
      await deleteInspection(projectId, selected._id)
      await loadInspections()
      setSelected(null)
      setShowResolve(false)
    } catch {
      setError('No se pudo resolver la inspección.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteInspection(projectId, id)
      await loadInspections()
      if (selected?._id === id) setSelected(null)
    } catch {
      setError('No se pudo eliminar la inspección.')
    }
  }

  const openEdit = (ins: Inspection) => {
    const key = targetOptions.find((option) => option.targetType === ins.targetType && option.targetId === ins.targetId)?.value || ''
    setDraft({ aspect: ins.aspect, description: ins.description, targetKey: key, targetType: ins.targetType, targetId: ins.targetId, targetLabel: ins.targetLabel })
    setShowEdit(true)
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
          Inspección
          {open.length > 0 && <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 11 }}>{open.length} abiertos</span>}
        </h2>

        {/* Date sort */}
        <button
          className="rt-btn rt-btn-ghost rt-btn-sm"
          onClick={() => setSortDate(s => s === 'newest' ? 'oldest' : 'newest')}
          style={{ border: 'none', color: 'var(--text-muted)' }}
        >
          {sortDate === 'newest' ? '↓ Más reciente' : '↑ Más antigua'}
        </button>

        <div style={{ display: 'flex', gap: 4 }}>
          {['Todos', ...ASPECTS.slice(0, 4)].map(a => (
            <button key={a} onClick={() => setAspectFilter(a)} className="rt-btn rt-btn-ghost rt-btn-sm" style={{
              background: aspectFilter === a ? 'var(--accent-soft)' : 'transparent',
              color: aspectFilter === a ? 'var(--accent)' : 'var(--text-muted)', border: 'none',
            }}>{a}</button>
          ))}
        </div>
        <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={() => { setDraft({ ...EMPTY_DRAFT }); setShowCreate(true) }}>+ Nuevo reporte</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isLoading ? (
            <div className="rt-card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Cargando inspecciones...</div>
            </div>
          ) : error ? (
            <div className="rt-card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>
            </div>
          ) : (
            <>
              {open.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>Abiertos ({open.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {open.map((ins) => (
                      <InspectionCard key={ins._id || ins.id} ins={ins} isSelected={selected?._id === ins._id || selected?.id === ins.id} onClick={() => setSelected(selected?._id === ins._id || selected?.id === ins.id ? null : ins)} />
                    ))}
                  </div>
                </div>
              )}
              {resolved.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>Resueltos ({resolved.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {resolved.map((ins) => (
                      <InspectionCard key={ins._id || ins.id} ins={ins} isSelected={selected?._id === ins._id || selected?.id === ins.id} onClick={() => setSelected(selected?._id === ins._id || selected?.id === ins.id ? null : ins)} />
                    ))}
                  </div>
                </div>
              )}
              {sorted.length === 0 && (
                <div className="rt-card" style={{ padding: 32, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Sin reportes de inspección{aspectFilter !== 'Todos' ? ` de tipo "${aspectFilter}"` : ''}.</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail */}
        {selected && (
          <div className="rt-card" style={{ padding: 20, position: 'sticky', top: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--accent)' }}>Detalle</span>
              <button onClick={() => setSelected(null)} className="rt-btn rt-btn-ghost rt-btn-sm" style={{ padding: '2px 7px' }}>×</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span className="badge badge-amber">{selected.aspect}</span>
              <span className={`badge ${STATUS_BADGE[selected.status ?? 'open']}`}>{STATUS_LABEL[selected.status ?? 'open']}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div className="rt-detail-label">DESCRIPCIÓN</div>
                <p className="rt-detail-value" style={{ marginTop: 4, lineHeight: 1.6 }}>{selected.description}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div className="rt-detail-label">ELEMENTO</div>
                  <div style={{ marginTop: 4 }}>
                    {onNavigate && TARGET_TAB[selected.targetType] ? (
                      <button onClick={() => onNavigate(TARGET_TAB[selected.targetType], selected.targetId)} style={{
                        background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 4,
                        padding: '3px 9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--accent)',
                      }}>↗ {selected.targetLabel}</button>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text)' }}>{selected.targetLabel}</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="rt-detail-label">TIPO</div>
                  <div style={{ marginTop: 4 }}><span className="badge badge-muted" style={{ fontSize: 10 }}>{selected.targetType}</span></div>
                </div>
                <div>
                  <div className="rt-detail-label">FECHA</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-faint)' }}>{selected.createdAt}</div>
                </div>
                {selected.updatedBy && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div className="rt-detail-label">ÚLTIMA MODIFICACIÓN</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                      {selected.updatedBy} · {selected.updatedAt}
                    </div>
                  </div>
                )}
              </div>
              {(!selected.status || selected.status === 'open') && (
                <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                  <button className="rt-btn rt-btn-ghost rt-btn-sm" style={{ flex: 1 }} onClick={() => openEdit(selected)}>Editar</button>
                  <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={() => setShowResolve(true)} disabled={isSaving}>Resolver</button>
                  <button className="rt-btn rt-btn-danger rt-btn-sm" onClick={() => selected._id && handleDelete(selected._id)}>✕</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <InspectionFormModal title="Nuevo reporte de inspección" draft={draft} setDraft={setDraft} onConfirm={handleCreate} onCancel={() => setShowCreate(false)} confirmLabel="Crear reporte" targetOptions={targetOptions} isSaving={isSaving} />
      )}

      {/* Edit modal */}
      {showEdit && selected && (
        <InspectionFormModal title="Editar reporte" draft={draft} setDraft={setDraft} onConfirm={handleEdit} onCancel={() => setShowEdit(false)} confirmLabel="Guardar cambios" targetOptions={targetOptions} isSaving={isSaving} />
      )}

      {/* Resolve confirm */}
      {showResolve && selected && (
        <div className="rt-modal-overlay" onClick={() => setShowResolve(false)}>
          <div className="rt-modal" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
            <div className="rt-modal-header">
              <div className="rt-modal-title">Resolver inspección</div>
              <button className="rt-modal-close" onClick={() => setShowResolve(false)}>✕</button>
            </div>
            <div className="rt-modal-body">
              <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
                ¿Marcar como resuelta la inspección de aspecto <strong>{selected.aspect}</strong> sobre <strong>{selected.targetLabel}</strong>?
              </p>
            </div>
            <div className="rt-modal-footer">
              <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setShowResolve(false)}>Cancelar</button>
              <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={handleResolve}>Marcar resuelta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InspectionCard({ ins, isSelected, onClick }: { ins: Inspection; isSelected: boolean; onClick: () => void }) {
  const status = ins.status ?? 'open'
  return (
    <div onClick={onClick} className="rt-card" style={{
      padding: '12px 16px', cursor: 'pointer',
      borderLeft: `3px solid ${status === 'open' ? 'var(--danger)' : 'var(--success)'}`,
      background: isSelected ? 'var(--accent-soft)' : 'var(--surface)',
      outline: isSelected ? '1.5px solid var(--accent)' : 'none',
      transition: 'all 0.12s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span className="badge badge-amber" style={{ fontSize: 10 }}>{ins.aspect}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>{ins.targetLabel}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{ins.createdAt}</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5, margin: 0 }}>{ins.description}</p>
      {ins.updatedBy && (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>por {ins.updatedBy}</div>
      )}
    </div>
  )
}

function InspectionFormModal({ title, draft, setDraft, onConfirm, onCancel, confirmLabel, targetOptions, isSaving }: {
  title: string
  draft: typeof EMPTY_DRAFT
  setDraft: (d: typeof EMPTY_DRAFT) => void
  onConfirm: () => void
  onCancel: () => void
  confirmLabel: string
  targetOptions: Array<{ value: string; label: string; targetType: string; targetId: string; targetLabel: string }>
  isSaving?: boolean
}) {
  return (
    <div className="rt-modal-overlay" onClick={onCancel}>
      <div className="rt-modal" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
        <div className="rt-modal-header">
          <div className="rt-modal-title">{title}</div>
          <button className="rt-btn rt-modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="rt-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="rt-label">Aspecto *</label>
            <select className="rt-select" value={draft.aspect} onChange={e => setDraft({ ...draft, aspect: e.target.value })} style={{ width: '100%', marginTop: 5 }}>
              {ASPECTS.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="rt-label">Descripción del problema *</label>
            <textarea className="rt-textarea" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} rows={4} placeholder="Describí el problema de calidad encontrado..." style={{ width: '100%', marginTop: 5 }} autoFocus />
          </div>
          <div>
            <label className="rt-label">Elemento inspeccionado *</label>
            <select className="rt-select" value={draft.targetKey} onChange={e => setDraft({ ...draft, targetKey: e.target.value })} style={{ width: '100%', marginTop: 5 }}>
              <option value="">Seleccioná un elemento...</option>
              {targetOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="rt-modal-footer">
          <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onCancel}>Cancelar</button>
          <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={onConfirm} disabled={!draft.description.trim() || !draft.targetKey || isSaving}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
