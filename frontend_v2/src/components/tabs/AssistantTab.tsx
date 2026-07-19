import { useState, useRef, useEffect } from 'react'
import { MOCK_CONVERSATIONS, MOCK_CHAT_MESSAGES } from '../../data/mockData'

export default function AssistantTab({ projectId: _projectId }: { projectId: string }) {
  const [messages, setMessages] = useState(MOCK_CHAT_MESSAGES)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [activeConv, setActiveConv] = useState(MOCK_CONVERSATIONS[0])
  const msgListRef = useRef<HTMLDivElement>(null)
  const [panel, setPanel] = useState('chat')
  const [copilotText, setCopilotText] = useState('')
  const [copilotResult, setCopilotResult] = useState<string | null>(null)
  const [copilotLoading, setCopilotLoading] = useState(false)
  const [agentGoal, setAgentGoal] = useState('')
  const [agentTask, setAgentTask] = useState<{ status: string; goal: string; steps: Array<{ description: string; tool: string; status: string }> } | null>(null)
  const [agentLoading, setAgentLoading] = useState(false)
  const [healthResult, setHealthResult] = useState<Array<{ id: string; type: string; severity: string; description: string; suggestedFix: string }> | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)

  useEffect(() => {
    if (msgListRef.current) {
      msgListRef.current.scrollTop = msgListRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || sending) return
    const userMsg = { role: 'user', content: input.trim(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)
    setTimeout(() => {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'He analizado tu consulta en el contexto del proyecto. Esta es una respuesta de demostración — en producción, el asistente tiene acceso completo al léxico, escenarios y requisitos del proyecto para darte respuestas precisas y contextualizadas.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }])
      setSending(false)
    }, 1400)
  }

  const ASSISTANT_PANELS = [
    { key: 'chat', label: 'Chat' },
    { key: 'copilot', label: 'Copilot IA' },
    { key: 'agente', label: 'Agente Autónomo' },
    { key: 'health', label: 'Health Monitor' },
  ]

  const runCopilot = () => {
    if (!copilotText.trim()) return
    setCopilotLoading(true)
    setCopilotResult(null)
    setTimeout(() => {
      setCopilotResult(`Recomendaciones para el texto analizado:\n\n1. El requisito presenta ambigüedad en la condición de borde — especificar rango numérico exacto.\n2. Posible duplicado con REQ-002 (mismo actor, acción similar).\n3. Sugerencia de atomicidad: dividir en dos requisitos separados para mejor trazabilidad.\n4. Mejora de redacción: usar voz activa y evitar el término "algunos".\n5. Cobertura de escenario: agregar caso de falla de autenticación.`)
      setCopilotLoading(false)
    }, 900)
  }

  const runAgent = () => {
    if (!agentGoal.trim()) return
    setAgentLoading(true)
    setAgentTask(null)
    setTimeout(() => {
      setAgentTask({
        status: 'completed',
        goal: agentGoal.trim(),
        steps: [
          { description: 'Análisis del léxico del proyecto', tool: 'lexicon_analyzer', status: 'success' },
          { description: 'Identificación de entidades relacionadas', tool: 'entity_extractor', status: 'success' },
          { description: 'Generación de escenarios candidatos', tool: 'scenario_generator', status: 'success' },
          { description: 'Validación de consistencia con requisitos existentes', tool: 'consistency_checker', status: 'success' },
          { description: 'Reporte de resultados y sugerencias', tool: 'report_builder', status: 'success' },
        ],
      })
      setAgentLoading(false)
    }, 1400)
  }

  const runHealth = () => {
    setHealthLoading(true)
    setHealthResult(null)
    setTimeout(() => {
      setHealthResult([
        { id: 'H-001', type: 'consistency', severity: 'high', description: 'REQ-003 contradice el escenario SC-02 en el flujo de autenticación.', suggestedFix: 'Revisar la precondición del escenario SC-02 para alinearla con REQ-003.' },
        { id: 'H-002', type: 'ambiguity', severity: 'medium', description: 'El término "rápidamente" en REQ-005 no tiene definición cuantitativa.', suggestedFix: 'Reemplazar por "en menos de 2 segundos" o el SLA definido.' },
        { id: 'H-003', type: 'coverage', severity: 'low', description: 'El símbolo "Alumno" no tiene ningún escenario de falla asociado.', suggestedFix: 'Agregar escenario de error para la entidad Alumno.' },
      ])
      setHealthLoading(false)
    }, 1100)
  }

  const severityColor: Record<string, string> = { high: 'var(--danger)', medium: 'var(--warning)', low: 'var(--success)' }
  const severityBg: Record<string, string> = { high: 'var(--danger-soft)', medium: 'var(--warning-soft)', low: 'var(--success-soft)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 2, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        {ASSISTANT_PANELS.map((p) => (
          <button key={p.key} onClick={() => setPanel(p.key)} style={{
            padding: '5px 14px', fontSize: 12.5, fontWeight: 600, borderRadius: 5, border: 'none', cursor: 'pointer',
            background: panel === p.key ? 'var(--accent-soft)' : 'transparent',
            color: panel === p.key ? 'var(--accent)' : 'var(--text-muted)',
            transition: 'all 0.15s',
          }}>{p.label}</button>
        ))}
      </div>

      {panel === 'chat' && (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', flex: 1, overflow: 'hidden' }}>
          <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
              <button className="rt-btn rt-btn-primary rt-btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                + Nueva conversación
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-faint)', textTransform: 'uppercase', padding: '6px 8px 4px' }}>Conversaciones</div>
              {MOCK_CONVERSATIONS.map((conv) => (
                <button key={conv._id} onClick={() => setActiveConv(conv)} style={{
                  width: '100%', textAlign: 'left', padding: '8px 10px',
                  background: activeConv._id === conv._id ? 'var(--accent-soft)' : 'transparent',
                  border: 'none', borderRadius: 5, cursor: 'pointer', marginBottom: 2,
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: activeConv._id === conv._id ? 'var(--accent)' : 'var(--text)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{conv.date}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{activeConv.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Asistente IA · {activeConv.date}</div>
              </div>
              {sending && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontSize: 12 }}>
                  <span className="rt-spinner" style={{ width: 14, height: 14 }} />
                  Generando...
                </div>
              )}
            </div>
            <div ref={msgListRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {msg.role === 'assistant' && (
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>⬡</div>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 500 }}>
                      {msg.role === 'user' ? 'Tú' : 'Asistente'} · {msg.timestamp}
                    </span>
                  </div>
                  <div className={`rt-chat-bubble ${msg.role === 'user' ? 'rt-chat-bubble-user' : 'rt-chat-bubble-ai'}`} style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>⬡</div>
                  <div className="rt-chat-bubble rt-chat-bubble-ai" style={{ padding: '8px 14px' }}>
                    <span className="rt-cursor-blink" />
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                className="rt-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Escribí tu consulta sobre el proyecto... (Enter para enviar)"
                rows={2}
                style={{ flex: 1, minHeight: 60, maxHeight: 120 }}
              />
              <button className="rt-btn rt-btn-primary" onClick={handleSend} disabled={!input.trim() || sending} style={{ padding: '9px 16px', alignSelf: 'flex-end' }}>
                {sending ? <span className="rt-spinner" /> : '→'}
              </button>
            </div>
          </div>
        </div>
      )}

      {panel === 'copilot' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <div style={{ maxWidth: 700 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Copilot IA</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pegá texto de un requisito o entidad para obtener sugerencias en tiempo real sobre ambigüedades, duplicados y mejoras.</div>
            </div>
            <div className="rt-card" style={{ padding: 16, marginBottom: 16 }}>
              <div className="rt-label" style={{ marginBottom: 6 }}>Texto activo</div>
              <textarea
                className="rt-textarea"
                value={copilotText}
                onChange={(e) => setCopilotText(e.target.value)}
                placeholder="El sistema debe permitir que el usuario pueda acceder rápidamente a sus datos..."
                rows={4}
                style={{ width: '100%', marginBottom: 10 }}
              />
              <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={runCopilot} disabled={copilotLoading || !copilotText.trim()}>
                {copilotLoading ? <><span className="rt-spinner" style={{ width: 12, height: 12 }} /> Analizando...</> : 'Obtener recomendaciones'}
              </button>
            </div>
            {copilotLoading && (
              <div className="rt-card" style={{ padding: 24, textAlign: 'center' }}>
                <span className="rt-spinner" style={{ width: 20, height: 20, margin: '0 auto 10px', display: 'block' }} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analizando con IA...</div>
              </div>
            )}
            {copilotResult && (
              <div className="rt-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10 }}>Recomendaciones</div>
                <pre style={{ fontSize: 12.5, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0, fontFamily: 'inherit' }}>{copilotResult}</pre>
              </div>
            )}
            {!copilotResult && !copilotLoading && (
              <div className="rt-card" style={{ padding: 24, textAlign: 'center', border: '1.5px dashed var(--border-2)' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>⬡</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ingresá texto y presioná "Obtener recomendaciones" para iniciar el análisis.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {panel === 'agente' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <div style={{ maxWidth: 700 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Agente Autónomo</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Describí un objetivo y el agente generará un plan ejecutable con pasos, herramientas y resultados.</div>
            </div>
            <div className="rt-card" style={{ padding: 16, marginBottom: 16 }}>
              <div className="rt-label" style={{ marginBottom: 6 }}>Objetivo del agente</div>
              <textarea
                className="rt-textarea"
                value={agentGoal}
                onChange={(e) => setAgentGoal(e.target.value)}
                placeholder="Ej: Identificar requisitos incompletos y generar escenarios de prueba para cada uno."
                rows={3}
                style={{ width: '100%', marginBottom: 10 }}
              />
              <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={runAgent} disabled={agentLoading || !agentGoal.trim()}>
                {agentLoading ? <><span className="rt-spinner" style={{ width: 12, height: 12 }} /> Ejecutando agente...</> : 'Ejecutar agente'}
              </button>
            </div>
            {agentLoading && (
              <div className="rt-card" style={{ padding: 24, textAlign: 'center' }}>
                <span className="rt-spinner" style={{ width: 20, height: 20, margin: '0 auto 10px', display: 'block' }} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Planificando y ejecutando pasos...</div>
              </div>
            )}
            {agentTask && (
              <div className="rt-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--accent)' }}>Resultado</div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--success-soft)', color: 'var(--success)' }}>{agentTask.status}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>Objetivo: </span>{agentTask.goal}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {agentTask.steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 6 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--success-soft)', border: '1.5px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--success)', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 500 }}>{step.description}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface)', padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)' }}>{step.tool}</span>
                          <span style={{ marginLeft: 8, color: 'var(--success)' }}>✓ {step.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!agentTask && !agentLoading && (
              <div className="rt-card" style={{ padding: 24, textAlign: 'center', border: '1.5px dashed var(--border-2)' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>⚙</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Definí un objetivo y ejecutá el agente para ver el plan generado.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {panel === 'health' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <div style={{ maxWidth: 760 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Health Monitor</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Detecta inconsistencias, ambigüedades y problemas de cobertura en el proyecto.</div>
              </div>
              <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={runHealth} disabled={healthLoading}>
                {healthLoading ? <><span className="rt-spinner" style={{ width: 12, height: 12 }} /> Analizando...</> : 'Analizar proyecto'}
              </button>
            </div>
            {healthLoading && (
              <div className="rt-card" style={{ padding: 32, textAlign: 'center' }}>
                <span className="rt-spinner" style={{ width: 22, height: 22, margin: '0 auto 12px', display: 'block' }} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ejecutando análisis de salud...</div>
              </div>
            )}
            {healthResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{healthResult.length} problema{healthResult.length !== 1 ? 's' : ''} encontrado{healthResult.length !== 1 ? 's' : ''}</div>
                </div>
                {healthResult.map((issue) => (
                  <div key={issue.id} className="rt-card" style={{ padding: 14, borderLeft: `3px solid ${severityColor[issue.severity]}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: severityBg[issue.severity], color: severityColor[issue.severity], textTransform: 'uppercase', letterSpacing: '0.06em' }}>{issue.severity}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{issue.id}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>·</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{issue.type}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 8, lineHeight: 1.5 }}>{issue.description}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 5 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>Sugerencia: </span>{issue.suggestedFix}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!healthResult && !healthLoading && (
              <div className="rt-card" style={{ padding: 32, textAlign: 'center', border: '1.5px dashed var(--border-2)' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>♥</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Presioná "Analizar proyecto" para ejecutar el chequeo de salud del proyecto.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
