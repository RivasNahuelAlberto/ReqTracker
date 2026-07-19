import { useState, useEffect } from 'react'
import { createSymbol, deleteSymbol, fetchSymbols, importSymbols, updateSymbol } from '../../api'
import { STATUS_BADGE, STATUS_LABEL } from '../../data/mockData'

type Symbol = {
  _id?: string
  id?: string
  name: string
  type: string
  status?: string
  isSeed?: boolean
  parentSymbol?: string
  reviewNotes?: string
  notion?: string
  impact?: string
  order?: string
}

const TYPES = ['Sujeto', 'Objeto', 'Verbo', 'Estado']
const STATUSES = ['complete', 'review', 'incomplete']

const EMPTY: Omit<Symbol, '_id' | 'order'> = {
  name: '', type: 'Sujeto', status: 'incomplete', isSeed: false,
  parentSymbol: '', reviewNotes: '', notion: '', impact: '',
}

const TYPE_COLOR: Record<string, string> = {
  Sujeto: '#3B82F6', Objeto: '#8B5CF6', Verbo: '#10B981', Estado: '#F59E0B',
}

const JSON_FORMAT_EXAMPLE = `[
  {
    "name": "Período Académico",
    "type": "Objeto",
    "notion": "Lapso de tiempo con fechas de inicio y fin en el que se desarrollan las actividades de cursado.",
    "impact": "Define las ventanas de inscripción.\\nHabilita la carga de calificaciones.",
    "parentSymbol": "",
    "reviewNotes": ""
  },
  {
    "name": "Habilitación",
    "type": "Estado",
    "notion": "Condición que determina si un alumno puede inscribirse a una materia.",
    "impact": "Bloquea o permite la inscripción.",
    "parentSymbol": "Alumno",
    "reviewNotes": "Revisar criterios de habilitación."
  }
]`

export default function SymbolsTab({
  projectId,
  initialId,
}: {
  projectId: string
  initialId?: string
}) {
  const [symbols, setSymbols] = useState<Symbol[]>([])
  const [selected, setSelected] = useState<Symbol | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('Todos')
  const [editMode, setEditMode] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importError, setImportError] = useState('')
  const [importPreview, setImportPreview] = useState<Omit<Symbol, '_id' | 'order'>[]>([])
  const [showFormatSpec, setShowFormatSpec] = useState(false)
  const [draft, setDraft] = useState({ ...EMPTY })
  const [editDraft, setEditDraft] = useState<Symbol>({ ...EMPTY, _id: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const activeSymbol = selected ?? (symbols[0] ? symbols[0] : { ...EMPTY, _id: '' })

  const loadSymbols = async () => {
    setIsLoading(true)
    setError('')
    try {
      const data = await fetchSymbols(projectId)
      const normalized = Array.isArray(data) ? data : []
      setSymbols(normalized)
      const initialSelection = normalized.find((item) => item._id === initialId || item.id === initialId) || normalized[0] || null
      setSelected(initialSelection)
      setEditDraft(initialSelection ? { ...initialSelection } : { ...EMPTY, _id: '' })
    } catch {
      setError('No se pudieron cargar los símbolos del proyecto.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!projectId) return
      if (!mounted) return
      await loadSymbols()
    }
    run()
    return () => {
      mounted = false
    }
  }, [projectId])

  useEffect(() => {
    if (!initialId || symbols.length === 0) return
    const found = symbols.find((item) => item._id === initialId || item.id === initialId)
    if (found) {
      setSelected(found)
      setEditDraft({ ...found })
      setEditMode(false)
    }
  }, [initialId, symbols])

  const filtered = symbols.filter((item) => {
    const q = search.toLowerCase()
    const matchQ = !q || item.name.toLowerCase().includes(q) || item.type.toLowerCase().includes(q)
    const matchT = typeFilter === 'Todos' || item.type === typeFilter
    return matchQ && matchT
  })

  const getAncestors = (sym: Symbol): Symbol[] => {
    if (!sym.parentSymbol) return []
    const parent = symbols.find((item) => item._id === sym.parentSymbol || item.id === sym.parentSymbol)
    if (!parent) return []
    return [...getAncestors(parent), parent]
  }

  const getChildren = (sym: Symbol): Symbol[] =>
    symbols.filter((item) => (item.parentSymbol || '') === (sym._id || sym.id || ''))

  const handleSelect = (sym: Symbol) => {
    setSelected(sym)
    setEditDraft({ ...sym })
    setEditMode(false)
  }

  const handleSaveEdit = async () => {
    if (!selected || !selected._id) return
    setIsSaving(true)
    try {
      const updated = {
        ...editDraft,
        name: editDraft.name.trim(),
        type: editDraft.type,
        status: editDraft.status || 'incomplete',
        order: editDraft.order || '',
        notion: editDraft.notion || '',
        impact: editDraft.impact || '',
        reviewNotes: editDraft.reviewNotes || '',
        parentSymbol: editDraft.parentSymbol || '',
        isSeed: !editDraft.parentSymbol,
      }
      const saved = await updateSymbol(projectId, selected._id, updated)
      setSymbols((prev) => prev.map((item) => (item._id === selected._id || item.id === selected._id ? { ...item, ...saved } : item)))
      setSelected((prev) => prev ? { ...prev, ...saved } : prev)
      setEditMode(false)
    } catch {
      setError('No se pudo actualizar el símbolo.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreate = async () => {
    if (!draft.name.trim()) return
    setIsSaving(true)
    try {
      const created = await createSymbol(projectId, {
        name: draft.name.trim(),
        type: draft.type,
        parentSymbol: draft.parentSymbol || '',
        isSeed: !draft.parentSymbol,
        order: draft.order || '',
      })
      const extra = await updateSymbol(projectId, created._id, {
        notion: draft.notion || '',
        impact: draft.impact || '',
        reviewNotes: draft.reviewNotes || '',
        status: draft.status || 'incomplete',
      })
      await loadSymbols()
      setSelected((prev) => prev ? { ...prev, ...extra } : null)
      setDraft({ ...EMPTY })
      setShowCreate(false)
      setEditMode(false)
    } catch {
      setError('No se pudo crear el símbolo.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selected || !selected._id) return
    setIsSaving(true)
    try {
      await deleteSymbol(projectId, selected._id)
      await loadSymbols()
      setShowDelete(false)
    } catch {
      setError('No se pudo eliminar el símbolo.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleParseImport = () => {
    setImportError('')
    setImportPreview([])
    try {
      const parsed = JSON.parse(importJson)
      if (!Array.isArray(parsed)) { setImportError('El JSON debe ser un array de símbolos.'); return }
      const preview = parsed.map((item: any, i: number) => {
        if (!item.name || typeof item.name !== 'string') throw new Error(`Elemento ${i + 1}: falta el campo "name".`)
        if (!['Sujeto', 'Objeto', 'Verbo', 'Estado'].includes(item.type)) throw new Error(`Elemento ${i + 1}: "type" debe ser Sujeto, Objeto, Verbo o Estado.`)
        return {
          name: item.name.trim(),
          type: item.type as string,
          notion: item.notion ?? '',
          impact: item.impact ?? '',
          parentSymbol: item.parentSymbol ? (symbols.find((sym) => sym.name === item.parentSymbol)?._id ?? '') : '',
          reviewNotes: item.reviewNotes ?? '',
          status: 'incomplete' as const,
          isSeed: !item.parentSymbol,
        }
      })
      setImportPreview(preview)
    } catch (e: any) {
      setImportError(e.message || 'JSON inválido. Verificá el formato.')
    }
  }

  const handleConfirmImport = async () => {
    if (!importPreview.length) return
    setIsSaving(true)
    try {
      await importSymbols(projectId, importPreview.map((item) => ({
        name: item.name,
        type: item.type,
        notion: item.notion || '',
        impact: item.impact || '',
      })))
      await loadSymbols()
      setShowImport(false)
      setImportJson('')
      setImportPreview([])
      setImportError('')
    } catch {
      setError('No se pudo importar el archivo JSON.')
    } finally {
      setIsSaving(false)
    }
  }

  const parentName = (id?: string) => symbols.find((item) => item._id === id || item.id === id)?.name ?? ''

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: 0, height: 'calc(100vh - 140px)', overflow: 'hidden' }}>
      {/* List */}
      <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input className="rt-input" placeholder="Buscar símbolo..." value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 12 }} />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['Todos', ...TYPES].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} className="rt-btn rt-btn-ghost rt-btn-sm" style={{
                padding: '2px 7px', fontSize: 11, border: 'none',
                background: typeFilter === t ? 'var(--accent-soft)' : 'transparent',
                color: typeFilter === t ? 'var(--accent)' : 'var(--text-muted)',
              }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {isLoading ? (
            <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '16px 8px' }}>Cargando símbolos...</div>
          ) : error ? (
            <div style={{ fontSize: 12, color: 'var(--danger)', padding: '16px 8px' }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '16px 8px' }}>No hay símbolos para mostrar.</div>
          ) : filtered.map((sym) => (
            <button key={sym._id || sym.id} onClick={() => handleSelect(sym)} style={{
              width: '100%', textAlign: 'left', padding: '8px 10px',
              background: activeSymbol._id === (sym._id || sym.id) ? 'var(--accent-soft)' : 'transparent',
              border: 'none', borderRadius: 5, cursor: 'pointer', marginBottom: 2,
              display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.1s',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLOR[sym.type] ?? 'var(--text-faint)', flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', width: 22, flexShrink: 0 }}>{sym.order || ''}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: activeSymbol._id === (sym._id || sym.id) ? 'var(--accent)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sym.name}
                  {sym.isSeed && <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--accent)', opacity: 0.8 }}>●</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  {sym.type}{sym.parentSymbol ? ` · ← ${parentName(sym.parentSymbol)}` : ''}
                </div>
              </div>
              <span className={`badge ${STATUS_BADGE[sym.status || 'incomplete']}`} style={{ fontSize: 10, flexShrink: 0 }}>{STATUS_LABEL[sym.status || 'incomplete']}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
          <button className="rt-btn rt-btn-primary rt-btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setDraft({ ...EMPTY }); setShowCreate(true) }}>
            + Nuevo símbolo
          </button>
          <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => { setShowImport(true); setImportJson(''); setImportPreview([]); setImportError('') }} title="Importar símbolos desde JSON">
            ⬆ JSON
          </button>
        </div>
      </div>

      {/* Detail */}
      <div style={{ overflow: 'auto', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {editMode
                ? <input className="rt-input" value={editDraft.name} onChange={(e) => setEditDraft((prev) => ({ ...prev, name: e.target.value }))} style={{ fontSize: 18, fontWeight: 700, width: 240 }} />
                : <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text)' }}>{activeSymbol.name || 'Sin selección'}</h2>
              }
              {!editMode && activeSymbol._id && <>
                <span className="badge badge-muted" style={{ fontSize: 11 }}>{activeSymbol.type}</span>
                <span className={`badge ${STATUS_BADGE[activeSymbol.status || 'incomplete']}`} style={{ fontSize: 11 }}>{STATUS_LABEL[activeSymbol.status || 'incomplete']}</span>
                {activeSymbol.isSeed
                  ? <span className="badge badge-blue" style={{ fontSize: 10 }}>SEMILLA</span>
                  : <span className="badge badge-muted" style={{ fontSize: 10 }}>DERIVADO</span>
                }
              </>}
            </div>
            {activeSymbol._id && (
              <div className="mono" style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
                SYM-{activeSymbol.order || ''} · {activeSymbol._id.toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {editMode ? (
              <>
                <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setEditMode(false)}>Cancelar</button>
                <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={handleSaveEdit} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar'}</button>
              </>
            ) : (
              <>
                <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => { setEditDraft({ ...activeSymbol }); setEditMode(true) }} disabled={!activeSymbol._id}>Editar</button>
                <button className="rt-btn rt-btn-danger rt-btn-sm" onClick={() => setShowDelete(true)} disabled={!activeSymbol._id}>Eliminar</button>
              </>
            )}
          </div>
        </div>

        {editMode && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
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
            <div>
              <label className="rt-label">SÍMBOLO PADRE</label>
              <select className="rt-select" value={editDraft.parentSymbol || ''} onChange={(e) => setEditDraft((prev) => ({ ...prev, parentSymbol: e.target.value }))} style={{ marginTop: 4 }}>
                <option value="">— Ninguno (Semilla) —</option>
                {symbols.filter((item) => (item._id || item.id) !== (editDraft._id || editDraft.id)).map((item) => (
                  <option key={item._id || item.id} value={item._id || item.id}>{item.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div style={{ maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {!editMode && (() => {
            const ancestors = getAncestors(activeSymbol)
            const children = getChildren(activeSymbol)
            if (ancestors.length === 0 && children.length === 0 || !activeSymbol._id) return null
            return (
              <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ancestors.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase' }}>JERARQUÍA</span>
                    {ancestors.map((ancestor, index) => (
                      <span key={ancestor._id || ancestor.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {index > 0 && <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>›</span>}
                        <button onClick={() => handleSelect(ancestor)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--text-muted)' }}>{ancestor.name}</button>
                      </span>
                    ))}
                    <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>›</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', padding: '2px 8px' }}>{activeSymbol.name}</span>
                  </div>
                )}
                {children.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase' }}>DERIVADOS</span>
                    {children.map((child) => (
                      <button key={child._id || child.id} onClick={() => handleSelect(child)} style={{
                        background: `${TYPE_COLOR[child.type]}18`, border: `1px solid ${TYPE_COLOR[child.type]}55`,
                        borderRadius: 4, padding: '2px 9px', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', color: TYPE_COLOR[child.type] ?? 'var(--text)',
                      }}>{child.name}</button>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {!editMode && activeSymbol._id && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
              {[
                { label: 'TIPO', value: activeSymbol.type },
                { label: 'ESTADO', value: STATUS_LABEL[activeSymbol.status || 'incomplete'] },
                { label: 'ORDEN', value: `SYM-${activeSymbol.order || ''}` },
                { label: 'DERIVACIÓN', value: activeSymbol.parentSymbol ? parentName(activeSymbol.parentSymbol) : '— Semilla —' },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 500 }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="rt-detail-field">
            <span className="rt-detail-label">NOCIÓN</span>
            {editMode
              ? <textarea className="rt-textarea" value={editDraft.notion || ''} onChange={(e) => setEditDraft((prev) => ({ ...prev, notion: e.target.value }))} rows={4} />
              : <p className="rt-detail-value">{activeSymbol.notion || 'Sin noción.'}</p>
            }
          </div>

          <div className="rt-detail-field">
            <span className="rt-detail-label">IMPACTO</span>
            {editMode
              ? <textarea className="rt-textarea" value={editDraft.impact || ''} onChange={(e) => setEditDraft((prev) => ({ ...prev, impact: e.target.value }))} rows={5} />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(activeSymbol.impact || '').split('\n').filter(Boolean).map((line, index) => (
                    <div key={`${line}-${index}`} style={{ padding: '7px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                      {line}
                    </div>
                  ))}
                </div>
              )
            }
          </div>

          <div className="rt-detail-field">
            <span className="rt-detail-label">NOTAS DE REVISIÓN</span>
            {editMode
              ? <textarea className="rt-textarea" value={editDraft.reviewNotes || ''} onChange={(e) => setEditDraft((prev) => ({ ...prev, reviewNotes: e.target.value }))} rows={3} placeholder="Observaciones del proceso de revisión..." />
              : (
                activeSymbol.reviewNotes
                  ? <p className="rt-detail-value" style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning)', borderRadius: 6, padding: '8px 12px' }}>{activeSymbol.reviewNotes}</p>
                  : <p className="rt-detail-value" style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>Sin notas de revisión.</p>
              )
            }
          </div>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="rt-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="rt-modal" style={{ width: 560 }} onClick={e => e.stopPropagation()}>
            <div className="rt-modal-header">
              <div className="rt-modal-title">Nuevo símbolo</div>
              <button className="rt-modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="rt-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="rt-label">Nombre *</label>
                  <input autoFocus className="rt-input" value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))} placeholder="Ej. Período Académico" style={{ width: '100%', marginTop: 5 }} />
                </div>
                <div>
                  <label className="rt-label">Tipo</label>
                  <select className="rt-select" value={draft.type} onChange={e => setDraft(p => ({ ...p, type: e.target.value }))} style={{ width: '100%', marginTop: 5 }}>
                    {TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="rt-label">Símbolo padre (derivación)</label>
                  <select className="rt-select" value={draft.parentSymbol} onChange={e => setDraft(p => ({ ...p, parentSymbol: e.target.value }))} style={{ width: '100%', marginTop: 5 }}>
                    <option value="">— Ninguno (Semilla) —</option>
                    {symbols.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="rt-label">Noción</label>
                <textarea className="rt-textarea" value={draft.notion} onChange={e => setDraft(p => ({ ...p, notion: e.target.value }))} rows={3} placeholder="Definición del símbolo en el contexto del sistema..." style={{ width: '100%', marginTop: 5 }} />
              </div>
              <div>
                <label className="rt-label">Impacto</label>
                <textarea className="rt-textarea" value={draft.impact} onChange={e => setDraft(p => ({ ...p, impact: e.target.value }))} rows={4} placeholder="Efectos y acciones asociadas (una por línea)..." style={{ width: '100%', marginTop: 5 }} />
              </div>
              <div>
                <label className="rt-label">Notas de revisión</label>
                <textarea className="rt-textarea" value={draft.reviewNotes} onChange={e => setDraft(p => ({ ...p, reviewNotes: e.target.value }))} rows={2} placeholder="Observaciones del proceso de revisión..." style={{ width: '100%', marginTop: 5 }} />
              </div>
            </div>
            <div className="rt-modal-footer">
              <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={handleCreate} disabled={!draft.name.trim()}>Crear símbolo</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDelete && (
        <div className="rt-modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="rt-modal" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
            <div className="rt-modal-header">
              <div className="rt-modal-title">Eliminar símbolo</div>
              <button className="rt-modal-close" onClick={() => setShowDelete(false)}>✕</button>
            </div>
            <div className="rt-modal-body">
              <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
                ¿Eliminar <strong>{selected.name}</strong>? Los símbolos derivados de este quedarán sin padre asignado.
              </p>
            </div>
            <div className="rt-modal-footer">
              <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setShowDelete(false)}>Cancelar</button>
              <button className="rt-btn rt-btn-danger rt-btn-sm" onClick={handleDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Import JSON modal */}
      {showImport && (
        <div className="rt-modal-overlay" onClick={() => setShowImport(false)}>
          <div className="rt-modal rt-modal-lg" style={{ width: 680 }} onClick={e => e.stopPropagation()}>
            <div className="rt-modal-header">
              <div className="rt-modal-title">Importar símbolos JSON</div>
              <button className="rt-modal-close" onClick={() => setShowImport(false)}>✕</button>
            </div>
            <div className="rt-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Format spec toggle */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <button onClick={() => setShowFormatSpec(v => !v)} style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px', background: 'var(--surface-2)',
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: 12.5, fontWeight: 600, color: 'var(--text)', fontFamily: 'inherit',
                }}>
                  <span>📋 Ver formato JSON esperado</span>
                  <span style={{ color: 'var(--text-faint)', fontSize: 14 }}>{showFormatSpec ? '▲' : '▼'}</span>
                </button>
                {showFormatSpec && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: 14, background: 'var(--bg)' }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
                      El archivo debe ser un <strong>array JSON</strong> con uno o más objetos. Campos soportados:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 11.5, marginBottom: 12 }}>
                      {[
                        { field: 'name', req: true, desc: 'Nombre del símbolo' },
                        { field: 'type', req: true, desc: 'Sujeto | Objeto | Verbo | Estado' },
                        { field: 'notion', req: false, desc: 'Definición contextual' },
                        { field: 'impact', req: false, desc: 'Efectos (saltos de línea con \\n)' },
                        { field: 'parentSymbol', req: false, desc: 'Nombre del símbolo padre (vacío=semilla)' },
                        { field: 'reviewNotes', req: false, desc: 'Notas de revisión opcionales' },
                      ].map(f => (
                        <div key={f.field} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                          <span className="mono" style={{ fontWeight: 700, color: f.req ? 'var(--accent)' : 'var(--text)', fontSize: 11, flexShrink: 0 }}>{f.field}{f.req ? ' *' : ''}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{f.desc}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginBottom: 6, fontWeight: 600 }}>EJEMPLO:</div>
                    <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: 12, color: 'var(--text-muted)', overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>
                      {JSON_FORMAT_EXAMPLE}
                    </pre>
                  </div>
                )}
              </div>

              {/* JSON input */}
              <div>
                <label className="rt-label" style={{ marginBottom: 6 }}>Pegá el JSON aquí</label>
                <textarea
                  autoFocus
                  className="rt-textarea"
                  value={importJson}
                  onChange={e => { setImportJson(e.target.value); setImportPreview([]); setImportError('') }}
                  rows={8}
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, width: '100%', marginTop: 5 }}
                  placeholder={'[\n  {\n    "name": "Período Académico",\n    "type": "Objeto",\n    ...\n  }\n]'}
                />
              </div>

              {importError && (
                <div style={{ padding: '8px 12px', background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 5, fontSize: 12.5, color: 'var(--danger)' }}>
                  ✕ {importError}
                </div>
              )}

              {importPreview.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--success)', marginBottom: 8 }}>
                    ✓ {importPreview.length} símbolo{importPreview.length !== 1 ? 's' : ''} para importar
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                    {importPreview.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 4, alignItems: 'center' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: TYPE_COLOR[s.type] ?? '#888', flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{s.name}</span>
                        <span className="badge badge-muted" style={{ fontSize: 10 }}>{s.type}</span>
                        {s.parentSymbol && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>← {symbols.find(x => x._id === s.parentSymbol)?.name}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="rt-modal-footer">
              <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setShowImport(false)}>Cancelar</button>
              <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={handleParseImport} disabled={!importJson.trim()}>Previsualizar</button>
              <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={handleConfirmImport} disabled={!importPreview.length}>Importar {importPreview.length > 0 ? `(${importPreview.length})` : ''}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
