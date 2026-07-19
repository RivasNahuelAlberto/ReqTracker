import { useState } from 'react'
import { MOCK_DOCUMENTS } from '../../data/mockData'

type Doc = {
  id: string
  name: string
  type: string
  description: string
  extension: string
  fileName: string
  content: string
  fileMode: 'link' | 'upload'
  link: string
}

const toDoc = (d: typeof MOCK_DOCUMENTS[0]): Doc => ({
  ...d,
  fileMode: (d as any).fileMode ?? 'link',
  link: (d as any).link ?? '',
})

const EMPTY_DOC: Omit<Doc, 'id'> = {
  name: '', type: 'texto', description: '', extension: '', fileName: '',
  content: '', fileMode: 'link', link: '',
}

export default function DocumentsTab({ projectId: _projectId }: { projectId: string }) {
  const [docs, setDocs] = useState<Doc[]>(MOCK_DOCUMENTS.map(toDoc))
  const [selected, setSelected] = useState<Doc | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [draft, setDraft] = useState<Omit<Doc, 'id'>>(EMPTY_DOC)

  const openCreate = () => { setDraft(EMPTY_DOC); setShowCreate(true) }
  const openEdit = (doc: Doc) => {
    setDraft({ name: doc.name, type: doc.type, description: doc.description, extension: doc.extension, fileName: doc.fileName, content: doc.content, fileMode: doc.fileMode, link: doc.link })
    setShowEdit(true)
  }

  const handleCreate = () => {
    if (!draft.name.trim()) return
    const newDoc: Doc = { ...draft, id: `doc-${Date.now()}` }
    setDocs(prev => [newDoc, ...prev])
    setShowCreate(false)
  }

  const handleEdit = () => {
    if (!selected || !draft.name.trim()) return
    setDocs(prev => prev.map(d => d.id === selected.id ? { ...draft, id: selected.id } : d))
    setSelected({ ...draft, id: selected.id })
    setShowEdit(false)
  }

  const handleDelete = () => {
    if (!selected) return
    setDocs(prev => prev.filter(d => d.id !== selected.id))
    setSelected(null)
    setShowDelete(false)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0, height: 'calc(100vh - 140px)', overflow: 'hidden' }}>
      {/* List */}
      <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Documentos</div>
          <button className="rt-btn rt-btn-primary rt-btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={openCreate}>
            + Nuevo documento
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {docs.length === 0 && (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 12 }}>Sin documentos</div>
          )}
          {docs.map((doc) => (
            <button key={doc.id} onClick={() => setSelected(doc)} style={{
              width: '100%', textAlign: 'left', padding: '10px',
              background: selected?.id === doc.id ? 'var(--accent-soft)' : 'transparent',
              border: 'none', borderRadius: 5, cursor: 'pointer', marginBottom: 2,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
              }}>
                {doc.type === 'archivo' ? '📎' : '📄'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: selected?.id === doc.id ? 'var(--accent)' : 'var(--text)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                  {doc.type === 'archivo'
                    ? (doc.fileMode === 'link' ? '🔗 Link externo' : `📁 ${doc.fileName || 'Archivo'}`)
                    : 'Texto'}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div style={{ overflow: 'auto', padding: '24px 28px' }}>
        {!selected ? (
          <div className="rt-empty">
            <div style={{ fontSize: 32, marginBottom: 12 }}>📁</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Seleccioná un documento</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>o creá uno nuevo con el botón de arriba</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>{selected.name}</h2>
                  <span className="badge badge-muted">{selected.type === 'archivo' ? 'Archivo' : 'Texto'}</span>
                  {selected.type === 'archivo' && (
                    <span className="badge badge-blue" style={{ fontSize: 10 }}>
                      {selected.fileMode === 'link' ? '🔗 Link' : '📁 Carga'}
                    </span>
                  )}
                </div>
                {selected.type === 'archivo' && selected.fileMode === 'upload' && selected.fileName && (
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>{selected.fileName}</div>
                )}
                {selected.type === 'archivo' && selected.fileMode === 'link' && selected.link && (
                  <a href={selected.link} target="_blank" rel="noopener noreferrer" className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{selected.link}</a>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => openEdit(selected)}>Editar</button>
                <button className="rt-btn rt-btn-danger rt-btn-sm" onClick={() => setShowDelete(true)}>Eliminar</button>
              </div>
            </div>
            <div style={{ maxWidth: 720 }}>
              {selected.description && (
                <div className="rt-detail-field">
                  <span className="rt-detail-label">DESCRIPCIÓN</span>
                  <p className="rt-detail-value" style={{ lineHeight: 1.7 }}>{selected.description}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <DocFormModal title="Nuevo documento" draft={draft} setDraft={setDraft} onConfirm={handleCreate} onCancel={() => setShowCreate(false)} confirmLabel="Crear documento" />
      )}
      {showEdit && selected && (
        <DocFormModal title={`Editar — ${selected.name}`} draft={draft} setDraft={setDraft} onConfirm={handleEdit} onCancel={() => setShowEdit(false)} confirmLabel="Guardar cambios" />
      )}
      {showDelete && selected && (
        <div className="rt-modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="rt-modal" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
            <div className="rt-modal-header">
              <div className="rt-modal-title">Eliminar documento</div>
              <button className="rt-modal-close" onClick={() => setShowDelete(false)}>✕</button>
            </div>
            <div className="rt-modal-body">
              <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
                ¿Eliminar <strong>{selected.name}</strong>? Esta acción no se puede deshacer.
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

function DocFormModal({ title, draft, setDraft, onConfirm, onCancel, confirmLabel }: {
  title: string
  draft: Omit<Doc, 'id'>
  setDraft: (d: Omit<Doc, 'id'>) => void
  onConfirm: () => void
  onCancel: () => void
  confirmLabel: string
}) {
  return (
    <div className="rt-modal-overlay" onClick={onCancel}>
      <div className="rt-modal" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
        <div className="rt-modal-header">
          <div className="rt-modal-title">{title}</div>
          <button className="rt-modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="rt-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="rt-label">Nombre *</label>
            <input autoFocus className="rt-input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Nombre del documento" style={{ width: '100%', marginTop: 5 }} />
          </div>
          <div>
            <label className="rt-label">Tipo</label>
            <select className="rt-select" value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value, fileMode: 'link', link: '', fileName: '' })} style={{ width: '100%', marginTop: 5 }}>
              <option value="texto">Texto</option>
              <option value="archivo">Archivo</option>
            </select>
          </div>

          {draft.type === 'archivo' && (
            <>
              {/* Link / Upload toggle */}
              <div>
                <label className="rt-label" style={{ marginBottom: 8 }}>Modo de ingreso</label>
                <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginTop: 5 }}>
                  {(['link', 'upload'] as const).map(mode => (
                    <button key={mode} type="button" onClick={() => setDraft({ ...draft, fileMode: mode, link: '', fileName: '' })} style={{
                      flex: 1, padding: '7px 0', fontSize: 12.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: draft.fileMode === mode ? 'var(--accent)' : 'var(--surface-2)',
                      color: draft.fileMode === mode ? '#fff' : 'var(--text-muted)',
                      transition: 'background 0.15s, color 0.15s',
                    }}>
                      {mode === 'link' ? '🔗 Link (URL)' : '📁 Carga de archivo'}
                    </button>
                  ))}
                </div>
              </div>
              {draft.fileMode === 'link' ? (
                <div>
                  <label className="rt-label">URL del documento</label>
                  <input className="rt-input mono" value={draft.link} onChange={e => setDraft({ ...draft, link: e.target.value })} placeholder="https://..." style={{ width: '100%', marginTop: 5 }} />
                </div>
              ) : (
                <div>
                  <label className="rt-label">Nombre del archivo</label>
                  <input className="rt-input" value={draft.fileName} onChange={e => setDraft({ ...draft, fileName: e.target.value })} placeholder="documento.pdf" style={{ width: '100%', marginTop: 5 }} />
                  <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--surface-2)', border: '1.5px dashed var(--border-2)', borderRadius: 'var(--radius-sm)', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
                    Clic para seleccionar archivo o arrastrar aquí
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="rt-label">{draft.type === 'texto' ? 'Contenido *' : 'Descripción'}</label>
            <textarea className="rt-textarea" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} rows={5}
              placeholder={draft.type === 'texto' ? 'Redactá el contenido del documento...' : 'Descripción del archivo adjunto'} style={{ width: '100%', marginTop: 5 }} />
          </div>
        </div>
        <div className="rt-modal-footer">
          <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onCancel}>Cancelar</button>
          <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={onConfirm} disabled={!draft.name.trim()}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
