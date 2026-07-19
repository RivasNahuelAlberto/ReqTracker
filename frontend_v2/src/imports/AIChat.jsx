import { useEffect, useRef, useState } from 'react';

const rawApiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
const apiBase = `${rawApiBase.replace(/\/+$|\/api$/i, '')}/api`;

export default function AIChat({ projectId, canUseAssistant = true }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [activeConversationTitle, setActiveConversationTitle] = useState('');
  const [conversations, setConversations] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [error, setError] = useState('');
  const [toolPreview, setToolPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);
  const messageListRef = useRef(null);
  const bufferRef = useRef('');

  useEffect(() => {
    if (projectId) {
      loadConversations();
      loadActiveConversation();
    }
  }, [projectId]);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  async function loadActiveConversation() {
    if (!projectId) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${apiBase}/conversations/${projectId}/active`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const activeConv = await response.json();
        if (activeConv?._id) {
          setConversationId(activeConv._id);
          setActiveConversationTitle(activeConv.title || 'Conversación activa');
          await loadConversationMessages(activeConv._id);
        }
      }
    } catch (err) {
      console.error('Error loading active conversation:', err);
    }
  }

  async function loadConversations() {
    if (!projectId) return;

    setIsLoadingConversations(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${apiBase}/conversations/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const convs = await response.json();
        setConversations(convs);
        const current = convs.find((conv) => conv._id === conversationId);
        if (current?.title) {
          setActiveConversationTitle(current.title);
        }
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  }

  async function loadConversationMessages(convId) {
    if (!convId) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${apiBase}/conversations/${convId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const msgs = await response.json();
        const formattedMessages = msgs.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.createdAt
        }));
        setMessages(formattedMessages);
        setConversationId(convId);
        const conv = conversations.find((item) => item._id === convId);
        if (conv?.title) {
          setActiveConversationTitle(conv.title);
        }
      }
    } catch (err) {
      console.error('Error loading conversation messages:', err);
    }
  }

  async function createNewConversation() {
    try {
      const title = window.prompt('Título de la nueva conversación:', `Conversación ${new Date().toLocaleDateString()}`) || `Conversación ${new Date().toLocaleDateString()}`;
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${apiBase}/conversations/${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title })
      });

      if (response.ok) {
        const newConv = await response.json();
        setConversationId(newConv._id);
        setActiveConversationTitle(newConv.title || title);
        setMessages([]);
        await loadConversations(); // Recargar lista
      } else {
        const errText = await response.text();
        console.error('Error creating conversation:', response.status, errText);
      }
    } catch (err) {
      console.error('Error creating conversation:', err);
    }
  }

  async function renameConversation(convId) {
    if (!convId) return;
    try {
      const newTitle = window.prompt('Nuevo título para la conversación:', activeConversationTitle || '');
      if (!newTitle || !newTitle.trim()) return;
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${apiBase}/conversations/${convId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: newTitle.trim() })
      });
      if (response.ok) {
        setActiveConversationTitle(newTitle.trim());
        await loadConversations();
      } else {
        const errText = await response.text();
        console.error('Error renaming conversation:', response.status, errText);
      }
    } catch (err) {
      console.error('Error renaming conversation:', err);
    }
  }

  async function sendMessage() {
    if (!input.trim() || isSending) return;

    const text = input.trim();
    setError('');
    setMessages((prev) => [...prev, { role: 'user', content: text, timestamp: new Date() }]);
    setInput('');
    setIsSending(true);
    setIsReasoning(true);

    try {
      const requestBody = {
        message: text,
        conversationId,
        context: {
          projectId
        }
      };

      console.log('AIChat request:', {
        url: `${apiBase}/ai/chat/stream`,
        body: requestBody
      });

      const token = localStorage.getItem('authToken');
      const headers = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${apiBase}/ai/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AIChat response error:', response.status, errorText);
        throw new Error(errorText || 'Error al conectar con el servicio de IA');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      bufferRef.current = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '', timestamp: new Date(), isStreaming: true }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        bufferRef.current += decoder.decode(value, { stream: true });
        const parts = bufferRef.current.split('\n\n');
        bufferRef.current = parts.pop();

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;

          const raw = part.replace('data: ', '').trim();
          if (!raw) continue;

          const data = JSON.parse(raw);
          if (data.conversationId && !conversationId) {
            setConversationId(data.conversationId);
            await loadConversations(); // Recargar lista después de crear conversación
          }

          if (data.done) {
            setIsReasoning(false);
            continue;
          }

          assistantText += data.content;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') {
              next[next.length - 1] = {
                ...last,
                content: assistantText,
                isStreaming: true
              };
            }
            return next;
          });
        }
      }

      // Marcar como completado
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = {
            ...last,
            isStreaming: false
          };
        }
        return next;
      });

    } catch (err) {
      console.error('AIChat catch error:', err);
      setError(err.message || 'Error inesperado');
      setIsReasoning(false);
    } finally {
      setIsSending(false);
    }
  }

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') {
      try {
        const parsed = JSON.parse(last.content);
        if (parsed && typeof parsed === 'object' && (parsed.id || parsed.name || parsed.title)) {
          setToolPreview(parsed);
          return;
        }
      } catch (e) {
        // no-op
      }
    }
    setToolPreview(null);
    setShowPreview(false);
  }, [messages]);

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="text-muted fw-bold">
                  {conversationId
                    ? activeConversationTitle || conversations.find((conv) => conv._id === conversationId)?.title || 'Conversación activa'
                    : 'Iniciá una conversación con el asistente para analizar el proyecto.'}
                </div>
                {conversationId && (
                  <button className="btn btn-sm btn-outline-secondary" title="Editar título" onClick={() => renameConversation(conversationId)}>Editar título</button>
                )}
              </div>
              {isSending && (
                <div className="text-primary small">Generando respuesta... Esto puede tardar unos instantes.</div>
              )}
            </div>
            <div className="d-flex gap-2">
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={createNewConversation}
                disabled={!projectId}
              >
                Nueva conversación
              </button>
            </div>
          </div>

          {/* Lista de conversaciones */}
          {conversations && conversations.length > 0 && (
            <div className="mb-3">
              <div className="text-muted small mb-2">Conversaciones anteriores:</div>
              <div className="d-flex gap-2 flex-wrap" style={{ maxHeight: '100px', overflowY: 'auto' }}>
                {conversations.map((conv) => (
                  <button
                    key={conv._id}
                    className={`btn btn-sm ${conversationId === conv._id ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => loadConversationMessages(conv._id)}
                    title={conv.title}
                  >
                    {conv.title.length > 20 ? `${conv.title.substring(0, 20)}...` : conv.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div
            ref={messageListRef}
            style={{
              height: 350,
              overflowY: 'auto',
              padding: '0.75rem',
              border: '1px solid #dee2e6',
              borderRadius: 6,
              background: '#f8f9fa'
            }}
          >
            {messages.length === 0 && (
              <div className="text-muted">No hay mensajes aún. Escribí algo para empezar.</div>
            )}

            {messages.map((message, index) => (
              <div key={index} className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <div className="fw-bold text-capitalize">{message.role}</div>
                  {message.timestamp && (
                    <small className="text-muted">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </small>
                  )}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {message.content}
                  {message.role === 'assistant' && message.isStreaming && (
                    <span className="text-primary fw-bold">▊</span>
                  )}
                </div>
              </div>
            ))}

            {isReasoning && (
              <div className="mb-3">
                <div className="fw-bold text-primary">Asistente</div>
                <div className="text-muted">
                  <span>Razonando...</span>
                  <span className="spinner-border spinner-border-sm ms-2" role="status">
                    <span className="visually-hidden">Razonando...</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {error && <div className="text-danger mt-2">{error}</div>}

          {!canUseAssistant && (
            <div className="alert alert-warning mt-2">
              No tenés permisos para ordenar acciones de creación/actualización/eliminación al asistente en este proyecto.
            </div>
          )}

          {isSending && (
            <div className="d-flex align-items-center gap-2 mt-2 mb-2 text-primary">
              <div className="spinner-border spinner-border-sm" role="status">
                <span className="visually-hidden">Esperando respuesta...</span>
              </div>
              <div>Procesando tu consulta...</div>
            </div>
          )}

          {toolPreview && (
            <div className="alert alert-info d-flex justify-content-between align-items-center mt-2">
              <div>Se detectó un elemento recuperado por el asistente. Podés revisarlo antes de continuar.</div>
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setShowPreview(true)}>
                Ver elemento
              </button>
            </div>
          )}

          <div className="d-flex gap-2 mt-3">
            <textarea
              className="form-control"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={canUseAssistant ? 'Escribí tu consulta sobre el proyecto...' : 'No tenés permisos de edición con el asistente.'}
              disabled={isSending || !canUseAssistant}
            />
            <button
              className="btn btn-primary"
              type="button"
              onClick={sendMessage}
              disabled={!canUseAssistant || isSending || !input.trim()}
            >
              {isSending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>

      {showPreview && toolPreview && (
        <div className="modal d-block" tabIndex="-1" role="dialog" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="modal-dialog modal-lg" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Vista previa del elemento</h5>
                <button type="button" className="btn-close" onClick={() => setShowPreview(false)} aria-label="Cerrar" />
              </div>
              <div className="modal-body">
                <div className="mb-3">Revisá este elemento antes de modificarlo o eliminarlo.</div>
                <table className="table table-sm table-striped">
                  <tbody>
                    {Object.entries(toolPreview).map(([key, value]) => (
                      <tr key={key}>
                        <th style={{ width: '30%' }}>{key}</th>
                        <td>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPreview(false)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
