import { useState } from 'react'
import { MOCK_TASKS, MOCK_SYMBOLS, MOCK_SCENARIOS, MOCK_REQUIREMENTS } from '../../data/mockData'

type TaskBase = typeof MOCK_TASKS[0]
type Task = TaskBase & { updatedBy?: string; updatedAt?: string }

const PRIORITY_COLOR: Record<number, string> = { 1: 'var(--danger)', 2: 'var(--warning)', 3: 'var(--text-faint)' }
const PRIORITY_BG: Record<number, string> = { 1: 'var(--danger-soft)', 2: 'var(--warning-soft)', 3: 'var(--surface-2)' }
const PRIORITY_LABEL: Record<number, string> = { 1: 'Alta', 2: 'Media', 3: 'Baja' }

const TARGET_OPTIONS = [
  ...MOCK_SYMBOLS.map(s => ({ value: `symbol:${s._id}`, label: `${s.name} (Símbolo)`, targetType: 'symbol', targetId: s._id, targetLabel: s.name })),
  ...MOCK_SCENARIOS.map(s => ({ value: `scenario:${s._id}`, label: `${s.title} (Escenario)`, targetType: 'scenario', targetId: s._id, targetLabel: s.title })),
  ...MOCK_REQUIREMENTS.map(r => ({ value: `req:${r._id}`, label: `${r.identifier} — ${r.name} (Requisito)`, targetType: 'requirement', targetId: r._id, targetLabel: r.identifier })),
]

const EMPTY_TASK = { description: '', priority: 2, targetKey: '', targetType: '', targetId: '', targetLabel: '' }

const TARGET_TAB: Record<string, string> = { symbol: 'symbols', scenario: 'scenarios', requirement: 'requirements' }

const now = () => new Date().toISOString().slice(0, 10)

export default function TasksTab({ projectId: _projectId, onNavigate, currentUser }: { projectId: string; onNavigate?: (tab: string, itemId: string) => void; currentUser?: string }) {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS.map(t => ({ ...t })))
  const [selected, setSelected] = useState<Task | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState(0)
  const [sortDate, setSortDate] = useState<'newest' | 'oldest'>('newest')
  const [draft, setDraft] = useState({ ...EMPTY_TASK })

  const priorityFiltered = tasks.filter(t => priorityFilter === 0 || t.priority === priorityFilter)
  const filtered = [...priorityFiltered].sort((a, b) => {
    const cmp = a.createdAt.localeCompare(b.createdAt)
    return sortDate === 'newest' ? -cmp : cmp
  })

  const resolveTarget = (key: string) => TARGET_OPTIONS.find(o => o.value === key)

  const handleCreate = () => {
    const target = resolveTarget(draft.targetKey)
    if (!draft.description.trim() || !target) return
    const newTask: Task = {
      _id: `t-${Date.now()}`,
      description: draft.description.trim(),
      priority: draft.priority,
      targetType: target.targetType,
      targetId: target.targetId,
      targetLabel: target.targetLabel,
      status: 'pending',
      createdAt: now(),
      updatedBy: currentUser,
      updatedAt: now(),
    }
    setTasks(prev => [newTask, ...prev])
    setDraft({ ...EMPTY_TASK })
    setShowCreate(false)
  }

  const handleEdit = () => {
    if (!selected || !draft.description.trim()) return
    const target = resolveTarget(draft.targetKey) || { targetType: selected.targetType, targetId: selected.targetId, targetLabel: selected.targetLabel }
    const updated: Task = {
      ...selected,
      description: draft.description.trim(),
      priority: draft.priority,
      targetType: target.targetType,
      targetId: target.targetId,
      targetLabel: target.targetLabel,
      updatedBy: currentUser,
      updatedAt: now(),
    }
    setTasks(prev => prev.map(t => t._id === selected._id ? updated : t))
    setSelected(updated)
    setShowEdit(false)
  }

  const handleComplete = () => {
    if (!selected) return
    setTasks(prev => prev.filter(t => t._id !== selected._id))
    setSelected(null)
    setShowDelete(false)
  }

  const openEdit = (task: Task) => {
    const key = TARGET_OPTIONS.find(o => o.targetType === task.targetType && o.targetId === task.targetId)?.value || ''
    setDraft({ description: task.description, priority: task.priority, targetKey: key, targetType: task.targetType, targetId: task.targetId, targetLabel: task.targetLabel })
    setShowEdit(true)
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Tareas Pendientes</h2>

        {/* Date sort */}
        <button
          className="rt-btn rt-btn-ghost rt-btn-sm"
          onClick={() => setSortDate(s => s === 'newest' ? 'oldest' : 'newest')}
          style={{ border: 'none', color: 'var(--text-muted)' }}
        >
          {sortDate === 'newest' ? '↓ Más reciente' : '↑ Más antigua'}
        </button>

        <div style={{ display: 'flex', gap: 4 }}>
          {[{ val: 0, label: 'Todas' }, { val: 1, label: 'Alta' }, { val: 2, label: 'Media' }, { val: 3, label: 'Baja' }].map(f => (
            <button key={f.val} onClick={() => setPriorityFilter(f.val)} className="rt-btn rt-btn-ghost rt-btn-sm" style={{
              background: priorityFilter === f.val ? 'var(--accent-soft)' : 'transparent',
              color: priorityFilter === f.val ? 'var(--accent)' : 'var(--text-muted)', border: 'none',
            }}>{f.label}</button>
          ))}
        </div>
        <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={() => { setDraft({ ...EMPTY_TASK }); setShowCreate(true) }}>+ Nueva tarea</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 16, alignItems: 'start' }}>
        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 && (
            <div className="rt-card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Sin tareas{priorityFilter > 0 ? ` de prioridad ${PRIORITY_LABEL[priorityFilter].toLowerCase()}` : ''}.</div>
            </div>
          )}
          {filtered.map(task => (
            <div key={task._id}
              onClick={() => setSelected(selected?._id === task._id ? null : task)}
              className="rt-card"
              style={{
                padding: '12px 16px', cursor: 'pointer',
                borderLeft: `3px solid ${PRIORITY_COLOR[task.priority]}`,
                background: selected?._id === task._id ? 'var(--accent-soft)' : 'var(--surface)',
                outline: selected?._id === task._id ? '1.5px solid var(--accent)' : 'none',
                transition: 'all 0.12s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                  background: PRIORITY_BG[task.priority], border: `1.5px solid ${PRIORITY_COLOR[task.priority]}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                  color: PRIORITY_COLOR[task.priority],
                }}>P{task.priority}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.4 }}>{task.description}</div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>→ {task.targetLabel}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{task.createdAt}</span>
                    {task.updatedBy && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>· {task.updatedBy}</span>}
                  </div>
                </div>
                <span className="badge badge-amber" style={{ fontSize: 10 }}>{PRIORITY_LABEL[task.priority]}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="rt-card" style={{ padding: 20, position: 'sticky', top: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--accent)' }}>Detalle de tarea</span>
              <button onClick={() => setSelected(null)} className="rt-btn rt-btn-ghost rt-btn-sm" style={{ padding: '2px 7px' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div className="rt-detail-label">DESCRIPCIÓN</div>
                <p className="rt-detail-value" style={{ marginTop: 4 }}>{selected.description}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div className="rt-detail-label">PRIORIDAD</div>
                  <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: PRIORITY_COLOR[selected.priority] }}>{PRIORITY_LABEL[selected.priority]}</div>
                </div>
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
                  <div className="rt-detail-label">CREADO</div>
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
              <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                <button className="rt-btn rt-btn-ghost rt-btn-sm" style={{ flex: 1 }} onClick={() => openEdit(selected)}>Editar</button>
                <button className="rt-btn rt-btn-danger rt-btn-sm" onClick={() => setShowDelete(true)}>Completar</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <TaskFormModal title="Nueva tarea" draft={draft} setDraft={setDraft} onConfirm={handleCreate} onCancel={() => setShowCreate(false)} confirmLabel="Crear tarea" />
      )}

      {/* Edit modal */}
      {showEdit && selected && (
        <TaskFormModal title="Editar tarea" draft={draft} setDraft={setDraft} onConfirm={handleEdit} onCancel={() => setShowEdit(false)} confirmLabel="Guardar cambios" />
      )}

      {/* Complete/delete confirm */}
      {showDelete && selected && (
        <div className="rt-modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="rt-modal" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
            <div className="rt-modal-header">
              <div className="rt-modal-title">Completar tarea</div>
              <button className="rt-modal-close" onClick={() => setShowDelete(false)}>✕</button>
            </div>
            <div className="rt-modal-body">
              <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
                ¿Marcar como completada y eliminar la tarea?<br />
                <strong style={{ display: 'block', marginTop: 8 }}>{selected.description}</strong>
              </p>
            </div>
            <div className="rt-modal-footer">
              <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setShowDelete(false)}>Cancelar</button>
              <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={handleComplete}>Marcar completada</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TaskFormModal({ title, draft, setDraft, onConfirm, onCancel, confirmLabel }: {
  title: string
  draft: typeof EMPTY_TASK
  setDraft: (d: typeof EMPTY_TASK) => void
  onConfirm: () => void
  onCancel: () => void
  confirmLabel: string
}) {
  return (
    <div className="rt-modal-overlay" onClick={onCancel}>
      <div className="rt-modal" style={{ width: 500 }} onClick={e => e.stopPropagation()}>
        <div className="rt-modal-header">
          <div className="rt-modal-title">{title}</div>
          <button className="rt-modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="rt-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="rt-label">Descripción *</label>
            <textarea className="rt-textarea" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} rows={3} placeholder="Describí la tarea a realizar..." style={{ width: '100%', marginTop: 5 }} autoFocus />
          </div>
          <div>
            <label className="rt-label">Prioridad</label>
            <select className="rt-select" value={draft.priority} onChange={e => setDraft({ ...draft, priority: Number(e.target.value) })} style={{ width: '100%', marginTop: 5 }}>
              <option value={1}>1 — Alta</option>
              <option value={2}>2 — Media</option>
              <option value={3}>3 — Baja</option>
            </select>
          </div>
          <div>
            <label className="rt-label">Elemento asociado *</label>
            <select className="rt-select" value={draft.targetKey} onChange={e => setDraft({ ...draft, targetKey: e.target.value })} style={{ width: '100%', marginTop: 5 }}>
              <option value="">Seleccioná un elemento...</option>
              {TARGET_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="rt-modal-footer">
          <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onCancel}>Cancelar</button>
          <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={onConfirm} disabled={!draft.description.trim() || !draft.targetKey}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
