import { useState } from 'react'
import { MOCK_RESOLVE_NOTES } from '../../data/mockData'

type NoteBase = typeof MOCK_RESOLVE_NOTES[0]
type Note = NoteBase & { updatedBy?: string; updatedAt?: string }

const now = () => new Date().toISOString().slice(0, 10)

export default function ResolveTab({ projectId: _projectId, currentUser }: { projectId: string; currentUser?: string }) {
  const [notes, setNotes] = useState<Note[]>(MOCK_RESOLVE_NOTES.map(n => ({ ...n })))
  const [selected, setSelected] = useState<Note | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showResolve, setShowResolve] = useState(false)
  const [newText, setNewText] = useState('')
  const [editText, setEditText] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all')
  const [searchText, setSearchText] = useState('')
  const [sortDate, setSortDate] = useState<'newest' | 'oldest'>('newest')

  const statusFiltered = notes.filter(n => filter === 'all' || n.status === filter)
  const searchFiltered = searchText.trim()
    ? statusFiltered.filter(n => n.text.toLowerCase().includes(searchText.toLowerCase()))
    : statusFiltered
  const filtered = [...searchFiltered].sort((a, b) => {
    const cmp = a.createdAt.localeCompare(b.createdAt)
    return sortDate === 'newest' ? -cmp : cmp
  })
  const pending = notes.filter(n => n.status === 'pending')

  const handleCreate = () => {
    if (!newText.trim()) return
    const note: Note = {
      _id: `rn-${Date.now()}`,
      text: newText.trim(),
      status: 'pending',
      createdAt: now(),
      updatedBy: currentUser,
      updatedAt: now(),
    }
    setNotes(prev => [note, ...prev])
    setNewText('')
    setShowCreate(false)
  }

  const handleEdit = () => {
    if (!selected || !editText.trim()) return
    const updated: Note = { ...selected, text: editText.trim(), updatedBy: currentUser, updatedAt: now() }
    setNotes(prev => prev.map(n => n._id === selected._id ? updated : n))
    setSelected(updated)
    setShowEdit(false)
  }

  const handleResolve = () => {
    if (!selected) return
    const updated: Note = { ...selected, status: 'resolved', updatedBy: currentUser, updatedAt: now() }
    setNotes(prev => prev.map(n => n._id === selected._id ? updated : n))
    setSelected(null)
    setShowResolve(false)
  }

  const handleDelete = () => {
    if (!selected) return
    setNotes(prev => prev.filter(n => n._id !== selected._id))
    setSelected(null)
    setShowDelete(false)
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
          A Resolver
          {pending.length > 0 && <span className="badge badge-amber" style={{ marginLeft: 8, fontSize: 11 }}>{pending.length} pendientes</span>}
        </h2>

        {/* Date sort */}
        <button
          className="rt-btn rt-btn-ghost rt-btn-sm"
          onClick={() => setSortDate(s => s === 'newest' ? 'oldest' : 'newest')}
          title="Ordenar por fecha"
          style={{ border: 'none', color: 'var(--text-muted)' }}
        >
          {sortDate === 'newest' ? '↓ Más reciente' : '↑ Más antigua'}
        </button>

        <div style={{ display: 'flex', gap: 4 }}>
          {([['all', 'Todas'], ['pending', 'Pendientes'], ['resolved', 'Resueltas']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)} className="rt-btn rt-btn-ghost rt-btn-sm" style={{
              background: filter === val ? 'var(--accent-soft)' : 'transparent',
              color: filter === val ? 'var(--accent)' : 'var(--text-muted)', border: 'none',
            }}>{label}</button>
          ))}
        </div>
        <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={() => { setNewText(''); setShowCreate(true) }}>+ Agregar nota</button>
      </div>

      {/* Search / filter input */}
      <div className="rt-card" style={{ padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>⌕</span>
        <input
          className="rt-input"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="Filtrar notas por contenido..."
          style={{ flex: 1, border: 'none', background: 'transparent', padding: '2px 0', fontSize: 13 }}
        />
        {searchText && (
          <button
            onClick={() => setSearchText('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 14, padding: '0 4px' }}
          >
            ×
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.length === 0 && (
            <div className="rt-card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                {searchText ? 'Sin resultados para ese filtro.' : filter === 'pending' ? 'Sin notas pendientes.' : filter === 'resolved' ? 'Sin notas resueltas.' : 'Sin notas.'}
              </div>
            </div>
          )}
          {filtered.map(note => (
            <div key={note._id}
              onClick={() => setSelected(selected?._id === note._id ? null : note)}
              className="rt-card"
              style={{
                padding: '12px 16px', cursor: 'pointer',
                borderLeft: `3px solid ${note.status === 'pending' ? 'var(--warning)' : 'var(--success)'}`,
                background: selected?._id === note._id ? 'var(--accent-soft)' : 'var(--surface)',
                outline: selected?._id === note._id ? '1.5px solid var(--accent)' : 'none',
                opacity: note.status === 'resolved' ? 0.7 : 1,
                transition: 'all 0.12s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2,
                  background: note.status === 'pending' ? 'var(--warning-soft)' : 'var(--success-soft)',
                  border: `1.5px solid ${note.status === 'pending' ? 'var(--warning)' : 'var(--success)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: note.status === 'pending' ? 'var(--warning)' : 'var(--success)', fontWeight: 700,
                }}>
                  {note.status === 'resolved' ? '✓' : '!'}
                </span>
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize: 13, color: 'var(--text)', lineHeight: 1.5, margin: 0,
                    textDecoration: note.status === 'resolved' ? 'line-through' : 'none',
                  }}>{note.text}</p>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4, display: 'flex', gap: 10 }}>
                    <span>{note.createdAt}</span>
                    {note.updatedBy && <span>· por {note.updatedBy}</span>}
                  </div>
                </div>
                <span className={`badge ${note.status === 'pending' ? 'badge-amber' : 'badge-green'}`} style={{ fontSize: 10 }}>
                  {note.status === 'pending' ? 'Pendiente' : 'Resuelto'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Detail */}
        {selected && (
          <div className="rt-card" style={{ padding: 20, position: 'sticky', top: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--accent)' }}>Nota a resolver</span>
              <button onClick={() => setSelected(null)} className="rt-btn rt-btn-ghost rt-btn-sm" style={{ padding: '2px 7px' }}>×</button>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.7, marginBottom: 16 }}>{selected.text}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <div className="rt-detail-label">ESTADO</div>
                <div style={{ marginTop: 4 }}>
                  <span className={`badge ${selected.status === 'pending' ? 'badge-amber' : 'badge-green'}`}>
                    {selected.status === 'pending' ? 'Pendiente' : 'Resuelto'}
                  </span>
                </div>
              </div>
              <div>
                <div className="rt-detail-label">FECHA</div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>{selected.createdAt}</div>
              </div>
              {selected.updatedBy && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="rt-detail-label">ÚLTIMA MODIFICACIÓN</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {selected.updatedBy} · {selected.updatedAt}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {selected.status === 'pending' && (
                <>
                  <button className="rt-btn rt-btn-ghost rt-btn-sm" style={{ flex: 1 }} onClick={() => { setEditText(selected.text); setShowEdit(true) }}>Editar</button>
                  <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={() => setShowResolve(true)}>Resolver</button>
                </>
              )}
              <button className="rt-btn rt-btn-danger rt-btn-sm" onClick={() => setShowDelete(true)}>Eliminar</button>
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="rt-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="rt-modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
            <div className="rt-modal-header">
              <div className="rt-modal-title">Nueva nota a resolver</div>
              <button className="rt-modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="rt-modal-body">
              <label className="rt-label">Descripción *</label>
              <textarea className="rt-textarea" value={newText} onChange={e => setNewText(e.target.value)} rows={4} placeholder="Describí la duda, problema o decisión pendiente..." style={{ width: '100%', marginTop: 5 }} autoFocus />
            </div>
            <div className="rt-modal-footer">
              <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={handleCreate} disabled={!newText.trim()}>Agregar nota</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEdit && selected && (
        <div className="rt-modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="rt-modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
            <div className="rt-modal-header">
              <div className="rt-modal-title">Editar nota</div>
              <button className="rt-modal-close" onClick={() => setShowEdit(false)}>✕</button>
            </div>
            <div className="rt-modal-body">
              <label className="rt-label">Descripción *</label>
              <textarea className="rt-textarea" value={editText} onChange={e => setEditText(e.target.value)} rows={4} style={{ width: '100%', marginTop: 5 }} autoFocus />
            </div>
            <div className="rt-modal-footer">
              <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setShowEdit(false)}>Cancelar</button>
              <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={handleEdit} disabled={!editText.trim()}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve confirm */}
      {showResolve && selected && (
        <div className="rt-modal-overlay" onClick={() => setShowResolve(false)}>
          <div className="rt-modal" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
            <div className="rt-modal-header">
              <div className="rt-modal-title">Marcar como resuelta</div>
              <button className="rt-modal-close" onClick={() => setShowResolve(false)}>✕</button>
            </div>
            <div className="rt-modal-body">
              <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>¿Marcar esta nota como resuelta?<br /><strong style={{ display: 'block', marginTop: 8 }}>{selected.text}</strong></p>
            </div>
            <div className="rt-modal-footer">
              <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setShowResolve(false)}>Cancelar</button>
              <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={handleResolve}>Marcar resuelta</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDelete && selected && (
        <div className="rt-modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="rt-modal" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
            <div className="rt-modal-header">
              <div className="rt-modal-title">Eliminar nota</div>
              <button className="rt-modal-close" onClick={() => setShowDelete(false)}>✕</button>
            </div>
            <div className="rt-modal-body">
              <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>¿Eliminar esta nota? La acción no se puede deshacer.</p>
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
