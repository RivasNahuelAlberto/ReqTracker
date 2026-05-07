import { useEffect, useRef, useState } from 'react';

const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

export default function AIChat({ projectId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const messageListRef = useRef(null);
  const bufferRef = useRef('');

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || isSending) return;

    const text = input.trim();
    setError('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsSending(true);

    try {
      const response = await fetch(`${apiBase}/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: text,
          conversationId,
          context: {
            projectId
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Error al conectar con el servicio de IA');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      bufferRef.current = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

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
          if (data.conversationId) {
            setConversationId(data.conversationId);
          }

          if (data.done) {
            continue;
          }

          assistantText += data.content;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') {
              next[next.length - 1] = {
                ...last,
                content: assistantText
              };
            }
            return next;
          });
        }
      }
    } catch (err) {
      setError(err.message || 'Error inesperado');
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="card">
      <div className="card-body">
        <div className="mb-3 text-muted">
          {conversationId
            ? `Conversación activa: ${conversationId}`
            : 'Iniciá una conversación con el asistente para analizar el proyecto.'}
        </div>

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
              <div className="fw-bold text-capitalize">{message.role}</div>
              <div>{message.content}</div>
            </div>
          ))}
        </div>

        {error && <div className="text-danger mt-2">{error}</div>}

        <div className="d-flex gap-2 mt-3">
          <textarea
            className="form-control"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu consulta sobre el proyecto..."
            disabled={isSending}
          />
          <button
            className="btn btn-primary"
            type="button"
            onClick={sendMessage}
            disabled={isSending || !input.trim()}
          >
            {isSending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
