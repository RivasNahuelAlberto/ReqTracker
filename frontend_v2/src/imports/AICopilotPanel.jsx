import { useEffect, useState } from 'react';
import { getRecommendations } from '../api.js';

export default function AICopilotPanel({ projectId, activeText, activeEntityId }) {
  const [recs, setRecs] = useState('Esperando contexto...');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const text = activeText?.toString().trim();
    if (!projectId || !text) {
      setRecs('Proporcioná un contexto activo para obtener recomendaciones.');
      return;
    }

    const timeout = setTimeout(async () => {
      setIsLoading(true);
      setError('');
      try {
        const data = await getRecommendations(projectId, text, activeEntityId || '');
        setRecs(data.recommendations || 'No se encontraron recomendaciones.');
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'No se pudo obtener recomendaciones.');
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [projectId, activeText, activeEntityId]);

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <h5 className="card-title">AI Copilot</h5>
        <p className="text-muted">Sugerencias en vivo para ambigüedades, duplicados y mejoras de requisitos.</p>
        {isLoading && <div className="spinner-border spinner-border-sm text-primary" role="status"><span className="visually-hidden">Cargando...</span></div>}
        {error ? (
          <div className="alert alert-danger mt-2">{error}</div>
        ) : (
          <pre style={{ whiteSpace: 'pre-wrap', minHeight: '120px' }}>{recs}</pre>
        )}
      </div>
    </div>
  );
}
