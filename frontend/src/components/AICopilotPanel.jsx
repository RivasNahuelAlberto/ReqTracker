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
    <div className="card section-card assistant-copilot-panel">
      <div className="card-body">
        <div className="section-toolbar mb-3">
          <div>
            <h5 className="section-title mb-1">AI Copilot</h5>
            <p className="section-subtitle mb-0">Sugerencias en vivo para ambigüedades, duplicados y mejoras de requisitos.</p>
          </div>
        </div>
        {isLoading && <div className="spinner-border spinner-border-sm text-primary" role="status"><span className="visually-hidden">Cargando...</span></div>}
        {error ? (
          <div className="alert alert-danger mt-2">{error}</div>
        ) : (
          <pre className="assistant-copilot-output">{recs}</pre>
        )}
      </div>
    </div>
  );
}
