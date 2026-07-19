import { useEffect, useState } from 'react'
import { fetchProject, updateAbout } from '../../api'

type ProjectData = {
  name?: string
  description?: string
  about?: { intro?: string; items?: string[] }
  symbols?: Array<any>
  scenarios?: Array<any>
  requirements?: Array<any>
  tasks?: Array<any>
  inspections?: Array<any>
}

export default function OverviewTab({ projectId }: { projectId: string }) {
  const [projectData, setProjectData] = useState<ProjectData | null>(null)
  const [aboutIntro, setAboutIntro] = useState('')
  const [editingAbout, setEditingAbout] = useState(false)
  const [draftIntro, setDraftIntro] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    const loadProject = async () => {
      setIsLoading(true)
      setError('')
      try {
        const data = await fetchProject(projectId)
        if (!mounted) return
        setProjectData(data)
        const intro = data?.about?.intro || data?.description || ''
        setAboutIntro(intro)
        setDraftIntro(intro)
      } catch {
        if (mounted) setError('No se pudo cargar la vista general del proyecto.')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    loadProject()
    return () => { mounted = false }
  }, [projectId])

  const symbols = Array.isArray(projectData?.symbols) ? projectData.symbols : []
  const scenarios = Array.isArray(projectData?.scenarios) ? projectData.scenarios : []
  const requirements = Array.isArray(projectData?.requirements) ? projectData.requirements : []
  const tasks = Array.isArray(projectData?.tasks) ? projectData.tasks : []
  const inspections = Array.isArray(projectData?.inspections) ? projectData.inspections : []
  const aboutItems = Array.isArray(projectData?.about?.items) ? projectData.about.items : []
  const completeSymbolsCount = symbols.filter((symbol: any) => ['complete', 'completed', 'done'].includes(String(symbol?.status || '').toLowerCase())).length
  const mainScenariosCount = scenarios.filter((scenario: any) => String(scenario?.type || '').toLowerCase().includes('escenario')).length
  const highPriorityRequirementsCount = requirements.filter((requirement: any) => String(requirement?.priority || '').toLowerCase() === 'alta').length

  const handleSaveIntro = async () => {
    setIsSaving(true)
    try {
      const savedAbout = await updateAbout(projectId, {
        intro: draftIntro,
        items: aboutItems,
      })
      setAboutIntro(savedAbout?.intro || draftIntro)
      setProjectData((prev) => prev ? { ...prev, about: { ...(prev.about || {}), intro: savedAbout?.intro || draftIntro, items: Array.isArray(savedAbout?.items) ? savedAbout.items : aboutItems } } : prev)
      setEditingAbout(false)
    } catch {
      setError('No se pudo guardar la descripción del proyecto.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {isLoading ? (
        <div className="rt-empty"><span className="rt-empty-icon">⏳</span><span style={{ fontSize: 13 }}>Cargando vista general...</span></div>
      ) : error ? (
        <div className="rt-empty"><span className="rt-empty-icon">⚠</span><span style={{ fontSize: 13 }}>{error}</span></div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'SÍMBOLOS', value: symbols.length, sub: `${completeSymbolsCount} completos` },
              { label: 'ESCENARIOS', value: scenarios.length, sub: `${mainScenariosCount} principales` },
              { label: 'REQUISITOS', value: requirements.length, sub: `${highPriorityRequirementsCount} alta prioridad` },
              { label: 'TAREAS', value: tasks.length, sub: 'pendientes' },
            ].map((s) => (
              <div key={s.label} className="rt-metric-card">
                <div className="rt-metric-card-label">{s.label}</div>
                <div className="rt-metric-card-value">{s.value}</div>
                <div className="rt-metric-card-change">{s.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="rt-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Acerca del Sistema</h3>
                <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => { setEditingAbout(!editingAbout); setDraftIntro(aboutIntro) }}>
                  {editingAbout ? 'Cancelar' : 'Editar'}
                </button>
              </div>
              {editingAbout ? (
                <>
                  <textarea className="rt-textarea" value={draftIntro} onChange={(e) => setDraftIntro(e.target.value)} rows={5} />
                  <button className="rt-btn rt-btn-primary rt-btn-sm" style={{ marginTop: 8 }} onClick={handleSaveIntro} disabled={isSaving}>
                    {isSaving ? 'Guardando...' : 'Guardar'}
                  </button>
                </>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>{aboutIntro || 'Aún no hay una introducción para este proyecto.'}</p>
              )}
            </div>

            <div className="rt-card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Tareas pendientes</h3>
              {tasks.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>No hay tareas registradas todavía.</div>
              ) : tasks.map((task: any) => (
                <div key={task._id || task.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 4, border: '1.5px solid',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                    background: task.priority === 1 ? 'var(--danger-soft)' : 'transparent',
                    borderColor: task.priority === 1 ? 'var(--danger)' : 'var(--border-2)',
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.4 }}>{task.description || task.title || 'Tarea sin descripción'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>→ {task.targetLabel || task.target || 'Sin destino'}</div>
                  </div>
                  <span className={`badge mono ${task.priority === 1 ? 'badge-red' : task.priority === 2 ? 'badge-amber' : 'badge-muted'}`} style={{ fontSize: 10 }}>
                    P{task.priority || 3}
                  </span>
                </div>
              ))}
            </div>

            <div className="rt-card" style={{ padding: 20, gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Reportes de inspección abiertos</h3>
              {inspections.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>No hay reportes de inspección abiertos.</div>
              ) : (
                <table className="rt-table">
                  <thead>
                    <tr>
                      <th>ASPECTO</th>
                      <th>DESCRIPCIÓN</th>
                      <th>ELEMENTO</th>
                      <th>FECHA</th>
                      <th>ESTADO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspections.map((ins: any) => (
                      <tr key={ins._id || ins.id}>
                        <td><span className="badge badge-amber">{ins.aspect || 'Inspección'}</span></td>
                        <td style={{ maxWidth: 340, color: 'var(--text-muted)' }}>{ins.description || 'Sin descripción'}</td>
                        <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ins.targetLabel || ins.target || 'Sin elemento'}</td>
                        <td style={{ color: 'var(--text-faint)', fontSize: 12 }}>{ins.createdAt || 'Sin fecha'}</td>
                        <td><span className={`badge ${ins.status === 'open' ? 'badge-amber' : 'badge-green'}`}>{ins.status || 'abierto'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
