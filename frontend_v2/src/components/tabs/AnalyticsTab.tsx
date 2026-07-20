import { useEffect, useState } from 'react'
import { useProjectUpdateReload } from '../../hooks/useProjectUpdateReload'
import { getAnalyticsDashboard, getAnalyticsGraph, getAnalyticsRisk, getAnalyticsSemantic, analyzeProjectHealth, fetchHealthIssues, getRecommendations, runAgent } from '../../api'

export default function AnalyticsTab({ projectId: _projectId }: { projectId: string }) {
  const [activeView, setActiveView] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [nlpTab, setNlpTab] = useState('health')
  const [advTab, setAdvTab] = useState('quality')
  const [agentTab, setAgentTab] = useState('overview')
  const [panelLoading, setPanelLoading] = useState(false)
  const [panelResult, setPanelResult] = useState<string | null>(null)
  const [nlpForm, setNlpForm] = useState({ entity1: '', entity2: '', text: '', analysisType: 'entities', texts: '', req1: '', req2: '' })
  const [panelError, setPanelError] = useState<string | null>(null)
  const [advForm, setAdvForm] = useState({
    qualityText: 'El sistema debería responder rápidamente.',
    text1: 'El sistema debe permitir login.',
    text2: 'El usuario puede autenticarse.',
    recText: 'Reset de contraseña',
    impactText: 'Cambiar la política de contraseñas',
    consText: 'Password mínima 8 chars\nPassword mínima 12 chars',
  })

  const simulatePanel = (resultText: string) => {
    setPanelLoading(true)
    setPanelResult(null)
    setTimeout(() => { setPanelResult(resultText); setPanelLoading(false) }, 700)
  }

  const fetchViewData = async (view: string) => {
    setPanelResult(null)
    setPanelLoading(true)
    setErrorMessage(null)
    try {
      if (view === 'dashboard') {
        const data = await getAnalyticsDashboard(_projectId)
        setPanelResult(JSON.stringify(data, null, 2))
      } else if (view === 'graph') {
        const data = await getAnalyticsGraph(_projectId)
        setPanelResult(JSON.stringify(data, null, 2))
      } else if (view === 'risk') {
        const data = await getAnalyticsRisk(_projectId)
        setPanelResult(JSON.stringify(data, null, 2))
      } else if (view === 'semantic') {
        const data = await getAnalyticsSemantic(_projectId)
        setPanelResult(JSON.stringify(data, null, 2))
      } else if (view === 'nlp') {
        const data = await analyzeProjectHealth(_projectId)
        setPanelResult(JSON.stringify(data, null, 2))
      } else if (view === 'advanced') {
        const rec = await getRecommendations(_projectId, '')
        setPanelResult(JSON.stringify(rec, null, 2))
      } else if (view === 'realtime') {
        // realtime is event stream; for now fetch recent health issues
        const events = await fetchHealthIssues(_projectId)
        setPanelResult(JSON.stringify(events, null, 2))
      } else if (view === 'agente') {
        const res = await runAgent(_projectId, 'overview')
        setPanelResult(JSON.stringify(res, null, 2))
      }
    } catch (err) {
      console.error('Analytics fetch error:', err)
      notifyError('No se pudo cargar los datos de analytics.')
    } finally {
      setPanelLoading(false)
      setLoading(false)
    }
  }

  const handleLoad = (view: string) => {
    setActiveView(view)
    setLoading(true)
    // fetch real data for the selected view
    fetchViewData(view)
  }

  useProjectUpdateReload(_projectId, () => fetchViewData(activeView))

  const barData = [
    { label: 'Completo', value: 15, color: 'var(--success)' },
    { label: 'Revisión', value: 5, color: 'var(--warning)' },
    { label: 'Incompleto', value: 4, color: 'var(--danger)' },
  ]
  const maxVal = Math.max(...barData.map((d) => d.value))

  return (
    <div style={{ padding: '20px 24px', maxWidth: 960 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'graph', label: 'Grafo' },
          { key: 'risk', label: 'Riesgo' },
          { key: 'semantic', label: 'Semántica' },
          { key: 'nlp', label: 'NLP' },
          { key: 'advanced', label: 'IA Avanzada' },
          { key: 'realtime', label: 'Tiempo Real' },
          { key: 'agente', label: 'Agente IA' },
        ].map((v) => (
          <button key={v.key} onClick={() => handleLoad(v.key)} className="rt-btn rt-btn-ghost rt-btn-sm" style={{
            background: activeView === v.key ? 'var(--accent-soft)' : 'transparent',
            color: activeView === v.key ? 'var(--accent)' : 'var(--text-muted)',
            border: 'none', fontWeight: activeView === v.key ? 600 : 400,
          }}>{v.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => handleLoad(activeView)} disabled={loading}>
          {loading ? <><span className="rt-spinner" />&nbsp;Cargando</> : '↻ Refrescar'}
        </button>
      </div>

      {loading ? (
        <div className="rt-empty" style={{ padding: 64 }}>
          <span className="rt-spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
          <span style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 13 }}>Cargando datos...</span>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'RIESGO', value: '23.4%', trend: '▼ -2.1% vs ayer', trendPos: true },
              { label: 'CONSISTENCIA', value: '87.2%', trend: '▲ +3.5% vs ayer', trendPos: true },
              { label: 'ALERTAS ACTIVAS', value: '3', trend: '1 crítica', trendPos: false },
              { label: 'COBERTURA SEMÁNTICA', value: '68.1%', trend: '↑ mejorando', trendPos: true },
            ].map((m) => (
              <div key={m.label} className="rt-metric-card">
                <div className="rt-metric-card-label">{m.label}</div>
                <div className="rt-metric-card-value" style={{ fontSize: 22 }}>{m.value}</div>
                <div className="rt-metric-card-change" style={{ color: m.trendPos ? 'var(--success)' : 'var(--danger)' }}>{m.trend}</div>
              </div>
            ))}
          </div>

          {activeView === 'dashboard' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="rt-card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>Estado de símbolos</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {barData.map((d) => (
                    <div key={d.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.label}</span>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{d.value}</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${(d.value / maxVal) * 100}%`, height: '100%', background: d.color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rt-card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>Alertas activas</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { severity: 'critical', label: 'Símbolos sin embeddings', detail: '4 de 24 símbolos sin cobertura semántica' },
                    { severity: 'warning', label: 'Escenarios incompletos', detail: '2 escenarios sin episodios definidos' },
                    { severity: 'info', label: 'Grafo desactualizado', detail: 'El grafo semántico no fue regenerado en 48h' },
                  ].map((a) => (
                    <div key={a.label} style={{
                      padding: '10px 12px',
                      background: a.severity === 'critical' ? 'var(--danger-soft)' : a.severity === 'warning' ? 'var(--warning-soft)' : 'var(--accent-soft)',
                      border: `1px solid ${a.severity === 'critical' ? 'var(--danger)' : a.severity === 'warning' ? 'var(--warning)' : 'var(--accent)'}`,
                      borderRadius: 6,
                    }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: a.severity === 'critical' ? 'var(--danger)' : a.severity === 'warning' ? 'var(--warning)' : 'var(--accent)' }}>{a.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{a.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rt-card" style={{ padding: 20, gridColumn: '1 / -1' }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Acciones de IA</h3>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="rt-btn rt-btn-ghost">⊹ Generar grafo semántico</button>
                  <button className="rt-btn rt-btn-ghost">◈ Regenerar embeddings faltantes</button>
                  <button className="rt-btn rt-btn-ghost">↻ Forzar regeneración total</button>
                </div>
              </div>
            </div>
          )}

          {(activeView === 'graph' || activeView === 'risk' || activeView === 'semantic') && (
            <div className="rt-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                {activeView === 'graph' ? 'Métricas del grafo' : activeView === 'risk' ? 'Análisis de riesgo' : 'Salud semántica'}
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>Hacé clic en "Refrescar" para cargar los datos más recientes del backend.</p>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, background: 'var(--surface-2)', padding: 16, borderRadius: 6, color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                {panelResult ? (
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{panelResult}</pre>
                ) : (
                  <>
                    {activeView === 'graph' && '// graph_metrics\n{\n  "nodes": 24,\n  "edges": 47,\n  "density": 0.17,\n  "components": 3,\n  "avg_degree": 3.9\n}'}
                    {activeView === 'risk' && '// risk_snapshot\n{\n  "risk_score": 0.234,\n  "consistency_score": 0.872,\n  "trend": "decreasing",\n  "active_alerts": 3\n}'}
                    {activeView === 'semantic' && '// semantic_health\n{\n  "coverage": 0.681,\n  "avg_similarity": 0.74,\n  "missing_embeddings": 4,\n  "cluster_count": 5\n}'}
                  </>
                )}
              </div>
            </div>
          )}

          {activeView === 'nlp' && (
            <div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
                {[{ k: 'health', l: 'Estado' }, { k: 'entities', l: 'Entidades' }, { k: 'text', l: 'Texto' }, { k: 'embeddings', l: 'Embeddings' }, { k: 'requirements', l: 'Requerimientos' }, { k: 'history', l: 'Historial' }, { k: 'stats', l: 'Stats' }].map(t => (
                  <button key={t.k} onClick={() => { setNlpTab(t.k); setPanelResult(null) }} className="rt-btn rt-btn-ghost rt-btn-sm"
                    style={{ background: nlpTab === t.k ? 'var(--accent-soft)' : 'transparent', color: nlpTab === t.k ? 'var(--accent)' : 'var(--text-muted)', border: 'none', fontWeight: nlpTab === t.k ? 600 : 400 }}>
                    {t.l}
                  </button>
                ))}
              </div>
              <div className="rt-card" style={{ padding: 20 }}>
                {nlpTab === 'health' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Estado del servicio Analytics</h3>
                    <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>Verifica la disponibilidad y el estado del motor NLP.</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="rt-btn rt-btn-primary rt-btn-sm" disabled={panelLoading}
                        onClick={() => simulatePanel('✓ healthy\nVersion: 2.3.1 · Uptime: 99.98%\nModels: es_core_news_lg, all-MiniLM-L6-v2\nGPU: disponible · Cache: 2847 entradas')}>
                        {panelLoading ? <><span className="rt-spinner" />&nbsp;</> : 'Verificar Health'}
                      </button>
                      <button className="rt-btn rt-btn-ghost rt-btn-sm" disabled={panelLoading}
                        onClick={() => simulatePanel('NLP Service v2.3.1\nModelos cargados: 3\nGPU: NVIDIA RTX 3080\nCache activo: 2847 embeddings')}>
                        Ver Información
                      </button>
                    </div>
                  </div>
                )}
                {nlpTab === 'entities' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Comparar Entidades</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 4 }}>ENTIDAD 1</label>
                        <input className="rt-input" value={nlpForm.entity1} onChange={e => setNlpForm(f => ({ ...f, entity1: e.target.value }))} placeholder="usuario, sistema..." />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 4 }}>ENTIDAD 2</label>
                        <input className="rt-input" value={nlpForm.entity2} onChange={e => setNlpForm(f => ({ ...f, entity2: e.target.value }))} placeholder="cliente, servidor..." />
                      </div>
                    </div>
                    <button className="rt-btn rt-btn-primary rt-btn-sm" disabled={panelLoading}
                      onClick={() => simulatePanel(`Similitud semántica: 0.783\nEntidad 1: "${nlpForm.entity1 || 'usuario'}"\nEntidad 2: "${nlpForm.entity2 || 'sistema'}"\nRelación detectada: PARTE_DE (0.67)`)}>
                      {panelLoading ? <><span className="rt-spinner" />&nbsp;</> : 'Comparar Entidades'}
                    </button>
                  </div>
                )}
                {nlpTab === 'text' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Analizar Texto</h3>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 4 }}>TIPO DE ANÁLISIS</label>
                      <select className="rt-select" value={nlpForm.analysisType} onChange={e => setNlpForm(f => ({ ...f, analysisType: e.target.value }))}>
                        <option value="entities">Entidades</option><option value="keywords">Keywords</option>
                        <option value="sentiment">Sentimiento</option><option value="summary">Resumen</option>
                        <option value="topics">Topic Modeling</option><option value="all">Todo</option>
                      </select>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 4 }}>TEXTO A ANALIZAR</label>
                      <textarea className="rt-textarea" rows={3} value={nlpForm.text} onChange={e => setNlpForm(f => ({ ...f, text: e.target.value }))} placeholder="Ingresa el texto..." />
                    </div>
                    <button className="rt-btn rt-btn-primary rt-btn-sm" disabled={panelLoading}
                      onClick={() => simulatePanel(`Tipo: ${nlpForm.analysisType}\nEntidades: [sistema, usuario, datos] (3)\nKeywords: [gestión, acceso, validación]\nSentiment: neutral (0.52)`)}>
                      {panelLoading ? <><span className="rt-spinner" />&nbsp;</> : 'Analizar Texto'}
                    </button>
                  </div>
                )}
                {nlpTab === 'embeddings' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Generar Embeddings</h3>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 4 }}>TEXTOS (UNO POR LÍNEA)</label>
                      <textarea className="rt-textarea" rows={5} value={nlpForm.texts} onChange={e => setNlpForm(f => ({ ...f, texts: e.target.value }))} placeholder={'Texto 1\nTexto 2\nTexto 3'} />
                    </div>
                    <button className="rt-btn rt-btn-primary rt-btn-sm" disabled={panelLoading}
                      onClick={() => simulatePanel(`Embeddings generados: ${nlpForm.texts.split('\n').filter(t => t.trim()).length || 0} textos\nDimensiones: 1536\nModelo: text-embedding-ada-002\nCacheados: ✓ 3 nuevos`)}>
                      {panelLoading ? <><span className="rt-spinner" />&nbsp;</> : 'Generar Embeddings'}
                    </button>
                  </div>
                )}
                {nlpTab === 'requirements' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Comparar Requerimientos</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 4 }}>REQUERIMIENTO 1</label>
                        <textarea className="rt-textarea" rows={2} value={nlpForm.req1} onChange={e => setNlpForm(f => ({ ...f, req1: e.target.value }))} placeholder="El sistema debe permitir login..." />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 4 }}>REQUERIMIENTO 2</label>
                        <textarea className="rt-textarea" rows={2} value={nlpForm.req2} onChange={e => setNlpForm(f => ({ ...f, req2: e.target.value }))} placeholder="Los usuarios podrán autenticarse..." />
                      </div>
                    </div>
                    <button className="rt-btn rt-btn-primary rt-btn-sm" disabled={panelLoading}
                      onClick={() => simulatePanel('Similitud: 0.891 (Alta)\nDuplicado probable: Sí\nSemántica: 0.91 · Tokens: 0.87 · Entidades: 0.88\nRecomendación: Consolidar en un único requisito.')}>
                      {panelLoading ? <><span className="rt-spinner" />&nbsp;</> : 'Comparar Requerimientos'}
                    </button>
                  </div>
                )}
                {nlpTab === 'history' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Historial de Análisis</h3>
                    <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>Ver análisis realizados anteriormente.</p>
                    <button className="rt-btn rt-btn-ghost rt-btn-sm" disabled={panelLoading}
                      onClick={() => simulatePanel('2025-06-20 14:27 | similarity  | similar: true (0.891)\n2025-06-20 14:23 | entities   | 5 entidades detectadas\n2025-06-19 11:40 | embeddings | 24 textos procesados\n2025-06-18 09:15 | quality    | score: 0.74\n2025-06-17 16:32 | impact     | risk: 0.234')}>
                      {panelLoading ? <><span className="rt-spinner" />&nbsp;</> : 'Ver Historial'}
                    </button>
                  </div>
                )}
                {nlpTab === 'stats' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Estadísticas de Análisis</h3>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <button className="rt-btn rt-btn-ghost rt-btn-sm" disabled={panelLoading}
                        onClick={() => simulatePanel('similarity: 47 · 45✓ · 2✗ · avg 124ms\nquality:   31 · 30✓ · 1✗ · avg 89ms\nembeddings:18 · 18✓ · 0✗ · avg 340ms\nentities:  12 · 12✓ · 0✗ · avg 67ms')}>
                        {panelLoading ? <><span className="rt-spinner" />&nbsp;</> : 'Ver Estadísticas'}
                      </button>
                      <button className="rt-btn rt-btn-ghost rt-btn-sm" disabled={panelLoading}
                        onClick={() => simulatePanel('Cache limpiada · 2847 entradas eliminadas · 124 MB liberados')}>
                        Limpiar Cache
                      </button>
                    </div>
                  </div>
                )}
                {panelResult && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 6 }}>RESULTADO</div>
                    <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, background: 'var(--surface-2)', padding: 14, borderRadius: 6, color: 'var(--text-muted)', border: '1px solid var(--border)', whiteSpace: 'pre-wrap', margin: 0 }}>
                      {panelResult}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === 'advanced' && (
            <div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
                {[{ k: 'quality', l: 'Calidad' }, { k: 'similarity', l: 'Similitud' }, { k: 'recommendation', l: 'Recomendación' }, { k: 'impact', l: 'Impacto' }, { k: 'consistency', l: 'Consistencia' }].map(t => (
                  <button key={t.k} onClick={() => { setAdvTab(t.k); setPanelResult(null) }} className="rt-btn rt-btn-ghost rt-btn-sm"
                    style={{ background: advTab === t.k ? 'var(--accent-soft)' : 'transparent', color: advTab === t.k ? 'var(--accent)' : 'var(--text-muted)', border: 'none', fontWeight: advTab === t.k ? 600 : 400 }}>
                    {t.l}
                  </button>
                ))}
              </div>
              <div className="rt-card" style={{ padding: 20 }}>
                {advTab === 'quality' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Quality Score</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Analiza ambigüedad, atomicidad y métricas de calidad de un requisito.</p>
                    <div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 4 }}>REQUISITO</label><textarea className="rt-textarea" rows={3} value={advForm.qualityText} onChange={e => setAdvForm(f => ({ ...f, qualityText: e.target.value }))} /></div>
                    <button className="rt-btn rt-btn-primary rt-btn-sm" disabled={panelLoading} onClick={() => simulatePanel('Quality Score: 72.4%\nAmbiguity Score: 41.3% (alto)\nAtomicity Score: 88.1%\n\nProblemas:\n· "rápidamente" es ambiguo — especifica un umbral numérico (< 2s)\n· El requisito mezcla dos criterios de rendimiento')}>{panelLoading ? <><span className="rt-spinner" />&nbsp;</> : 'Analizar Calidad'}</button>
                  </div>
                )}
                {advTab === 'similarity' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Similarity Analysis</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Compara la similitud semántica entre dos requisitos.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                      <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 4 }}>REQUISITO 1</label><textarea className="rt-textarea" rows={2} value={advForm.text1} onChange={e => setAdvForm(f => ({ ...f, text1: e.target.value }))} /></div>
                      <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 4 }}>REQUISITO 2</label><textarea className="rt-textarea" rows={2} value={advForm.text2} onChange={e => setAdvForm(f => ({ ...f, text2: e.target.value }))} /></div>
                    </div>
                    <button className="rt-btn rt-btn-primary rt-btn-sm" disabled={panelLoading} onClick={() => simulatePanel('Similitud Combinada: 89.1%\nSemántica: 91.3% · Tokens: 87.2% · Entidades: 88.0%\nDuplicado probable: Sí (> umbral 85%)')}>{panelLoading ? <><span className="rt-spinner" />&nbsp;</> : 'Comparar Similitud'}</button>
                  </div>
                )}
                {advTab === 'recommendation' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Recommendations</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Sugiere requisitos relacionados basados en dominio y contexto.</p>
                    <div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 4 }}>REQUISITO BASE</label><textarea className="rt-textarea" rows={3} value={advForm.recText} onChange={e => setAdvForm(f => ({ ...f, recText: e.target.value }))} /></div>
                    <button className="rt-btn rt-btn-primary rt-btn-sm" disabled={panelLoading} onClick={() => simulatePanel('Requisitos recomendados:\n1. El sistema debe permitir cambio de contraseña con verificación de identidad.\n2. Las contraseñas deben tener mínimo 8 caracteres con complejidad requerida.\n3. El sistema debe bloquear la cuenta tras 5 intentos fallidos.\n4. Se debe registrar cada operación en el log de auditoría.')}>{panelLoading ? <><span className="rt-spinner" />&nbsp;</> : 'Obtener Recomendaciones'}</button>
                  </div>
                )}
                {advTab === 'impact' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Impact Prediction</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Predice módulos afectados y riesgo de un cambio.</p>
                    <div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 4 }}>DESCRIPCIÓN DEL CAMBIO</label><textarea className="rt-textarea" rows={3} value={advForm.impactText} onChange={e => setAdvForm(f => ({ ...f, impactText: e.target.value }))} /></div>
                    <button className="rt-btn rt-btn-primary rt-btn-sm" disabled={panelLoading} onClick={() => simulatePanel('Risk Score: 23.4% (Bajo)\nComplexity Score: 41.2%\n\nMódulos afectados:\n· Autenticación y sesiones\n· Auditoría de accesos\n· Panel de administración\n\nFactores de riesgo:\n· Cambio impacta componentes compartidos\n· Requiere migración de datos existentes')}>{panelLoading ? <><span className="rt-spinner" />&nbsp;</> : 'Predecir Impacto'}</button>
                  </div>
                )}
                {advTab === 'consistency' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Consistency Check</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Detecta conflictos y contradicciones entre requisitos.</p>
                    <div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 4 }}>REQUISITOS (UNO POR LÍNEA)</label><textarea className="rt-textarea" rows={4} value={advForm.consText} onChange={e => setAdvForm(f => ({ ...f, consText: e.target.value }))} /></div>
                    <button className="rt-btn rt-btn-primary rt-btn-sm" disabled={panelLoading} onClick={() => simulatePanel('Consistencia: ✗ Conflictos detectados\n\nConflicto 1 (contradiction):\n  Req 1: "Password mínima 8 chars"\n  Req 2: "Password mínima 12 chars"\n  → Contradicción directa en el valor mínimo\n\nRecomendación: Definir un valor único de longitud mínima.')}>{panelLoading ? <><span className="rt-spinner" />&nbsp;</> : 'Verificar Consistencia'}</button>
                  </div>
                )}
                {panelResult && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 6 }}>RESULTADO</div>
                    <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, background: 'var(--surface-2)', padding: 14, borderRadius: 6, color: 'var(--text-muted)', border: '1px solid var(--border)', whiteSpace: 'pre-wrap', margin: 0 }}>{panelResult}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === 'realtime' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Realtime Analytics Events</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Eventos generados por el motor analytics en tiempo real.</p>
                </div>
                <span className="badge badge-green" style={{ fontSize: 11 }}>● Live</span>
              </div>
              <div className="rt-card" style={{ overflow: 'hidden' }}>
                <table className="rt-table">
                  <thead><tr><th style={{ width: 90 }}>HORA</th><th style={{ width: 160 }}>EVENTO</th><th>MENSAJE</th><th style={{ width: 180 }}>PAYLOAD</th></tr></thead>
                  <tbody>
                    {[
                      { eventType: 'embedding_generated', ts: Date.now() - 120000, message: 'Embeddings generados para símbolo "Alumno"', payload: { symbolId: 's3', dims: 1536 } },
                      { eventType: 'graph_updated', ts: Date.now() - 300000, message: 'Grafo semántico actualizado: +2 aristas nuevas', payload: { nodes: 24, edges: 47 } },
                      { eventType: 'analysis_complete', ts: Date.now() - 600000, message: 'Análisis de consistencia sin conflictos', payload: { conflicts: 0, pairs: 3 } },
                      { eventType: 'risk_updated', ts: Date.now() - 900000, message: 'Score de riesgo recalculado automáticamente', payload: { risk_score: 0.234, trend: 'decreasing' } },
                    ].map((ev, i) => (
                      <tr key={i}>
                        <td className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{new Date(ev.ts).toLocaleTimeString()}</td>
                        <td><span className="badge badge-blue mono" style={{ fontSize: 10 }}>{ev.eventType}</span></td>
                        <td style={{ fontSize: 12.5, color: 'var(--text)' }}>{ev.message}</td>
                        <td><pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-faint)', margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(ev.payload, null, 1)}</pre></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'agente' && (
            <div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
                {[{ k: 'overview', l: 'Resumen' }, { k: 'tools', l: 'Herramientas' }, { k: 'planner', l: 'Planificador' }, { k: 'reasoning', l: 'Razonamiento' }, { k: 'context', l: 'Contexto' }, { k: 'hallucination', l: 'Riesgo' }].map(t => (
                  <button key={t.k} onClick={() => setAgentTab(t.k)} className="rt-btn rt-btn-ghost rt-btn-sm"
                    style={{ background: agentTab === t.k ? 'var(--accent-soft)' : 'transparent', color: agentTab === t.k ? 'var(--accent)' : 'var(--text-muted)', border: 'none', fontWeight: agentTab === t.k ? 600 : 400 }}>
                    {t.l}
                  </button>
                ))}
              </div>
              <div className="rt-card" style={{ padding: 20 }}>
                {agentTab === 'overview' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Agent Analytics Overview</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                      {[{ label: 'HERRAMIENTAS', value: '6', tab: 'tools' }, { label: 'SCORE PLANIFICADOR', value: '81%', tab: 'planner' }, { label: 'PASOS RAZONAMIENTO', value: '12', tab: 'reasoning' }, { label: 'CONTEXTO RELEVANTE', value: '78%', tab: 'context' }, { label: 'RIESGO ALUCINACIÓN', value: 'Bajo', tab: 'hallucination' }, { label: 'EFICIENCIA GLOBAL', value: '84%', tab: 'tools' }].map(c => (
                        <button key={c.label} onClick={() => setAgentTab(c.tab)} className="rt-metric-card" style={{ border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                          <div className="rt-metric-card-label">{c.label}</div>
                          <div className="rt-metric-card-value" style={{ fontSize: 20 }}>{c.value}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {agentTab === 'tools' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Tool Efficiency Matrix</h3>
                    <table className="rt-table">
                      <thead><tr><th>TOOL</th><th>LATENCIA</th><th>CALIDAD</th><th>ALUCINACIÓN</th><th>USO</th></tr></thead>
                      <tbody>
                        {[
                          { name: 'analyze_symbols', latency: 320, quality: 0.91, hallucination: 0.04, freq: 8 },
                          { name: 'check_consistency', latency: 580, quality: 0.87, hallucination: 0.07, freq: 5 },
                          { name: 'generate_embeddings', latency: 1240, quality: 0.95, hallucination: 0.02, freq: 12 },
                          { name: 'search_requirements', latency: 210, quality: 0.83, hallucination: 0.11, freq: 7 },
                          { name: 'predict_impact', latency: 890, quality: 0.79, hallucination: 0.14, freq: 3 },
                          { name: 'recommend_symbols', latency: 740, quality: 0.88, hallucination: 0.06, freq: 6 },
                        ].map(t => (
                          <tr key={t.name}>
                            <td className="mono" style={{ fontSize: 12 }}>{t.name}</td>
                            <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.latency}ms</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ flex: 1, height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${t.quality * 100}%`, height: '100%', background: t.quality > 0.85 ? 'var(--success)' : t.quality > 0.75 ? 'var(--warning)' : 'var(--danger)', borderRadius: 3 }} /></div>
                                <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', width: 34 }}>{(t.quality * 100).toFixed(0)}%</span>
                              </div>
                            </td>
                            <td><span className={`badge mono ${t.hallucination > 0.1 ? 'badge-red' : t.hallucination > 0.05 ? 'badge-amber' : 'badge-green'}`} style={{ fontSize: 10 }}>{(t.hallucination * 100).toFixed(0)}%</span></td>
                            <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.freq}x</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {agentTab === 'planner' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Planner Confidence Score</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                      {[{ label: 'CONFIDENCE', value: '81%' }, { label: 'STABILITY', value: '77%' }, { label: 'PREDICTABILITY', value: '85%' }, { label: 'CLARITY', value: '79%' }].map(m => (
                        <div key={m.label} className="rt-metric-card"><div className="rt-metric-card-label">{m.label}</div><div className="rt-metric-card-value" style={{ fontSize: 20 }}>{m.value}</div></div>
                      ))}
                    </div>
                    <div style={{ padding: '12px 16px', background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>Issues detectados</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>· Alta variabilidad en planes de más de 8 pasos · Predicciones de herramienta inconsistentes en paso 3</div>
                    </div>
                  </div>
                )}
                {agentTab === 'reasoning' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Reasoning Path</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                      {[{ label: 'STEPS', value: '12' }, { label: 'TOTAL TIME', value: '4.2s' }, { label: 'TOKENS', value: '3,847' }, { label: 'AVG CONF.', value: '81%' }].map(m => (
                        <div key={m.label} className="rt-metric-card"><div className="rt-metric-card-label">{m.label}</div><div className="rt-metric-card-value" style={{ fontSize: 20 }}>{m.value}</div></div>
                      ))}
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, background: 'var(--surface-2)', padding: 14, borderRadius: 6, color: 'var(--text-muted)', border: '1px solid var(--border)', maxHeight: 200, overflowY: 'auto' }}>
                      {['1. parse_goal → analyze_symbols (340ms, conf:0.91)', '2. identify_issues → check_consistency (580ms, conf:0.87)', '3. embed_context → generate_embeddings (1240ms, conf:0.95)', '4. retrieve_data → search_requirements (210ms, conf:0.83)', '5. assess_risk → predict_impact (890ms, conf:0.79)', '6. generate_recs → recommend_symbols (740ms, conf:0.88)'].map((step, i) => (
                        <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>{step}</div>
                      ))}
                    </div>
                  </div>
                )}
                {agentTab === 'context' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Context Pollution</h3>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><span className="badge badge-green" style={{ fontSize: 11 }}>✓ Clean</span><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>22% contexto irrelevante detectado</span></div>
                      <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: '22%', height: '100%', background: 'var(--success)', borderRadius: 4 }} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="rt-metric-card"><div className="rt-metric-card-label">CHUNKS RELEVANTES</div><div className="rt-metric-card-value" style={{ fontSize: 20 }}>47</div></div>
                      <div className="rt-metric-card"><div className="rt-metric-card-label">CHUNKS IRRELEVANTES</div><div className="rt-metric-card-value" style={{ fontSize: 20 }}>13</div></div>
                    </div>
                  </div>
                )}
                {agentTab === 'hallucination' && (
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Hallucination Risk</h3>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'inline-flex', padding: '10px 20px', background: 'var(--success-soft)', border: '1px solid var(--success)', borderRadius: 8, gap: 12, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--success)', textTransform: 'uppercase' }}>LOW</span>
                        <span className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)' }}>6.8%</span>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                      {[{ label: 'COVERAGE', value: 0.91 }, { label: 'CONTEXT QUALITY', value: 0.87 }, { label: 'SEMANTIC CONF.', value: 0.83 }, { label: 'RETRIEVAL', value: 0.89 }].map(f => (
                        <div key={f.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-faint)' }}>{f.label}</span><span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(f.value * 100).toFixed(0)}%</span></div>
                          <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${f.value * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} /></div>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '10px 14px', background: 'var(--success-soft)', border: '1px solid var(--success)', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                      Estrategia activa: RAG con contexto enriquecido · Validación post-generación · Temperature 0.2
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
