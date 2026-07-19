import { useState } from 'react'
import { MOCK_PROJECT, MOCK_SYMBOLS, MOCK_SCENARIOS, MOCK_REQUIREMENTS, MOCK_TASKS, MOCK_INSPECTIONS, STATUS_BADGE, STATUS_LABEL } from '../../data/mockData'

export default function OverviewTab({ projectId }: { projectId: string }) {
  const proj = MOCK_PROJECT[projectId] ?? { name: 'Proyecto', description: '' }
  const [aboutIntro, setAboutIntro] = useState(proj.description)
  const [editingAbout, setEditingAbout] = useState(false)
  const [draftIntro, setDraftIntro] = useState(aboutIntro)

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'SÍMBOLOS', value: MOCK_SYMBOLS.length, sub: `${MOCK_SYMBOLS.filter(s => s.status === 'complete').length} completos` },
          { label: 'ESCENARIOS', value: MOCK_SCENARIOS.length, sub: `${MOCK_SCENARIOS.filter(s => s.type === 'Escenario').length} principales` },
          { label: 'REQUISITOS', value: MOCK_REQUIREMENTS.length, sub: `${MOCK_REQUIREMENTS.filter(r => r.priority === 'Alta').length} alta prioridad` },
          { label: 'TAREAS', value: MOCK_TASKS.length, sub: 'pendientes' },
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
              <button className="rt-btn rt-btn-primary rt-btn-sm" style={{ marginTop: 8 }} onClick={() => { setAboutIntro(draftIntro); setEditingAbout(false) }}>
                Guardar
              </button>
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>{aboutIntro}</p>
          )}
        </div>

        <div className="rt-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Tareas pendientes</h3>
          {MOCK_TASKS.map((task) => (
            <div key={task._id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{
                width: 18, height: 18, borderRadius: 4, border: '1.5px solid',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                background: task.priority === 1 ? 'var(--danger-soft)' : 'transparent',
                borderColor: task.priority === 1 ? 'var(--danger)' : 'var(--border-2)',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.4 }}>{task.description}</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>→ {task.targetLabel}</div>
              </div>
              <span className={`badge mono ${task.priority === 1 ? 'badge-red' : task.priority === 2 ? 'badge-amber' : 'badge-muted'}`} style={{ fontSize: 10 }}>
                P{task.priority}
              </span>
            </div>
          ))}
        </div>

        <div className="rt-card" style={{ padding: 20, gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Reportes de inspección abiertos</h3>
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
              {MOCK_INSPECTIONS.map((ins) => (
                <tr key={ins._id}>
                  <td><span className="badge badge-amber">{ins.aspect}</span></td>
                  <td style={{ maxWidth: 340, color: 'var(--text-muted)' }}>{ins.description}</td>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ins.targetLabel}</td>
                  <td style={{ color: 'var(--text-faint)', fontSize: 12 }}>{ins.createdAt}</td>
                  <td><span className={`badge ${STATUS_BADGE[ins.status]}`}>{STATUS_LABEL[ins.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
