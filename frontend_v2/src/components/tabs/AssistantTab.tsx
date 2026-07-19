import { useEffect, useRef, useState } from 'react'
import { analyzeProjectHealth, fetchHealthIssues, getRecommendations, runAgent } from '../../api'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isStreaming?: boolean
}

const ASSISTANT_PANELS = [
  { key: 'chat', label: 'Chat' },
  { key: 'copilot', label: 'Copilot IA' },
  { key: 'agente', label: 'Agente Autónomo' },
  { key: 'health', label: 'Health Monitor' },
]

function formatTimestamp(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function AssistantTab({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [activeConversationTitle, setActiveConversationTitle] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Array<{ _id: string; title?: string }>>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const msgListRef = useRef<HTMLDivElement>(null)
  const [panel, setPanel] = useState('chat')
  const [copilotText, setCopilotText] = useState('')
  const [copilotResult, setCopilotResult] = useState<string | null>(null)
  const [copilotLoading, setCopilotLoading] = useState(false)
  const [agentGoal, setAgentGoal] = useState('')
  const [agentTask, setAgentTask] = useState<{ status: string; goal: string; steps: Array<{ description: string; tool: string; status: string; error?: string }> } | null>(null)
  const [agentLoading, setAgentLoading] = useState(false)
  const [healthIssues, setHealthIssues] = useState<Array<{ id: string; type: string; severity: string; description: string; suggestedFix: string }>>([])
  const [healthLoading, setHealthLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api'

  // Helper: try original URL, if 404 then retry with '/api' inserted after host
  async function fetchWithApiFallback(input: string, init?: RequestInit) {
    try {
      let res = await fetch(input, init)
      if (res.status !== 404) return res
      try {
        const u = new URL(input, window.location.origin)
        if (!u.pathname.startsWith('/api')) u.pathname = '/api' + u.pathname
        return await fetch(u.toString(), init)
      } catch (e) {
        return res
      }
    } catch (e) {
      throw e
    }
  }

  useEffect(() => {
    if (!projectId) return
    loadConversations()
  }, [projectId])

  useEffect(() => {
    if (conversationId) {
      const conv = conversations.find((c) => c._id === conversationId)
      if (conv?.title) setActiveConversationTitle(conv.title)
    }
  }, [conversationId, conversations])

  const loadConversations = async () => {
    if (!projectId) return
    setIsLoadingConversations(true)
    try {
      const token = localStorage.getItem('authToken')
      const resp = await fetchWithApiFallback(`${apiBase}/conversations/${projectId}`, { headers: { Authorization: `Bearer ${token}` } })
      if (resp.ok) {
        const convs = await resp.json()
        setConversations(Array.isArray(convs) ? convs : [])
      }
    } catch (err) {
      console.error('loadConversations error', err)
    } finally {
      setIsLoadingConversations(false)
    }
  }

  const loadConversationMessages = async (convId: string) => {
    if (!convId) return
    try {
      const token = localStorage.getItem('authToken')
      const resp = await fetchWithApiFallback(`${apiBase}/conversations/${convId}/messages`, { headers: { Authorization: `Bearer ${token}` } })
      if (resp.ok) {
        const msgs = await resp.json()
        const formatted = Array.isArray(msgs) ? msgs.map((m: any) => ({ role: m.role, content: m.content, timestamp: m.createdAt })) : []
        setMessages(formatted)
        setConversationId(convId)
        const conv = conversations.find((c) => c._id === convId)
        if (conv?.title) setActiveConversationTitle(conv.title)
      }
    } catch (err) {
      console.error('loadConversationMessages error', err)
    }
  }

  const createNewConversation = async () => {
    if (!projectId) return
    try {
      const title = window.prompt('Título de la nueva conversación:', `Conversación ${new Date().toLocaleDateString()}`) || `Conversación ${new Date().toLocaleDateString()}`
      const token = localStorage.getItem('authToken')
      const resp = await fetchWithApiFallback(`${apiBase}/conversations/${projectId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ title })
      })
      if (resp.ok) {
        const newConv = await resp.json()
        setConversationId(newConv._id)
        setActiveConversationTitle(newConv.title || title)
        setMessages([])
        await loadConversations()
      } else {
        const txt = await resp.text()
        throw new Error(txt || 'Error creando conversación')
      }
    } catch (err) {
      console.error('createNewConversation error', err)
    }
  }

  const renameConversation = async (convId: string | null) => {
    if (!convId) return
    const newTitle = window.prompt('Nuevo título para la conversación:', activeConversationTitle || '')
    if (!newTitle || !newTitle.trim()) return
    try {
      const token = localStorage.getItem('authToken')
      // backend expects PUT /:conversationId/title
      const resp = await fetch(`${apiBase}/conversations/${convId}/title`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ title: newTitle.trim() }) })
      if (resp.ok) {
        setActiveConversationTitle(newTitle.trim())
        await loadConversations()
      } else {
        const txt = await resp.text()
        throw new Error(txt || 'Error renombrando conversación')
      }
    } catch (err) {
      console.error('renameConversation error', err)
    }
  }

  const deleteConversation = async (convId: string | null) => {
    if (!convId) return
    const ok = window.confirm('¿Eliminar esta conversación? Esta acción la esconderá de la lista.')
    if (!ok) return
    try {
      const token = localStorage.getItem('authToken')
      const resp = await fetchWithApiFallback(`${apiBase}/conversations/${convId}/deactivate`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } })
      if (resp.ok) {
        setConversations((prev) => prev.filter((conv) => conv._id !== convId))
        if (conversationId === convId) {
          setConversationId(null)
          setMessages([])
          setActiveConversationTitle(null)
        }
        await loadConversations()
      } else {
        const txt = await resp.text()
        throw new Error(txt || 'Error al borrar la conversación')
      }
    } catch (err) {
      console.error('deleteConversation error', err)
    }
  }

  useEffect(() => {
    if (msgListRef.current) {
      msgListRef.current.scrollTop = msgListRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (!projectId) return
    const loadHealth = async () => {
      try {
        const data = await fetchHealthIssues(projectId)
        setHealthIssues(Array.isArray(data?.issues) ? data.issues : [])
      } catch {
        // ignore initial load failure; user can retry
      }
    }
    loadHealth()
  }, [projectId])

  const appendAssistantMessage = (content: string, streaming = false) => {
    setMessages((prev) => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (last?.role === 'assistant' && last.isStreaming) {
        next[next.length - 1] = { ...last, content, isStreaming: streaming }
      } else {
        next.push({ role: 'assistant', content, timestamp: formatTimestamp(new Date()), isStreaming: streaming })
      }
      return next
    })
  }

  const handleSend = async () => {
    if (!input.trim() || sending) return
    setErrorMessage(null)
    const userText = input.trim()
    setMessages((prev) => [...prev, { role: 'user', content: userText, timestamp: formatTimestamp(new Date()) }])
    setInput('')
    setSending(true)
    appendAssistantMessage('', true)

    try {
      const token = localStorage.getItem('authToken')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const response = await fetchWithApiFallback(`${apiBase}/ai/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: userText, conversationId, context: { projectId } }),
      })

      if (!response.ok || !response.body) {
        const text = await response.text()
        throw new Error(text || 'Error de conexión con el asistente de IA.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistantText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          const raw = part.replace(/^data: /, '').trim()
          if (!raw) continue
          let data
          try {
            data = JSON.parse(raw)
          } catch {
            continue
          }
          if (data.error) {
            throw new Error(data.error)
          }
          if (data.conversationId) {
            setConversationId(data.conversationId)
          }
          if (data.content) {
            assistantText += data.content
            appendAssistantMessage(assistantText, true)
          }
        }
      }

      appendAssistantMessage(assistantText, false)
    } catch (error: any) {
      const message = error?.message || 'Error inesperado al enviar el mensaje.'
      setErrorMessage(message)
      appendAssistantMessage(`Error: ${message}`, false)
    } finally {
      setSending(false)
    }
  }

  const runCopilot = async () => {
    if (!copilotText.trim()) return
    setErrorMessage(null)
    setCopilotLoading(true)
    setCopilotResult(null)

    try {
      const result = await getRecommendations(projectId, copilotText.trim(), '')
      setCopilotResult(result?.recommendations || 'No se encontraron recomendaciones.')
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.error || error?.message || 'No se pudo obtener recomendaciones.')
    } finally {
      setCopilotLoading(false)
    }
  }

  const runAgentHandler = async () => {
    if (!agentGoal.trim()) return
    setErrorMessage(null)
    setAgentLoading(true)
    setAgentTask(null)

    try {
      const result = await runAgent(projectId, agentGoal.trim())
      setAgentTask(result.task || result)
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.error || error?.message || 'No se pudo ejecutar el agente.')
    } finally {
      setAgentLoading(false)
    }
  }

  const runHealth = async () => {
    setErrorMessage(null)
    setHealthLoading(true)
    setHealthIssues([])

    try {
      const data = await analyzeProjectHealth(projectId)
      setHealthIssues(Array.isArray(data?.issues) ? data.issues : [])
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.error || error?.message || 'No se pudo ejecutar el análisis de salud.')
    } finally {
      setHealthLoading(false)
    }
  }

  const severityColor: Record<string, string> = { high: 'var(--danger)', medium: 'var(--warning)', low: 'var(--success)' }
  const severityBg: Record<string, string> = { high: 'var(--danger-soft)', medium: 'var(--warning-soft)', low: 'var(--success-soft)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 2, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        {ASSISTANT_PANELS.map((panelItem) => (
          <button
            key={panelItem.key}
            onClick={() => setPanel(panelItem.key)}
            style={{
              padding: '5px 14px', fontSize: 12.5, fontWeight: 600, borderRadius: 5, border: 'none', cursor: 'pointer',
              background: panel === panelItem.key ? 'var(--accent-soft)' : 'transparent',
              color: panel === panelItem.key ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {panelItem.label}
          </button>
        ))}
      </div>

      {errorMessage && (
        <div className="rt-card" style={{ margin: 14, padding: 12, borderLeft: '4px solid var(--danger)', color: 'var(--danger)' }}>
          {errorMessage}
        </div>
      )}

      {panel === 'chat' && (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', flex: 1, overflow: 'hidden' }}>
          <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Conversación</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Esta sesión usa el proyecto activo como contexto.</div>
              </div>
              <div>
                <button className="rt-btn rt-btn-sm rt-btn-outline" onClick={createNewConversation} disabled={!projectId} style={{ padding: '6px 10px' }}>Nueva</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              <div className="rt-card" style={{ padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Proyecto</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Todas las preguntas se contestan con información del proyecto.</div>
              </div>
              <div className="rt-card" style={{ padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Conversaciones</div>
                  <div style={{ fontSize: 12 }}>{isLoadingConversations ? <span className="rt-spinner" style={{ width: 14, height: 14 }} /> : null}</div>
                </div>
                {conversations && conversations.length > 0 ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {conversations.map((conv) => (
                      <button key={conv._id} className={`rt-btn rt-btn-sm ${conversationId === conv._id ? 'rt-btn-primary' : 'rt-btn-outline'}`} onClick={() => loadConversationMessages(conv._id)}>
                        {conv.title?.length > 20 ? `${conv.title.substring(0, 20)}...` : conv.title}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No hay conversaciones aún.</div>
                )}
              </div>
              <div className="rt-card" style={{ padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Consejo</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Consulta requisitos, escenarios o notas de resoluciones para obtener respuestas contextualizadas.</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Asistente de proyecto</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Interactuá con el asistente para resolver dudas del alcance y las dependencias del proyecto.</div>
                {conversationId && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{activeConversationTitle || 'Conversación activa'}</div>
                    </div>
                    <div style={{ marginLeft: 8, display: 'flex', gap: 6 }}>
                      <button className="rt-btn rt-btn-sm rt-btn-outline" onClick={() => renameConversation(conversationId)} style={{ padding: '6px 8px' }}>Editar título</button>
                      <button className="rt-btn rt-btn-sm rt-btn-danger" onClick={() => deleteConversation(conversationId)} style={{ padding: '6px 8px' }}>Borrar</button>
                    </div>
                  </div>
                )}
              </div>
              {sending && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontSize: 12 }}>
                  <span className="rt-spinner" style={{ width: 14, height: 14 }} />
                  Generando...
                </div>
              )}
            </div>
            <div ref={msgListRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {messages.map((msg, index) => (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{msg.role === 'user' ? 'Tú' : 'Asistente'} · {msg.timestamp}</div>
                  </div>
                  <div className={`rt-chat-bubble ${msg.role === 'user' ? 'rt-chat-bubble-user' : 'rt-chat-bubble-ai'}`} style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                className="rt-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Escribí tu consulta sobre el proyecto..."
                rows={2}
                style={{ flex: 1, minHeight: 60, maxHeight: 120 }}
              />
              <button className="rt-btn rt-btn-primary" onClick={handleSend} disabled={!input.trim() || sending} style={{ padding: '9px 16px', alignSelf: 'flex-end' }}>
                {sending ? <span className="rt-spinner" /> : 'Enviar'}
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
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ingresa texto de un requisito para recibir sugerencias sobre ambigüedades, duplicados y mejoras.</div>
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
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Escribe un texto y presiona "Obtener recomendaciones" para iniciar el análisis.</div>
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
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Describe un objetivo y el agente generará un plan con pasos y herramientas.</div>
            </div>
            <div className="rt-card" style={{ padding: 16, marginBottom: 16 }}>
              <div className="rt-label" style={{ marginBottom: 6 }}>Objetivo</div>
              <textarea
                className="rt-textarea"
                value={agentGoal}
                onChange={(e) => setAgentGoal(e.target.value)}
                placeholder="Ej: Identificar requisitos incompletos y generar escenarios de prueba para cada uno."
                rows={3}
                style={{ width: '100%', marginBottom: 10 }}
              />
              <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={runAgentHandler} disabled={agentLoading || !agentGoal.trim()}>
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
                  {agentTask.steps.map((step, index) => (
                    <div key={index} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 6 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--success-soft)', border: '1.5px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--success)', flexShrink: 0, marginTop: 1 }}>{index + 1}</div>
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
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Define un objetivo y ejecuta el agente para ver el plan generado.</div>
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
            {healthIssues.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{healthIssues.length} problema{healthIssues.length !== 1 ? 's' : ''} encontrado{healthIssues.length !== 1 ? 's' : ''}</div>
                </div>
                {healthIssues.map((issue) => (
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
            {!healthIssues.length && !healthLoading && (
              <div className="rt-card" style={{ padding: 32, textAlign: 'center', border: '1.5px dashed var(--border-2)' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>♥</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Presiona "Analizar proyecto" para ejecutar el chequeo de salud del proyecto.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
