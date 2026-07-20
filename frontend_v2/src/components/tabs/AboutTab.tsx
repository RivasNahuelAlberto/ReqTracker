import { useEffect, useRef, useState } from 'react'
import { useProjectUpdateReload } from '../../hooks/useProjectUpdateReload'
import { fetchProject, updateAbout } from '../../api'

export default function AboutTab({ projectId }: { projectId: string }) {
  const [intro, setIntro] = useState('')
  const [items, setItems] = useState<string[]>([])
  const [showEdit, setShowEdit] = useState(false)
  const [draftIntro, setDraftIntro] = useState('')
  const [draftItems, setDraftItems] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const mountedRef = useRef(true)

  const loadProject = async () => {
    if (!projectId) return
    setIsLoading(true)
    setError('')
    try {
      const data = await fetchProject(projectId)
      if (!mountedRef.current) return
      const nextIntro = data?.about?.intro || data?.description || ''
      const nextItems = Array.isArray(data?.about?.items) ? data.about.items : []
      setIntro(nextIntro)
      setItems(nextItems)
      setDraftIntro(nextIntro)
      setDraftItems(nextItems)
    } catch {
      if (mountedRef.current) setError('No se pudo cargar la información de este proyecto.')
    } finally {
      if (mountedRef.current) setIsLoading(false)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    loadProject()
    return () => { mountedRef.current = false }
  }, [projectId])

  useProjectUpdateReload(projectId, loadProject)

  const openEdit = () => {
    setDraftIntro(intro)
    setDraftItems([...items])
    setShowEdit(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const savedAbout = await updateAbout(projectId, {
        intro: draftIntro,
        items: draftItems.filter((item) => item.trim()),
      })
      const nextItems = Array.isArray(savedAbout?.items) ? savedAbout.items : draftItems.filter((item) => item.trim())
      setIntro(savedAbout?.intro || draftIntro)
      setItems(nextItems)
      setShowEdit(false)
    } catch {
      setError('No se pudo actualizar la información del proyecto.')
    } finally {
      setIsSaving(false)
    }
  }

  const addItem = () => setDraftItems((prev) => [...prev, ''])
  const removeItem = (idx: number) => setDraftItems((prev) => prev.filter((_, i) => i !== idx))
  const updateItem = (idx: number, val: string) => setDraftItems((prev) => prev.map((it, i) => (i === idx ? val : it)))

  return (
    <div style={{ padding: '24px 28px', maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 4 }}>Acerca del Sistema</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Descripción general e ítems de alcance del proyecto.</p>
        </div>
        <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={openEdit}>Editar</button>
      </div>

      {isLoading ? (
        <div className="rt-empty"><span className="rt-empty-icon">⏳</span><span style={{ fontSize: 13 }}>Cargando información...</span></div>
      ) : error ? (
        <div className="rt-empty"><span className="rt-empty-icon">⚠</span><span style={{ fontSize: 13 }}>{error}</span></div>
      ) : (
        <>
          <div className="rt-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>Introducción</div>
            <p style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.8, margin: 0 }}>{intro || <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>Sin descripción.</span>}</p>
          </div>

          {items.filter((item) => item.trim()).length > 0 && (
            <div className="rt-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12 }}>Características principales</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.filter((item) => item.trim()).map((item, idx) => (
                  <div key={`${item}-${idx}`} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 14px', background: 'var(--surface-2)',
                    border: '1px solid var(--border)', borderRadius: 6,
                  }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-soft)', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>
                      {idx + 1}
                    </span>
                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showEdit && (
        <div className="rt-modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="rt-modal" style={{ width: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="rt-modal-header">
              <div className="rt-modal-title">Editar — Acerca del Sistema</div>
              <button className="rt-modal-close" onClick={() => setShowEdit(false)}>✕</button>
            </div>
            <div className="rt-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="rt-label">Introducción</label>
                <textarea className="rt-textarea" value={draftIntro} onChange={(e) => setDraftIntro(e.target.value)} rows={5} placeholder="Descripción general del sistema..." style={{ width: '100%', marginTop: 5 }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label className="rt-label">Características / Alcance</label>
                  <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={addItem}>+ Agregar ítem</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {draftItems.map((item, idx) => (
                    <div key={`${item}-${idx}`} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-soft)', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--accent)', flexShrink: 0, marginTop: 8 }}>
                        {idx + 1}
                      </span>
                      <input className="rt-input" value={item} onChange={(e) => updateItem(idx, e.target.value)} placeholder={`Característica ${idx + 1}...`} style={{ flex: 1 }} />
                      <button className="rt-btn rt-btn-danger rt-btn-sm" onClick={() => removeItem(idx)} style={{ marginTop: 2 }}>✕</button>
                    </div>
                  ))}
                  {draftItems.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', padding: '12px 0' }}>Agregá ítems con el botón de arriba.</div>
                  )}
                </div>
              </div>
            </div>
            <div className="rt-modal-footer">
              <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setShowEdit(false)}>Cancelar</button>
              <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
